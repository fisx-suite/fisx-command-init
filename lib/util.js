/**
 * @file 工具方法
 * @author sparklewhy@gmail.com
 */

var fs = require('fs');

/**
 * 判断给定的路径是否是空的目录或者空的文件，如果路径不存在，也会认为是空的
 *
 * @param {string} checkPath 要检查的路径
 * @return {boolean}
 */
exports.isEmptySync = function (checkPath) {
    try {
        var stat = fs.statSync(checkPath);
    }
    catch (e) {
        return true;
    }

    if (stat.isDirectory()) {
        var items = fs.readdirSync(checkPath);
        return !items || !items.length;
    }

    var file = fs.readFileSync(checkPath);
    return !file || !file.length;
};

/**
 * 获取给定的文件路径的状态信息
 *
 * @inner
 * @param {string} target 文件的目标路径
 * @return {?Object}
 */
function getFileState(target) {
    try {
        var state = fs.statSync(target);
        return state;
    }
    catch (ex) {
    }
}

exports.getFileState = getFileState;

/**
 * 判断给定的文件路径是否存在
 *
 * @param {string} target 要判断的目标路径
 * @return {boolean}
 */
exports.isFileExists = function (target) {
    var state = getFileState(target);
    return state && state.isFile();
};

/**
 * 判断给定的目录路径是否存在
 *
 * @param {string} target 要判断的目标路径
 * @return {boolean}
 */
exports.isDirectoryExists = function (target) {
    var state = getFileState(target);
    return state && state.isDirectory();
};

/**
 * 获取项目信息
 *
 * @return {Object}
 */
exports.getProjectInfo = function () {
    try {
        return require(fis.project.getProjectPath(fis.get('component.manifestFile')));
    }
    catch (ex) {
        return {};
    }
};

/**
 * 获取模块文件的绝对模块 id
 *
 * @param {string} moduleFile 模块文件
 * @return {string}
 */
exports.resolveModuleId = function (moduleFile) {
    var root = fis.project.getProjectPath();
    var path = require('path');
    moduleFile = path.resolve(root, moduleFile);

    var baseUrl = fis.getModuleConfig().baseUrl || '';
    baseUrl = path.resolve(root, baseUrl);

    var id = path.relative(baseUrl, moduleFile);
    return id.replace(/\//, '/');
};
