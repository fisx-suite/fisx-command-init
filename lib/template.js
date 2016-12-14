/**
 * @file 模板类
 * @author sparklewhy@gmail.com
 */

var fs = require('fs');
var path = require('path');
var Promise = require('bluebird');

var debug = require('debug')('template');
var sourceType = require('./source-type');
var builtinTpl = require('./builtin-tpl');
var util = require('./util');
var _ = fis.util;

/**
 * 从本地读取模板文件
 * 对于非 `./a` 或 `../a` 这种形式的相对模板路径，如果设置了 `FISX_TEMPLATE` 环境变量，会从
 * 该目录读取模板，e.g., `myCustom`，则读取模板：`<FISX_TEMPLATE>/myCustom`
 *
 * @param {Object} options 选项
 * @return {?Object} 返回拷贝到的目标文件
 */
function readTemplateFileFromLocal(options) {
    // read environment variable: FISX_TEMPLATE
    var LOCAL_TPL_DIR = (options.solutionName + '_' + 'template').toUpperCase();
    var localTplDir = process.env[LOCAL_TPL_DIR];
    var tpl = options.template.path;
    var isRelativePath = (/^\.+/.test(tpl) || !localTplDir);
    var source = isRelativePath ? path.resolve(tpl) : path.resolve(localTplDir, tpl);
    var tmpDir = fis.project.getTempPath('template', _.md5(source));

    debug('read template from local: %s, cache target: ', source, tmpDir);

    var state = util.getFileState(source);
    if (!state) {
        fis.log.warn('the init template source %s is not existed', source);
        return;
    }

    if (state.isFile()) {

        var tmpFile = path.join(tmpDir, path.basename(tpl));
        _.write(tmpFile, fs.readFileSync(source));
        return {
            dir: tmpDir,
            source: tmpFile
        };
    }
}

/**
 * 下载模板
 *
 * @param {Object} scaffold 脚手架
 * @param {Object} options 选项
 * @return {Promise|Object}
 */
function downloadTemplate(scaffold, options) {
    debug('download %j...', options.template);

    // 如果下载来源是本地，直接从本地读取，拷贝到临时目录
    var template = options.template;
    if (template.isLocal && options.isFileTemplate) {
        return readTemplateFileFromLocal(options);
    }

    var repos = template.uri;
    return scaffold.download(repos,
        _.extend(template.options, {
            forceLatest: options.latest,
            token: options.token,
            domain: options.domain,
            registry: options.registry
        })
    ).then(
        function (result) {
            debug('download scaffold done: %j', result);

            var dir = result.source || result.dir;
            if (options.isFileTemplate) {
                dir = path.join(dir, template.fileName || '');
            }
            result.source = dir;
            return result;
        }
    ).catch(function (err) {
        throw err;
    });
}

/**
 * 获取模板变量的正则定义
 *
 * @param {string} begin 开始界定符
 * @param {string} end 结束界定符
 * @return {RegExp}
 */
function getTplVarRegExp(begin, end) {
    return new RegExp(''
        + util.escapeRegexp(begin)
        + '([\\w\\.\\-_]+)(?:\\:(\\w+))?(?:\\s*=\\s*(.*?))?'
        + util.escapeRegexp(end),
        'g'
    );
}

/* eslint-disable fecs-camelcase */
/**
 * 模板变量语法格式定义
 *
 * @type {string}
 */
var _varOpenDelimiter = '${#';
var _varCloseDelimiter = '#}';

/**
 * 模板内容/文件/文件夹名称变量正则: ${#time#}
 * 包含默认值：${#time=20151001#}
 *
 * @type {RegExp}
 */
var _varRegexp = getTplVarRegExp(_varOpenDelimiter, _varCloseDelimiter);

/**
 * 收集模板中内容及文件/文件夹名包含的变量
 *
 * @param {Object} scaffoldInfo 脚手架信息
 * @return {{files: Array, variables: Array, dir: string}}
 */
