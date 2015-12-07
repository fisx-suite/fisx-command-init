/**
 * @file 模板类
 * @author sparklewhy@gmail.com
 */

var fs = require('fs');
var path = require('path');
var Promise = require('bluebird');
var _ = fis.util;

/**
 * 从本地读取模板，注意对于空文件夹会忽略，同样对于从远程加载比如 `github` 也是一样，`github`
 * 本身也不允许提交空文件目录，保持一致，统一忽略空目录。
 * 对于非 `./a` 或 `../a` 这种形式的相对模板路径，如果设置了 `FISX_TEMPLATE` 环境变量，会从
 * 该目录读取模板，e.g., `myCustom`，则读取模板：`<FISX_TEMPLATE>/myCustom`
 *
 * @param {Object} options 选项
 * @return {string} 返回拷贝到的目标目录/目标文件
 */
function readTemplateFromLocal(options) {
    // read environment variable: FISX_TEMPLATE
    var LOCAL_TPL_DIR = (options.solutionName + '_' + 'template').toUpperCase();
    var localTplDir = process.env[LOCAL_TPL_DIR];
    var tpl = options.template.uri;
    var isRelativePath = (/^\.+/.test(tpl) || !localTplDir);
    var source = isRelativePath ? path.resolve(tpl) : path.resolve(localTplDir, tpl);
    var tmpDir = fis.project.getTempPath('template', _.md5(source));

    fis.log.info('read template from local: %s', source);

    // 删除旧的临时目录
    _.del(tmpDir);

    if (options.isFileTemplate) {
        var tmpFile = path.join(tmpDir, path.basename(tpl));
        _.write(tmpFile, fs.readFileSync(source));
        return tmpFile;
    }

    _.copy(source, tmpDir);
    return tmpDir;
}

/**
 * 下载模板
 *
 * @param {Object} scaffold 脚手架
 * @param {Object} options 选项
 * @return {Promise|string}
 */
function downloadTemplate(scaffold, options) {

    // 如果下载来源是本地，直接从本地读取，拷贝到临时目录
    var template = options.template;
    if (template.isLocal) {
        return readTemplateFromLocal(options);
    }

    return new Promise(function (resolve, reject) {
        var repos = template.uri;

        // 如果模板仓库名称不包含 `/` 则使用 `scaffold.namespace` 为前缀
        // e.g., template 值为 fis-scaffold/jello-demo, 仓库名还是：fis-scaffold/jello-demo
        // template 值为 pc，仓库名则为：<scaffold.namespace>/pc
        if (repos.indexOf('/') === -1) {
            repos = fis.config.get('scaffold.namespace', 'fisx-scaffold')
            + '/' + repos;
        }

        var SimpleTick = require('./tick.js');
        var loading;
        fis.log.info('download %s...', repos);
        scaffold.download(repos, function (error, location) {
            if (error) {
                reject(error);
            }
            else {
                if (options.isFileTemplate) {
                    location = path.join(location, template.fileName);
                }
                resolve(location);
            }

            loading.clear();
        }, function () {
            loading = loading || new SimpleTick('downloading `' + repos + '` ');
            loading.tick();
        });
    });
}

/**
 * 模板内容/文件/文件夹名称变量正则:
 * ${time}
 * 包含默认值：${time=20151001}
 *
 * @type {RegExp}
 */
var VAR_REGEXP = /\$\{([\w\.\-_]+)(?:\s*=\s*(.+?))?\}/g;

/**
 * 收集模板中内容及文件/文件夹名包含的变量
 *
 * @param {Object} scaffold 脚手架
 * @param {boolean} isFile 是否是文件
 * @param {string} source 下载的模板的临时存储的目录或临时文件
 * @return {{files: Array, variables: Array, dir: string}}
 */
function collectTemplateVariables(scaffold, isFile, source) {
    var varUtil = require('./variable');

    var files = isFile ? [source] : scaffold.util.find(source);
    var variables = {};

    files.forEach(function (filename) {
        var m;
        var value;

        // 收集路径的变量
        while ((m = VAR_REGEXP.exec(filename))) {
            value = variables[m[1]] = variables[m[1]] || m[2];
            value || (value = varUtil.getVar(m[1]));
        }

        var contents = _.read(filename);
        if (typeof contents !== 'string') {
            return;
        }

        // 收集文件内容的变量
        while ((m = VAR_REGEXP.exec(contents))) {
            variables[m[1]] = variables[m[1]] || m[2];
        }
    });

    return {
        files: files,
        variables: variables,
        source: source
    };
}

