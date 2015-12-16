/**
 * @file 模板加载来源的类型定义
 * @author sparklewhy@gmail.com
 */

var SOURCE_TYPE = {
    LOCAL: {value: 'local'},
    GITHUB: {value: 'github'},
    GITLAB: {
        value: 'gitlab',
        options: function () {
            return {
                token: fis.get('scaffold.gitlabToken'),
                repos: fis.get('scaffold.gitlabDomain')
            };
        }
    },
    LIGHTS: {value: 'lights'}
};

/**
 * 模板类型常量
 *
 * @const
 * @type {Object}
 */
module.exports = exports = SOURCE_TYPE;

/**
 * 根据给定的类型查找源
 *
 * @param {string} type 要查找的源类型
 * @return {?Object}
 */
exports.findSource = function (type) {
    var found;

    Object.keys(SOURCE_TYPE).some(function (key) {
        var info = exports[key];
        if (info.value === type) {
            found = info;
            return true;
        }
    });

    return found;
};