function collectTemplateVariables(scaffoldInfo) {
    var source = scaffoldInfo.source;
    var varUtil = require('./variable');
    var files = [];
    var state = util.getFileState(source);
    var isSourceDir = false;
    if (state && state.isFile()) {
        files = [source];
    }
    else if (state && state.isDirectory()) {
        isSourceDir = true;
        files = util.find(source);
    }
    var variables = {};

    files.forEach(function (filename) {
        var m;
        var value;

        // 收集路径的变量
        while ((m = _varRegexp.exec(filename))) {
            value = variables[m[1]] = variables[m[1]] || m[3];
            value || (value = varUtil.getVar(m[1]));
        }

        var contents = _.read(filename);
        if (typeof contents !== 'string') {
            return;
        }

        // 收集文件内容的变量
        while ((m = _varRegexp.exec(contents))) {
            value = m[3];
            variables[m[1]] = variables[m[1]] || {type: m[2], value: value};
        }
    });

    debug('collect scaffold vars: %j', variables);
    return {
        scaffold: scaffoldInfo,
        files: files,
        variables: variables,
        source: source,
        isSourceDir: isSourceDir
    };
}

/**
 * 预处理变量值
 *
 * @param {Object} result 要预处理的变量信息
 */
function preprocessVariableValue(result) {
    Object.keys(result).forEach(function (key) {
        var value = result[key];
        if (!_.isPlainObject(value)) {
            value = {value: value};
        }

        var defaultValue = value.value;
        var type = value.type;
        if (!type && (defaultValue === 'true' || defaultValue === 'false')) {
            type = 'boolean';
        }

        type && (type = type.toLowerCase());
        if (type === 'boolean') {
            value.isBoolean = true;
            switch (defaultValue) {
                case 'true':
                    value.value = 'y';
                    break;
                case 'false':
                    value.value = 'n';
            }
        }
        else if (type === 'array') {
            value.isArray = true;
        }

        result[key] = value;
    });
}

/**
 * 通过命令行交互接口读取模板变量的值
 *
 * @param {Object} scaffold 脚手架
 * @param {Object} definedVars 已经定义的变量
 * @param {Object} info 模板信息
 * @return {Object}
 */
function readVariableValues(scaffold, definedVars, info) {
    var schema = [];
    var variables = info.variables;
    var initedVariables = {};
    var varUtil = require('./variable');
    preprocessVariableValue(variables);

    debug('read vars value: %j', variables);
    var rawKeyMap = {};
    var boolSuffix = ' [y/n]';
    var inputHandler = function (info, value) {
        if (info.isBoolean) {
            return value === 'y';
        }
        else if (info.isArray) {
            var parts;
            if (value.indexOf(',') !== -1) {
                parts = value.split(',');
            }
            else {
                parts = value.split(' ');
            }
            return JSON.stringify(parts.filter(function (item) {
                return item;
            }));
        }
        return value;
    };
    debug('define vars: %j', definedVars);
    Object.keys(variables).forEach(function (key) {
        if (definedVars.hasOwnProperty(key)) {
            initedVariables[key] = definedVars[key];
            return;
        }

        var valueInfo = variables[key];
        var value = varUtil.getVar(key);
        if (valueInfo.value == null && (value != null)) {
            if (varUtil.isPromptableVariable(key)) {
                valueInfo.value = value;
            }
            else {
                initedVariables[key] = value;
                return;
            }
        }

        var name = key.replace(/[A-Z]+/g, function (match) {
                if (match.length === 1) {
                    match = match.toLowerCase();
                }
                return ' ' + match;
            }) + (valueInfo.isBoolean ? boolSuffix : '');
        rawKeyMap[name] = key;

        schema.push({
            'name': name,
            'required': valueInfo.value == null,
            'default': valueInfo.value,
            'before': inputHandler.bind(this, valueInfo)
        });
    });

    if (schema.length) {
        return new Promise(function (resolve, reject) {
            scaffold.prompt(schema, function (error, result) {
                if (error) {
                    return reject(error);
                }

                var varMap = {};
                Object.keys(result).forEach(function (k) {
                    varMap[rawKeyMap[k]] = result[k];
                });

                result = _.assign({}, varMap, initedVariables);
                info.variables = result;
                resolve(info);
            });
        });
    }

    info.variables = initedVariables;
    return info;
}