/**
 * 根据变量值转成对应类型的数值
 *
 * @param {Object} result 变量值 map
 * @return {Object}
 */
function resetVariableValue(result) {
    Object.keys(result).forEach(function (key) {
        var value = result[key];
        if (value === 'true') {
            result[key] = true;
        }
        else if (value === 'false') {
            result[key] = false;
        }
        else if (/^\d+$/.test(value)) {
            result[key] = parseInt(value, 10);
        }
    });
    return result;
}

/**
 * 通过命令行交互接口读取模板变量的值
 *
 * @param {Object} scaffold 脚手架
 * @param {Object} info 模板信息
 * @return {Object}
 */
function readVariableValues(scaffold, info) {
    var schema = [];
    var variables = info.variables;
    var initedVariables = {};
    var varUtil = require('./variable');

    Object.keys(variables).forEach(function (key) {
        var value = varUtil.getVar(key);
        if (value != null) {
            initedVariables[key] = value;
        }
        else {
            schema.push({
                'name': key,
                'required': true,
                'default': variables[key]
            });
        }
    });

    if (schema.length) {
        return new Promise(function (resolve, reject) {
            scaffold.prompt(schema, function (error, result) {
                if (error) {
                    return reject(error);
                }

                result = _.assign({}, result, initedVariables);
                resetVariableValue(result);
                info.variables = result;
                resolve(info);
            });
        });
    }

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

    files.forEach(function (filepath) {
        var content = _.read(filepath);

        if (typeof content !== 'string') {
            return;
        }

        content = content.replace(VAR_REGEXP, function (_, key) {
            return '${' + key + '}';
        });

        var etpl = require('etpl');
        var render = etpl.compile(content);
        content = render(variables);

        _.write(filepath, content);
    });

    return info;
}

/**
 * 删除 .gitingore 文件，当且仅当给定的目录下只存在一个为空 .gitignore 文件才删除
 *
 * @param {string} dir 要扫描的初始目录
 * @param {boolean} isRoot 是否是根目录
 */
function removeEmptyGitIgnoreFile(dir, isRoot) {
    var files = [];
    var hasSubDir = false;
    fs.readdirSync(dir).forEach(
        function (file) {
            var fullPath = path.join(dir, file);
            var stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                hasSubDir = true;
                removeEmptyGitIgnoreFile(fullPath, false);
            }
            else if (stat.isFile()) {
                files.push(fullPath);
            }
        }
    );

    // 当存在目录下只有一个空的 .gitignore 文件，且文件内容为空的情况下，才删除该文件
    if (!isRoot && !hasSubDir && files.length === 1) {
        var file = files[0];
        if (/\.gitignore$/i.test(file)) {
            var content = fs.readFileSync(file).toString().trim();
            if (!content) {
                fs.unlinkSync(file);
            }
        }
    }
}

/**
 * 拷贝下载下来的模板到要初始化的位置
 *
 * @param {Object} scaffold 脚手架
 * @param {Object} options 拷贝选项
 * @param {string} options.target 拷贝到的目标位置
 * @param {boolean} options.isFileTemplate 是否拷贝文件模板
 * @param {Object} info 模板信息
 * @return {Object}
 */
function copyTemplates(scaffold, options, info) {
    var files = info.files;
    if (options.isFileTemplate) {
        _.write(options.target, fs.readFileSync(info.source));
        return info;
    }

    var root = info.source;
    var variables = info.variables;
    var roadmap = [];

    files.forEach(function (filepath) {
        if (VAR_REGEXP.test(filepath)) {
            var pattern = filepath.substring(root.length);
            var resolved = pattern.replace(VAR_REGEXP, function (_, key) {
                return variables[key];
            });

            roadmap.push({
                reg: pattern,
                release: resolved
            });
        }
    });

    // 不拷贝 根目录下的 `template_readme.md` 文件
    roadmap.push({
        reg: /^\/template_readme\.md$/i,
        release: false
    });

    // 其它直接拷贝过去
    roadmap.push({
        reg: /^.*$/i,
        release: '$0'
    });
    scaffold.deliver(root, options.target, roadmap);

    // 删除空的 .gitignore 文件，由于空的目录没法提交到 git 或者被拷贝，因此可以通过增加空的
    // .gitignore 文件来解决，这里对于增加的空的 .gitignore 文件进行清理
    removeEmptyGitIgnoreFile(options.target, true);

    return info;
}

