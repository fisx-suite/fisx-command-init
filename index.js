/**
 * @file 入口模块
 * @author sparklewhy@gmail.com
 */

var path = require('path');

exports.name = 'init [command|template] [filename] [options|varOptions]\n'
    + '             init [local dir|url] [options|varOptions]';
exports.desc = 'init project/file scaffold with the specified template type';
exports.options = {
    '-h, --help': 'print this help message',
    '-r, --root <path>': 'set project root',
    '--force': 'force init the project and overwrite the existed file',
    '-b, --begin <delimiter>': 'set template variable begin delimiter',
    '-e, --end <delimiter>': 'set template variable end delimiter'
};

function getTplSubCommands(builtinTypes) {
    var cmd = {};
    builtinTypes.forEach(function (item) {
        cmd[item.type] = item.descr;
    });
    return cmd;
}

exports.run = function (argv, cli, env) {
    var builtinTpl = require('./lib/builtin-tpl');
    builtinTpl.init();
    exports.commands = getTplSubCommands(builtinTpl.getBuilitinTplTypes());

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

    options.cmdArgs = cmdArgs;
    options.rawArgv = argv;
    if (cmdArgs.length > 1) {
        // 初始化要拷贝到的目标文件位置
        options.target = path.resolve(options.root, cmdArgs[1]);
        options.isFileTemplate = true;
    }

    if (!cmdArgs[0]) {
        fis.log.info('Init default project template');
    }

    // 初始化从命令行传递进来的变量值信息
    var reservedKeys = ['force', 'f', '_'];
    var variables = {};
    Object.keys(argv).forEach(function (key) {
        if (reservedKeys.indexOf(key) === -1) {
            variables[key] = argv[key];
        }
    });
    options.variables = variables;
    
    // 初始化模板的开始、结束界定符号
    var bDelimiter = argv.begin || argv.b;
    var eDelimiter = argv.end || argv.e;
    var template = require('./lib/template');
    template.setTemplateVariableDelimiter(bDelimiter, eDelimiter);

    var scaffold = require('./lib/scaffold');
    scaffold.init(cmdArgs[0], options);
};

