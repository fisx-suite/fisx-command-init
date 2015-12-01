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
 * 获取项目信息
 *
 * @return {Object}
 */
exports.getProjectInfo = function () {
    try {
        return require(fis.project.getProjectPath('package.json'));
    }
    catch (ex) {
        return {};
    }
};