/**
 * 应用模板的变量值，更新模板内容及路径
 *
 * @param {Object} info 模板信息
 * @return {Object}
 */
function applyTemplateVaiableValue(info) {
    var files = info.files;
    var variables = info.variables;
    debug('apply tpl vars: %j', variables);

    files.forEach(function (filepath) {
        var content = _.read(filepath);

        if (typeof content !== 'string') {
            return;
        }

        content = content.replace(_varRegexp, function (_, key) {
            return _varOpenDelimiter + key + '|raw' +  _varCloseDelimiter;
        });

        var etpl = require('etpl');
        etpl.config({
            strip: true,
            // 为了避免 etpl 模板语法被解析，这里故意设置比较奇葩的语法
            commandOpen: '<!#--',
            commandClose: '--#>',
            variableOpen: _varOpenDelimiter,
            variableClose: _varCloseDelimiter
        });
        var render = etpl.compile(content);
        content = render(variables);

        _.write(filepath, content);
    });

    return info;
}

var SCAFFOLD_IGNORE_FILE = '.scaffoldignore';

/**
 * 拷贝下载下来的模板到要初始化的位置
 *
 * @param {Object} options 拷贝选项
 * @param {string} options.target 拷贝到的目标位置
 * @param {boolean} options.isFileTemplate 是否拷贝文件模板
 * @param {Object} info 模板信息
 * @return {Object}
 */
function copyTemplates(options, info) {
    var files = info.files;
    if (options.isFileTemplate && !info.isSourceDir) {
        _.write(options.target, fs.readFileSync(info.source));
        return info;
    }

    var root = info.source;
    var variables = info.variables;
    var roadmap = [];

    debug('copy template to target: %j', variables);
    files.forEach(function (filepath) {
        if (_varRegexp.test(filepath)) {
            var pattern = filepath.substring(root.length - 1);
            var resolved = pattern.replace(_varRegexp, function (_, key) {
                return variables[key];
            });
            roadmap.push({
                reg: pattern,
                release: resolved
            });
        }
    });

    // 初始化脚手架 ignore 文件
    var ignoreFile = path.join(root, SCAFFOLD_IGNORE_FILE);
    util.getIgnoreRegExps(ignoreFile).forEach(function (reg) {
        roadmap.push({
            reg: reg,
            release: false
        });
    });
    roadmap.push({
        reg: new RegExp(util.escapeRegexp('/' + SCAFFOLD_IGNORE_FILE)),
        release: false
    });

    // 不拷贝 根目录下的 `_readme.md` 文件
    roadmap.push({
        reg: /^\/README\.md$/i,
        release: false
    });

    // 将 _README.md 文件拷贝到 README.md 文件
    roadmap.push({
        reg: /^\/_(README\.md)$/i,
        release: '/$1'
    });

    // 其它直接拷贝过去
    roadmap.push({
        reg: /^.*$/i,
        release: '$0'
    });
    util.deliver(root, options.target, roadmap);

    // 删除空的 .gitignore 文件，由于空的目录没法提交到 git 或者被拷贝，因此可以通过增加空的
    // .gitignore 文件来解决，这里对于增加的空的 .gitignore 文件进行清理
    options.isFileTemplate || util.removeEmptyGitIgnoreFile(options.target, true);

    return info;
}

/**
 * 判断给定的路径是不是本地路径
 *
 * @param {string} filePath 要判断的文件路径
 * @return {boolean}
 */
function isLocalPath(filePath) {
    var result = !(/^\/\//.test(filePath)
        || /^[a-z][a-z0-9\+\-\.]+:/i.test(filePath));
    return result && !/^[\w-]+(\/|$)/.test(filePath);
}

/**
 * 解析模板的源
 *
 * @param {string} value 模板的源
 * @param {string=} filePath 文件路径，可选
 * @param {boolean=} isFileTemplate 是否文件模板，可选，默认 false
 * @return {{type: string, uri: string, isLocal: boolean}}
 */
