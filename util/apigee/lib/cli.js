#!/usr/bin/env nodeAdd commentMore actions

var main = require('./main');
var options = require('./options');
var commands = require('./commands/commands');

if (process.argv.length < 3) {
  console.error('Usage: apigeeutils <command>');
  commands.printCommandHelp();
  process.exit(2);
}

var commandName = process.argv[2];
var command = commands.getCommand(commandName);

if (!command) {
  console.error('Invalid command "%s"', commandName);
  commands.printCommandHelp();
  process.exit(3);
}

var commandModule = command.load();

var opts;
try {
  opts = options.getopts(process.argv, 3, commandModule.descriptor);
} catch (e) {
  printUsage(e);
  process.exit(4);
}

if (opts.help) {
  console.log(options.getHelp(commandModule.descriptor));
  process.exit(0);
}

if (process.stdin.isTTY) {
  opts.interactive = true;
}

options.validate(opts, commandModule.descriptor, function (err) {
  if (err) {
    printUsage(err);
    process.exit(5);
  }
  runCommand();
});

function printUsage(err) {
  console.error('Invalid arguments: %s', err);
  console.error('');
  console.log('Usage:');
  console.log(options.getHelp(commandModule.descriptor));
}

function runCommand() {
  commandModule.run(opts, function (err, result) {
    if (err) {
      console.error('%s', err);
      if (opts.verbose) {
        console.error(err.stack);
      }
      process.exit(6);
    }

    if (!opts.json && commandModule.format) {
      console.log(commandModule.format(result));
    } else {
      console.log(JSON.stringify(result));
    }

    process.exit(0);
  });
}