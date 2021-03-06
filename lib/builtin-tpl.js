/**
 * @file 内建模板定义
 * @author sparklewhy@gmail.com
 */

var path = require('path');
var util = require('./util');

/**
 * 预定义的项目模板类型
 *
 * @type {Object}
 */
var builtinProjectTemplate = {
    'default': {
        uri: 'github:simple',
        description: 'init default project template'
    },
    'spa': {
        uri: 'github:spa-er',
        description: 'init single page application'
    },
    'mspa': {
        uri: 'github:spa-saber',
        description: 'init mobile single page application'
    },
    // 'miso': {
    //     uri: 'github:iso-rebase',
    //     description: 'init mobile isomorphic application'
    // },
    'smarty': {
        uri: 'github:smarty',
        description: 'init smarty project'
    },
    'npm': {
        uri: 'github:npm-module',
        description: 'init npm module project'
    },
    'vue1': {
        uri: 'github:vue1-simple',
        description: 'init Vue 1.x simple project'
    },
    'vue': {
        uri: 'github:vue-simple',
        description: 'init Vue simple project'
    },
    'react': {
        uri: 'github:react-simple',
        description: 'init React simple project'
    }
};

function initSaberFileTpl(options) {
    var cmdArgs = options.cmdArgs;
    var target = cmdArgs[1];
    options.variables = {action: path.basename(target).replace(/\.js$/, '')};
}

/**
 * 预定义的文件模板类型
 *
 * @type {Object}
 */
var builtinFileTemplate = {
    html: {
        uri: 'file:' + path.join(__dirname, 'tpl', 'html.tpl'),
        description: 'create html file: html <targetfile>'
    },
    js: {
        uri: 'file:' + path.join(__dirname, 'tpl', 'js.tpl'),
        description: 'create js file: js <targetfile>'
    },
    amd: {
        uri: 'file:' + path.join(__dirname, 'tpl', 'amd.tpl'),
        description: 'create amd module file: amd <targetfile>'
    },
    saber: {
        uri: 'github:saber',
        path: 'mvp/',
        description: 'create mvp module: saber <router> [output dir]',
        init: function (options) {
            var cmdArgs = options.cmdArgs;
            var router = cmdArgs[1];
            var target = cmdArgs[2];
            options.target = target || 'src';

            var actionName = path.basename(router) || 'index';
            options.variables = {action: actionName};
            options.saberRouter = router;
            options.saberAction = util.resolveModuleId(path.join(options.target, actionName));
            options.isSaberModule = true;
            options.printInfo = 'router config: {paths:\'' + router + '\', action: require(\''
                + options.saberAction + '\')}';
        }
    },
    saberAction: {
        uri: 'github:saber',
        path: 'mvp/${#action#}.js',
        description: 'create saber action file: saberAction <targetFile>',
        init: initSaberFileTpl
    },
    saberModel: {
        uri: 'github:saber',
        path: 'mvp/${#action#}Model.js',
        description: 'create saber model file: saberModel <targetFile>',
        init: initSaberFileTpl
    },
    saberView: {
        uri: 'github:saber',
        path: 'mvp/${#action#}View.js',
        description: 'create saber view file: saberView <targetFile>',
        init: initSaberFileTpl
    }
};

/**
 * 初始化内建模板选项信息
 *
 * @inner
 * @param {?Object} tplInfo 要初始化的内建模板信息
 * @param {Object} options 模板初始化选项
 * @return {Object}
 */
function initBuiltinTpl(tplInfo, options) {
    if (tplInfo) {
        if (fis.util.isFunction(tplInfo.init)) {
            tplInfo.init(options);
        }
    }
    return tplInfo;
}

/**
 * 获取预定义的项目模板
 *
 * @param {Object} options 初始化选项
 * @param {string=} value 模板类型值，可选
 * @return {{description: string, uri: string}}
 */
exports.getBulitinProjectTemplate = function (options, value) {
    return initBuiltinTpl(builtinProjectTemplate[value || 'default'], options);
};

/**
 * 获取预定义的文件模板
 *
 * @param {Object} options 初始化选项
 * @param {string} value 模板类型值
 * @return {{description: string, uri: string}}
 */
exports.getBulitinFileTemplate = function (options, value) {
    return initBuiltinTpl(builtinFileTemplate[value], options);
};

/**
 * 初始化内建模板
 */
exports.init = function () {
    var _ = fis.util;

    // 初始化内建模板
    var projectTpl = fis.get('scaffold.project', {});
    _.assign(builtinProjectTemplate, projectTpl);

    // 初始化文件模板
    var fileTpl = fis.get('scaffold.file', {});
    _.assign(builtinFileTemplate, fileTpl);
};

/**
 * 获取所有内建的模板类型
 *
 * @return {Array.<Object>}
 */
exports.getBuilitinTplTypes = function () {
    var typeArr = [];

    Object.keys(builtinProjectTemplate).forEach(function (k) {
        typeArr.push({type: k, descr: builtinProjectTemplate[k].description});
    });
    Object.keys(builtinFileTemplate).forEach(function (k) {
        typeArr.push({type: k, descr: builtinFileTemplate[k].description});
    });

    return typeArr;
};
