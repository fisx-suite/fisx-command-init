/**
 * @file 模板预定义变量相关定义
 * @author sparklewhy@gmail.com
 */

var path = require('path');
var _ = fis.util;
var util = require('./util');

/**
 * 获取系统用户名
 *
 * @return {string}
 */
function getSystemUserName() {
    return process.env[_.isWin() ? 'USERPROFILE' : 'HOME'].split(path.sep)[2];
}

module.exports = exports = {};

/**
 * `${author}` 变量的预定义值，默认读取项目 `package.json` 定义值，及环境变量 `user` 值
 *
 * @return {string}
 */
exports.author = function () {
    var pkgInfo = util.getProjectInfo();
    var author = pkgInfo && pkgInfo.author;
    if (_.isObject(author)) {
        var name = author.name;
        var email = author.email ? author.email : '';

        if (name) {
            email && (email = '(' + email + ')');
        }
        author = name ? (name + email) : email;
    }

    return author || getSystemUserName() || '<yourname>';
};

/**
 * `${date}` 变量的预定义值，默认为当前时间 `2015/10/2`
 *
 * @return {string}
 */
exports.date = function () {
    var now = new Date();
    return [now.getFullYear(), now.getMonth() + 1, now.getDate()].join('/');
};

/**
 * 获取给定的 key 的变量值
 *
 * @param {string} key 要获取的 key 变量
 * @return {string}
 */
exports.getVar = function (key) {
    var value = fis.config.get('template.' + key);
    if (_.isFunction(value)) {
        value = value();
    }
    return value;
};

fis.config.set('template.author', exports.author);
fis.config.set('template.date', exports.date);