/**
 * 模板类型常量
 *
 * @const
 * @type {Object}
 */
var TEMPLATE_TYPE = {
    LOCAL: 'local',
    GITHUB: 'github',
    GITLAB: 'gitlab',
    LIGHTS: 'lights'
};

/**
 * 预定义的项目模板类型
 *
 * @const
 * @type {Object}
 */
var BUILTIN_PROJECT_TEMPLATE = {
    'default': 'simple',
    'pc-spa': 'spa-er',
    'mobile-spa': 'spa-saber',
    'mobile-iso': 'iso-rebase',
    'smarty': 'smarty'
};

var BUILTIN_FILE_TEMPLATE = {
    html: 'local:' + path.join(__dirname, 'tpl', 'html.tpl'),
    js: 'local:' + path.join(__dirname, 'tpl', 'js.tpl'),
    amd: 'local:' + path.join(__dirname, 'tpl', 'amd.tpl')
};

/**
 * 获取预定义的项目模板
 *
 * @param {string=} value 模板类型值，可选
 * @return {{type: string, uri: string}|string}
 */
function getBulitinProjectTemplate(value) {
    value || (value = 'default');
    return fis.config.get('scaffold.project.' + value)
        || BUILTIN_PROJECT_TEMPLATE[value];
}

/**
 * 获取预定义的文件模板
 *
 * @param {string} value 模板类型值
 * @return {{type: string, uri: string}|string}
 */
function getBulitinFileTemplate(value) {
    return fis.config.get('scaffold.file.' + value)
        || BUILTIN_FILE_TEMPLATE[value];
}

/**
 * 解析模板的源
 *
 * @param {string} value 模板的源
 * @return {{type: string, uri: string, isLocal: boolean}}
 */
function parseTemplateSource(value) {
    var type;
    var uri;

    if (_.isString(value)) {
        if (/^http(s)?:\/\//.test(value)) {
            fis.log.error('init from remote url is not supported.');
            return;
        }
        else if (/^\.+/.test(value)) {
            type = TEMPLATE_TYPE.LOCAL;
            uri = value;
        }
        else {
            var segments = value.split(':');
            if (segments.length > 1) {
                type = segments.shift();
                uri = segments.join(':');
            }
            else {
                type = fis.config.get('scaffold.source', TEMPLATE_TYPE.GITHUB);
                uri = value;
            }
        }
    }
    else {
        type = value.type;
        uri = value.uri;
    }

    type = type.toLowerCase();
    return {
        type: type,
        uri: uri,
        isLocal: type === TEMPLATE_TYPE.LOCAL
    };
}

/**
 * 初始化模板
 *
 * @param {Object} scaffold 脚手架
 * @param {Object} options 初始化选项
 * @return {Promise}
 */
exports.load = function (scaffold, options) {
    return Promise.try(downloadTemplate.bind(this, scaffold, options))
        .then(collectTemplateVariables.bind(this, scaffold, options.isFileTemplate))
        .then(readVariableValues.bind(this, scaffold))
        .then(applyTemplateVaiableValue)
        .then(copyTemplates.bind(this, scaffold, options));
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
        tplInfo = getBulitinFileTemplate(tpl) || tpl;
        result = parseTemplateSource(tplInfo);

        // 对于文件模板：形如 {uri: myrepos/a/b.js}
        // 转成 {uri: 'myrepos', filename: 'a/b.js'}
        if (result.type !== TEMPLATE_TYPE.LOCAL) {
            var uri = result.uri;
            var parts = uri.split('/');
            result.uri = parts.shift();
            result.fileName = parts.join('/');

            if (!result.fileName) {
                fis.log.error('please specify the template file to init of repository: %s',
                    result.uri);
                return;
            }
        }
    }
    else {
        tplInfo = getBulitinProjectTemplate(tpl) || tpl;
        result = parseTemplateSource(tplInfo);
    }

    return result;
};
