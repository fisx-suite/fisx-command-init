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
 * 清单文件保存模块信息的 key
 *
 * @return {string}
 */
exports.manifestKey = function () {
    return fis.config.get('component.saveTargetKey') || 'fisx';
};

/**
 * 项目/模块名称
 *
 * @return {string}
 */
exports.name = function () {
    return path.basename(fis.project.getProjectPath()) || '<project-name>';
};

/**
 * 模板变量的别名
 *
 * @const
 * @type {{name: string[]}}
 */
var varAliasNames = {
    name: ['project-name', 'projectName']
};

/**
 * 确定模板变量可用的名称
 *
 * @param {string} name 变量名称
 * @return {string}
 */
function resolveTemplateVar(name) {
    if (varAliasNames[name]) {
        return name;
    }

    var result = null;
    Object.keys(varAliasNames).some(function (key) {
        var aliasNames = varAliasNames[key].map(function (item) {
            return item.toLowerCase();
        });

        if (aliasNames.indexOf(name.toLowerCase()) !== -1) {
            result = key;
            return true;
        }
        return false;
    });

    return result || name;
}

/**
 * 获取给定的 key 的变量值
 *
 * @param {string} key 要获取的 key 变量
 * @return {string}
 */
exports.getVar = function (key) {
    var k = resolveTemplateVar(key);
    var value = fis.config.get('template.' + k);
    if (_.isFunction(value)) {
        value = value();
    }
    return value;
};

/**
 * 不提示输入的变量
 *
 * @const
 * @type {Array.<string>}
 */
var NO_PROMPT_VARS = [
    'manifestKey'
];

/**
 * 是否需要提示输入的变量
 *
 * @param {string} name 变量名称
 * @return {boolean}
 */
exports.isPromptableVariable = function (name) {
    return NO_PROMPT_VARS.indexOf(name) === -1;
};


fis.config.set('template.name', exports.name);
fis.config.set('template.author', exports.author);
fis.config.set('template.date', exports.date);
fis.config.set('template.manifestKey', exports.manifestKey);
