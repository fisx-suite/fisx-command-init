/**
 * @file 入口模块，基于 `fis3-command-init` 模块修改
 * @author sparklewhy@gmail.com
 */

/* global child_process:false */
/* eslint-disable fecs-camelcase */

var _ = fis.util;
var path = require('path');
var Promise = require('bluebird');
var util = require('./lib/util');

/**
 * 模板内容/文件/文件夹名称变量正则:
 * ${time}
 * 包含默认值：${time=20151001}
 *
 * @type {RegExp}
 */
var VAR_REGEXP = /\$\{([\w\.\-_]+)(?:\s*=\s*(.+?))?\}/g;

exports.name = 'init <template>';
exports.desc = 'init project scaffold with the specified template type';
exports.options = {
    '-h, --help': 'print this help message',
    '-r, --root <path>': 'set project root',
    '-s, --source <source>': 'the source type to load template, support github|gitlab|lights',
    '-f, --force': 'force init the project and overwrite the existed file',
    '-u, --use <type>': 'use the specified technique'
};

/**
 * 初始化项目根目录
 *
 * @param {string} fisConfigFile  配置文件
 * @param {Object} options 选项
 * @return {Promise}
 */
function initProjectRoot(fisConfigFile, options) {
    var findup = require('findup');

    return new Promise(function (resolve, reject) {
        var fup = findup(options.root, fisConfigFile);
        var dir = null;

        fup.on('found', function (found) {
            dir = found;
            fup.stop();
        });

        fup.on('error', reject);

        fup.on('end', function () {
            resolve(dir);
        });
    }).then(
        function (dir) {
            dir && (options.root = dir);
            return options.root;
        }
    ).then(
        function (dir) {
            if (!util.isEmptySync(dir) && !options.force) {
                var reason = 'the inited director ' + dir + ' is not empty'
                    + ', if you want to force initialize, please use `-f` option.';
                fis.log.error(reason);
                return Promise.reject(reason);
            }

            fis.project.setProjectRoot(dir);
            return dir;
        }
    );
}

/**
 * 从本地读取模板，注意对于空文件夹会忽略，同样对于从远程加载比如 `github` 也是一样，`github`
 * 本身也不允许提交空文件目录，保持一致，统一忽略空目录。
 * 对于非 `./a` 或 `../a` 这种形式的相对模板路径，如果设置了 `FISX_TEMPLATE` 环境变量，会从
 * 该目录读取模板，e.g., `myCustom`，则读取模板：`<FISX_TEMPLATE>/myCustom`
 *
 * @param {Object} scaffold 脚手架
 * @param {Object} options 选项
 * @return {string} 返回拷贝到的目标目录
 */
function readTemplateFromLocal(scaffold, options) {
    var localTplDir = options.localTplDir;
    var tpl = options.template;
    var isRelativePath = (/^\.+/.test(tpl) || !localTplDir);
    var sourceDir = isRelativePath ? path.resolve(tpl) : path.join(localTplDir, tpl);
    var tmpDir = fis.project.getTempPath('template', _.md5(sourceDir));

    // 删除旧的临时目录
    _.del(tmpDir);
    _.copy(sourceDir, tmpDir);

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
    fis.log.info('Init project in dir: %s', options.root);

    // 如果下载来源是本地，直接从本地读取，拷贝到临时目录
    if (options.source === 'local') {
        return readTemplateFromLocal(scaffold, options);
    }

    return new Promise(function (resolve, reject) {
        var repos = options.template;

        // 如果模板仓库名称不包含 `/` 则使用 `scaffold.namespace` 为前缀
        // e.g., template 值为 fis-scaffold/jello-demo, 仓库名不变
        // template 值为 pc，仓库名为：<scaffold.namespace>/pc
        if (!~repos.indexOf('/')) {
            repos = fis.config.get('scaffold.namespace', 'ecomfe/fisx-scaffold')
            + '/' + repos;
        }

        var SimpleTick = require('./lib/tick.js');
        var loading;
        scaffold.download(repos, function (error, location) {
            if (error) {
                return reject(error);
            }

            loading.clear();
            resolve(location);
        }, function () {
            loading = loading || new SimpleTick('downloading `' + repos + '` ');
            loading.tick();
        });
    });
}

/**
 * 收集模板中内容及文件/文件夹名包含的变量
 *
 * @param {Object} scaffold 脚手架
 * @param {string} tempdir 下载的模板的临时存储的目录
 * @return {{files: Array, variables: Array, dir: string}}
 */
