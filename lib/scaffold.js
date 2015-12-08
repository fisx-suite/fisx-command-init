/**
 * @file 脚手架工具
 * @author sparklewhy@gmail.com
 */

/* global child_process:false */
/* eslint-disable fecs-camelcase */

var path = require('path');
var Promise = require('bluebird');
var templateUtil = require('./template');
var util = require('./util');
var _ = fis.util;

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
        fis.log.warn(ex);
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
            fis.log.warn(reason);
            resolve(info);
        });

        install.on('close', function () {
            resolve(info);
        });
    });
}

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
            return dir;
        }
    ).then(
        function (dir) {
            if (dir && !util.isEmptySync(dir) && !options.force) {
                var reason = 'The inited director ' + dir + ' is not empty'
                    + ', if you want to force initialize, please use `--force` option.';
                return Promise.reject(reason);
            }

            return dir;
        }
    );
}

function initProject(scaffold, options) {
    return Promise.try(initProjectRoot.bind(this, options.fisConfigFile, options))
        .then(function (dir) {
            dir && (options.root = dir);
            options.target = options.root;
            fis.project.setProjectRoot(options.root);

            fis.log.info('Init project in dir: %s', options.target);
            return templateUtil.load(scaffold, options);
        })
        .then(installNPMDependence.bind(this, options))
        .then(installProjectComponents.bind(this, options, options.solutionName))
        .then(function () {
            fis.log.info('Init project done.\n');
        }).catch(function (err) {
            fis.log.warn(err);
            fis.log.info('Init project fail.\n');
        });
}

function initFile(scaffold, options) {
    return Promise.try(function () {
        var target = options.target;
        fis.log.info('Init file: %s', target);

        if (util.isFileExists(target) && !options.force) {
            var reason = 'The inited file ' + target + ' is existed'
                + ', if you want to override, please use `--force` option.';
            return Promise.reject(reason);
        }

        return templateUtil.load(scaffold, options);
    }).then(function () {
        fis.log.info('Init file done.\n');
    }).catch(function (err) {
        fis.log.warn(err);
        fis.log.info('Init file fail.\n');
    });
}

/**
 * 初始化脚手架
 *
 * @param {string} tpl 要使用的模板
 * @param {Object} options 初始化选项
 */
exports.init = function (tpl, options) {
    var template = templateUtil.parse(tpl, options);
    options.template = template;

    var Scaffold = require('fis-scaffold-kernel');
    var scaffold = new Scaffold({
        type: !template.isLocal && template.type,
        log: {
            level: 0x0010
        }
    });

    if (options.isFileTemplate) {
        initFile(scaffold, options);
    }
    else {
        initProject(scaffold, options);
    }
};

/* eslint-enable fecs-camelcase */
