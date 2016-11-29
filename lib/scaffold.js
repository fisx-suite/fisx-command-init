/**
 * @file 脚手架工具
 * @author sparklewhy@gmail.com
 */

/* eslint-disable fecs-camelcase */

var path = require('path');
var Promise = require('bluebird');
var debug = require('debug')('scaffold');

var fisPkgManage = require('fisx-package');
var tplLoader = require('./template');
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
    if (!util.isFileExists(packageJson)) {
        return info;
    }

    try {
        var config = require(packageJson);
        var deps = config.dependencies || {};
        var devDeps = config.devDependencies || {};
        if (Object.keys(deps).length || Object.keys(devDeps).length) {
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
 * @param {Object} info 模板信息
 * @return {Promise|Object}
 */
function installProjectComponents(options, info) {
    var pkgInfo = util.getProjectInfo();
    var varUtil = require('./variable');
    var key = varUtil.manifestKey();
    var deps = (pkgInfo[key] || {}).dependencies;

    if (!deps || _.isEmpty(deps)) {
        return info;
    }

    var pkgManage = require('fisx-package');
    var installOpts = {
        root: options.root,
        saveToDep: true,
        saveToDevDep: true,
        installAllDep: true,
        installAllDevDep: true,
        registry: options.registry,
        token: options.token,
        domain: options.domain
    };

    return pkgManage.loadUserConfig(
        options.fisConfigFile, options, fis
    ).then(
        function () {
            return pkgManage.install([], installOpts);
        }
    );
}

function initProject(scaffold, options) {
    var initProjectRoot = fisPkgManage.initProjectRoot.bind(
        this, options.fisConfigFile, options, fis
    );

    return Promise.try(initProjectRoot)
        .then(function (dir) {
            options.target = options.root;

            fis.log.info('Init project in dir: %s', options.target);
            return tplLoader.load(scaffold, options);
        })
        .then(installNPMDependence.bind(this, options))
        .then(installProjectComponents.bind(this, options))
        .then(function () {
            /**
             * @event scaffold:initdone 初始化完成的事件
             */
            fis.emit('scaffold:initdone', options);

            fis.log.info('Init project done.\n');
        }).catch(function (err) {
            debug('init project error: %j', err.toString());
            fis.log.warn(err);
            fis.log.info('Init project fail.\n');
        });
}

function initFile(scaffold, tpl, options) {
    return Promise.try(function () {
        var target = options.target;
        if (!options.force) {
            var state = util.getFileState(target);
            if (state && state.isFile()) {
                return Promise.reject('The inited file ' + target + ' is existed'
                    + ', if you want to override, please use `--force` option.');
            }
            else if (state && state.isDirectory() && !util.isEmptySync(target)) {
                return Promise.reject('The inited directory ' + target + ' is existed'
                    + ', if you want to override, please use `--force` option.');
            }
        }

        return tplLoader.load(scaffold, options);
    }).then(function () {
        /**
         * @event scaffold:initdone 初始化完成的事件
         */
        fis.emit('scaffold:initdone', options);

        if (options.printInfo) {
            fis.log.info(options.printInfo);
        }

        fis.log.info('Init %s done.\n', tpl);
    }).catch(function (err) {
        debug('init file error: %j', err.toString());
        fis.log.warn(err);
        fis.log.info('Init %s fail.\n', tpl);
    });
}

/**
 * 初始化脚手架
 *
 * @param {string} tpl 要使用的模板
 * @param {Object} options 初始化选项
 */
exports.init = function (tpl, options) {
    var template = tplLoader.parse(tpl, options);
    options.template = template;
    debug('parse: %j', options);

    var scaffold = fisPkgManage.scaffold(fis);
    if (options.isFileTemplate) {
        initFile(scaffold, tpl, options);
    }
    else {
        initProject(scaffold, options);
    }
};

/* eslint-enable fecs-camelcase */