function parseTemplateSource(value, filePath, isFileTemplate) {
    var type;
    var uri;
    var uriPath;

    if (/^http(s)?:\/\//.test(value)) {
        uri = value;
    }
    else if (isLocalPath(value)) {
        type = sourceType.LOCAL;
        uri = value;
    }
    else {
        var segments = value.split(':');
        if (segments.length > 1) {
            var rawType = segments.shift().toLowerCase();
            type = sourceType.findSource(rawType);
            type || (type = {value: rawType});
            uri = segments.join(':');
        }
        else {
            type = fis.get('scaffold.source', sourceType.GITHUB);
            uri = value;
        }

        var hasNs = sourceType.hasNamespace(type.value);
        if (isFileTemplate && hasNs) {
            var parts = uri.split('/');
            parts = parts.filter(function (item) {
                return item.trim();
            });
            if (parts.length > 2) {
                uri = parts.slice(0, 2).join('/');
                var paths = parts.slice(2);
                filePath && (paths.push(filePath));
                filePath = paths.join('/');
            }
            else {
                uri = parts.join('/');
            }
        }

        // 如果模板仓库名称不包含 `/` 则使用 `scaffold.namespace` 为前缀
        // e.g., template 值为 fis-scaffold/jello-demo, 仓库名还是：fis-scaffold/jello-demo
        // template 值为 pc，仓库名则为：<scaffold.namespace>/pc
        if (hasNs && uri.indexOf('/') === -1) {
            var defaultNs = fis.get('scaffold.namespace');
            if (!defaultNs) {
                fis.log.error('scaffold.namespace config missing');
                return;
            }
            uri = defaultNs + '/' + uri;
        }

        uriPath = uri;
        type && (uri = type.value + ':' + uri);
    }

    var templateOpt = type && type.options;
    if (_.isFunction(templateOpt)) {
        templateOpt = templateOpt();
    }

    return {
        type: type,
        uri: uri,
        path: uriPath || uri,
        fileName: filePath,
        isLocal: type === sourceType.LOCAL,
        options: templateOpt
    };
}

/**
 * 设置模板变量的开始和结束界定符
 *
 * @param {string} begin 开始界定符
 * @param {string} end 结束界定符
 */
exports.setTemplateVariableDelimiter = function (begin, end) {
    if (begin != null) {
        _varOpenDelimiter = begin;
    }

    if (end != null) {
        _varCloseDelimiter = end;
    }

    _varRegexp = getTplVarRegExp(_varOpenDelimiter, _varCloseDelimiter);
};

/**
 * 初始化模板
 *
 * @param {Object} scaffold 脚手架
 * @param {Object} options 初始化选项
 * @return {Promise}
 */
exports.load = function (scaffold, options) {
    return Promise.try(downloadTemplate.bind(this, scaffold, options))
        .then(collectTemplateVariables.bind(this))
        .then(readVariableValues.bind(this, scaffold, options.variables || {}))
        .then(applyTemplateVaiableValue)
        .then(copyTemplates.bind(this, options))
        .then(function (result) {
            debug('remove temp cache dir: %j', result.scaffold);
            _.del(result.scaffold.dir);
            return result;
        });
};

/**
 * 解析模板
 *
 * @param {string} tpl 模板值
 * @param {Object} options 解析模板选项
 * @return {{type: string, uri: string, isLocal: boolean, fileName: string}}
 */
exports.parse = function (tpl, options) {
    var tplInfo;
    var result;

    if (options.isFileTemplate) {
        tplInfo = builtinTpl.getBulitinFileTemplate(options, tpl);
        result = parseTemplateSource(
            tplInfo && tplInfo.uri || tpl,
            tplInfo && tplInfo.path,
            true
        );
        return result;
    }

    tplInfo = builtinTpl.getBulitinProjectTemplate(options, tpl);
    debug('get builtin project tpl: %j', tplInfo);
    if (!tplInfo && builtinTpl.getBulitinFileTemplate(options, tpl)) {
        fis.log.error('missing the arguments: please refer help information');
        return;
    }

    return parseTemplateSource(tplInfo && tplInfo.uri || tpl);
};

/* eslint-enable fecs-camelcase */
