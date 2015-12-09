/**
 * @file 入口模块
 * @author sparklewhy@gmail.com
 */

var path = require('path');

exports.name = 'init [command|template] [filename] [options]';
exports.desc = 'init project/file scaffold with the specified template type';
exports.options = {
    '-h, --help': 'print this help message',
    '-r, --root <path>': 'set project root',
    '--force': 'force init the project and overwrite the existed file'
};
exports.commands = {
    html: 'init html template',
    js: 'init js template',
    amd: 'init amd template',
    spa: 'init single page application',
    mspa: 'init mobile single page application',
    miso: 'init mobile isomorphic application',
    smarty: 'init smarty project'
};

exports.run = function (argv, cli, env) {
    if (argv.h || argv.help) {
        return cli.help(exports.name, exports.options, exports.commands);
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

    if (!cmdArgs[0]) {
        fis.log.info('Init default project template');
    }

    var scaffold = require('./lib/scaffold');
    scaffold.init(cmdArgs[0], options);
};

