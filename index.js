/**
 * @file 入口模块
 * @author sparklewhy@gmail.com
 */

var path = require('path');

exports.name = 'init <template> <filename>';
exports.desc = 'init project/file scaffold with the specified template type';
exports.options = {
    '-h, --help': 'print this help message',
    '-r, --root <path>': 'set project root',
    '--force': 'force init the project and overwrite the existed file'
};

exports.run = function (argv, cli, env) {
    if (argv.h || argv.help) {
        return cli.help(exports.name, exports.options);
    }

    var options = {
        solutionName: env.modulePackage.name,
        fisConfigFile: env.configNameSearch[0],
        root: env.cwd,
        force: argv.force || argv.f
    };

    var cmdArgs = argv._;
    cmdArgs.shift();

    if (cmdArgs.length > 1) {
        // 初始化要拷贝到的目标文件位置
        options.target = path.resolve(options.root, cmdArgs[1]);
        options.isFileTemplate = true;
    }

    var scaffold = require('./lib/scaffold');
    scaffold.init(cmdArgs[0], options);
};