function collectTemplateVariables(scaffold, tempdir) {
    var varUtil = require('./lib/variable');

    var files = scaffold.util.find(tempdir);
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
        dir: tempdir
    };
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

    Object.keys(variables).forEach(function (key) {
        schema.push({
            'name': key,
            'required': true,
            'default': variables[key]
        });
    });

    if (schema.length) {
        return new Promise(function (resolve, reject) {
            scaffold.prompt(schema, function (error, result) {
                if (error) {
                    return reject(error);
                }

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
            return variables[key];
        });
        _.write(filepath, content);
    });

    return info;
}

/**
 * 拷贝下载下来的模板到要初始化的位置
 *
 * @param {Object} scaffold 脚手架
 * @param {string} target 拷贝到的目标位置
 * @param {Object} info 模板信息
 * @return {Object}
 */
function copyTemplates(scaffold, target, info) {
    var files = info.files;
    var root = info.dir;
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

    // 不拷贝 根目录下的 `readme.md` 文件
    roadmap.push({
        reg: /^\/readme\.md$/i,
        release: false
    });

    // 其它直接拷贝过去
    roadmap.push({
        reg: /^.*$/i,
        release: '$0'
    });
    scaffold.deliver(root, target, roadmap);
    return info;
}

/**
 * 安装 npm 依赖
 *
 * @param {Object} options 选项
 * @param {Object} info 模板信息
 * @return {Promise|Object}
 */
function installNPMDependence(options, info) {
    var packageJson = path.join(options.root, 'package.json');
    try {
        var config = require(packageJson);
        if (config.dependencies || config.devDependencies) {
            fis.log.info('Installing npm dependencies...');

            // run `npm install`
            return new Promise(function (resolve, reject) {
                var child_process = require('child_process');
                var spawn = child_process.spawn;
                var npm = _.isWin() ? 'npm.cmd' : 'npm';
                var install = spawn(npm, ['install'], {
                    cwd: options.root
                });

                install.stdout.pipe(process.stdout);
                install.stderr.pipe(process.stderr);
                install.on('error', function (reason) {
                    reject(reason);
                });
                install.on('close', function () {
                    resolve(info);
                });
            });
        }
    }
    catch (ex) {
        fis.log.error(ex);
    }

    return info;
}

/**
 * 安装项目依赖组件
 *
 * @param {Object} options 选项
 * @param {string} solutionName 方案名称
 * @param {Object} info 模板信息
 * @return {Promise|Object}
 */
function installProjectComponents(options, solutionName, info) {
    var pkgInfo = util.getProjectInfo();
    var deps = (pkgInfo[solutionName] || {}).dependencies;

    if (!deps || _.isEmpty(deps)) {
        return info;
    }

    return new Promise(function (resolve, reject) {
        var spawn = child_process.spawn;
        fis.log.info('Installing project components...');

        // '/usr/local/bin/node', '/usr/local/bin/fisx', 'install'
        var install = spawn(process.execPath, [process.argv[1], 'install']);
        install.stdout.pipe(process.stdout);
        install.stderr.pipe(process.stderr);

        install.on('error', function (reason) {
            reject(reason);
        });

        install.on('close', function () {
            resolve(info);
        });
    });
}

exports.run = function (argv, cli, env) {
    if (argv.h || argv.help) {
        return cli.help(exports.name, exports.options);
    }

    var source = argv.s || argv.source || 'github';
    var solutionName = env.modulePackage.name;
    var LOCAL_TPL_DIR = (solutionName + '_' + 'template').toUpperCase();
    var options = {
        source: source,
        localTplDir: process.env[LOCAL_TPL_DIR],
        root: env.cwd,
        template: argv._[1] || 'pc',
        force: argv.force || argv.f
    };

    var Scaffold = require('fis-scaffold-kernel');
    var scaffold = new Scaffold({
        type: source,
        log: {
            level: 0
        }
    });

    Promise.try(initProjectRoot.bind(this, env.configNameSearch[0], options))
        .then(downloadTemplate.bind(this, scaffold, options))
        .then(collectTemplateVariables.bind(this, scaffold))
        .then(readVariableValues.bind(this, scaffold))
        .then(applyTemplateVaiableValue)
        .then(copyTemplates.bind(this, scaffold, options.root))
        .then(installNPMDependence.bind(this, options))
        .then(installProjectComponents.bind(this, options, solutionName))
        .then(function () {
            fis.log.info('Init project done.\n');
        });
};

/* eslint-enable fecs-camelcase */
