/**
 * @file 工具方法
 * @author sparklewhy@gmail.com
 */

var fs = require('fs');
var path = require('path');

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

/**
 * 转义字符串的正则字符
 *
 * @param {string} str 要转义的字符串
 * @return {string}
 */
exports.escapeRegexp = function (str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
};

/**
 * 移除空的 gitignore 文件
 *
 * @param {string} dir 要移除的 gitignore 文件 所在目录
 * @param {boolean} isRoot 是否是项目根目录
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
 * 删除 .gitingore 文件，当且仅当给定的目录下只存在一个为空 .gitignore 文件才删除
 *
 * @param {string} dir 要扫描的初始目录
 * @param {boolean} isRoot 是否是根目录
 */
exports.removeEmptyGitIgnoreFile = removeEmptyGitIgnoreFile;

function normalizeRoadMap(roadmap) {
    if (!Array.isArray(roadmap)) {
        return [];
    }
    var map = [];
    var glob = require('glob.js');
    roadmap.forEach(function (raw) {
        if (raw.reg) {
            if (typeof raw.reg === 'string') {
                raw.reg = glob.make(raw.reg);
            }
            map.push({
                reg: raw.reg,
                release: (typeof raw.release === 'undefined') ? '$&' : raw.release
            });
        }
    });
    return map;
}

function hit(file, include, exclude) {
    return include
        ? (exclude ? include.test(file) && !exclude.test(file) : include.test(file))
        : (exclude ? !exclude.test(file) : true);
}

/**
 * 查找文件
 *
 * @param {string} dir 要查找的目录
 * @param {RegExp} include 要包含的文件正则
 * @param {RegExp} exclude 要忽略的文件正则
 * @return {Array}
 */
exports.find = function (dir, include, exclude) {
    dir = path.resolve(dir);
    if (!fs.existsSync(dir)) {
        return [];
    }

    var files = [];
    var arr = fs.readdirSync(dir);
    arr && arr.forEach(function (file) {
        var fileName = file;

        file = path.join(dir, file);
        var stat = fs.lstatSync(file);
        if (stat.isFile()) {
            if (hit(file, include, exclude)) {
                files.push(file);
            }
        }
        else if (stat.isSymbolicLink()) {
            // ignore now.
        }

        // 忽略 .xx 命名的文件夹
        if (stat.isDirectory() && !/^\./.test(fileName)) {
            files = files.concat(exports.find(file, include, exclude));
        }
    });

    return files;
};

/**
 * 获取忽略的正则列表
 *
 * @param {string} ignoreFile 忽略文件路径
 * @return {Array.<RegExp>}
 */
exports.getIgnoreRegExps = function (ignoreFile) {
    var _ = fis.util;
    var glob = require('glob.js');
    var result = [];
    if (exports.isFileExists(ignoreFile)) {
        var ignoreItems = _.read(ignoreFile).toString().trim().split('\n');
        ignoreItems.forEach(function (item) {
            item = item.trim();
            if (!/^\//.test(item)) {
                item = '/' + item;
            }
            if (/\/$/.test(item)) {
                item += '*';
            }
            item && result.push(glob.make(item));
        });
    }

    return result;
};

/**
 * 文件移动
 * Refer fis-scaffold-kernal#deliver
 *
 * @param {string} from 要拷贝的源目录
 * @param {string} to 要拷贝的目标目录
 * @param {Array.<Object>} roadmap 拷贝规则
 * @return {number}
 */
exports.deliver = function (from, to, roadmap) {
    var _ = fis.util;

    to = to || '';
    from = path.resolve(from);
    var map = normalizeRoadMap(roadmap);
    var files = exports.find(from);
    var replaceDefine = function (match, release) {
        return release.replace(/\$(\d+|&)/g, function (m, $1) {
            var val = match[$1 === '&' ? 0 : $1];
            return typeof val === 'undefined' ? '' : val;
        });
    };

    // 移动文件的个数
    var count = 0;
    var ruleNum = map.length;
    for (var i = 0, len = files.length; i < len; i++) {
        var file = files[i];
        var release;
        var isMatch = false;
        var isRelease = true;

        for (var j = 0; j < ruleNum; j++) {
            var rule = map[j];
            file.replace(from, '')
                .replace(/\\/g, '/')
                .replace(rule.reg, function () {
                        if (rule.release) {
                            release = replaceDefine(
                                arguments, rule.release
                            );
                        }
                        else {
                            isRelease = false;
                        }
                        isMatch = true;
                    }
                );

            if (isMatch) {
                break;
            }
        }

        if (!isRelease) {
            continue;
        }

        if (!isMatch) {
            release = file.replace(from, '');
        }

        count++;
        _.copy(file, path.join(to, release), null, null, true, true);
    }

    return count;
};
