/* jshint node: true  */
'use strict';

var async = require('async');
var util = require('util');
var read = require('read');
var Table = require('cli-table');
var defaults = require('./defaults');

var TableFormat = {
  chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
    , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
    , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
    , 'right': '' , 'right-mid': '' , 'middle': ' ' },
  style: { 'padding-left': 0, 'padding-right': 0 }
};
module.exports.TableFormat = TableFormat;

/*
 * Validate the options as if they came from a command line.
 * This will not fill in missing options -- "validate" may be used
 * to do that later.
 */
module.exports.getopts = function(argv, start, descriptor) {
  var opts = {};
  for (var i = start; i < argv.length; i++) {
    var longArg = /^--(.+)/.exec(argv[i]);
    if (longArg) {
      var longArgName = longArg[1];
      var ld = descriptor[longArgName];
      if (ld) {
        if (ld.toggle) {
          opts[longArgName] = true;
        } else if (i < (argv.length - 1)) {
          i++;
          opts[longArgName] = argv[i];

          if (ld.type === 'int') {
            opts[longArgName] = parseInt(opts[longArgName], 10);
          }

          // Set prompt
          if(ld.prompt == false){
            opts.prompt = true;
          }
        } else {
          badArg(argv[i]);
        }
      } else {
        badArg(argv[i]);
      }
    }
    else {
      var shortArg = /^-([A-Za-z])/.exec(argv[i]);
      if (shortArg) {
        var shortArgName = shortArg[1];
        var longName = undefined;
        var des;
        for (var sd in descriptor) {
          des = descriptor[sd];
          if (des.shortOption === shortArgName) {
            longName = sd;
            break;
          }
        }

        if (longName) {
          if  (des.toggle) {
            opts[longName] = true;
          } else if (i < (argv.length - 1)) {
            i++;
            if (des.type === 'int') {
              argv[i] = parseInt(argv[i], 10);
            }

            // add ability to support multiple instances of an option, e.g. headers
            if (des.multiple) {
              if (!opts[longName]) {
                opts[longName] = [];
              }
              opts[longName].push(argv[i]);
            } else {
              opts[longName] = argv[i];

              // Set prompt - only makes sense for singletons (not multiples)
              if(des.prompt == false){
                opts.prompt = true;
              }
            }
          } else {
            badArg(argv[i]);
          }
        } else {
          badArg(argv[i])
        }

      } else {
        badArg(argv[i]);
      }
    }
  }
  return opts;
};

function badArg(arg) {
  throw new Error(util.format('Unknown argument %s', arg));
}

/*
 * Given an "options" object, validate it against "descriptor."
 * Each property in "descriptor" is the name of an option, and has
 * the following possible fields:
 *   required (boolean) error if the option is not present
 *   secure (boolean) error if we must prompt in a secure way
 */
module.exports.validate = function(opts, descriptor, cb) {
  defaults.defaultOptions(opts);
  async.eachSeries(Object.getOwnPropertyNames(descriptor), function(item, done) {
    checkProperty(opts, descriptor, item, done);
  }, function(err) {
    cb(err, opts);
  });
};

function checkProperty(opts, descriptor, propName, done) {
  var desc = descriptor[propName];
  // console.log( "DEBUG COND " + propName + " " + desc.required + " " + !opts[propName] + " " + !opts.prompt + " " + desc.prompt);
  // console.log( "DEBUG OPTs" + JSON.stringify(opts) + "\n");
  if (desc === null || desc === undefined) {
    done(new Error(util.format('Invalid property %s', propName)));
    return;
  }
  if (desc.required && !opts[propName] && (!opts.prompt && desc.prompt)) {
    if (opts.interactive) {
      var pn = (desc.name ? desc.name : propName);
      prompt(pn, desc.secure, function(err, val) {
        if (err) {
          done(err);
        } else {
          if (desc.secure === true) {
            opts[propName] = new SecureValue(val);
          } else {
            opts[propName] = val;
          }
          done();
        }
      });
    } else {
      done(new Error(util.format('Missing required option "%s"', propName)));
    }
  } else {
    if (opts[propName] && (desc.secure === true)) {
      makeSecure(opts, propName);
    }
    done();
  }
}

function prompt(name, secure, cb) {
  var opts = {
    prompt: name + ':'
  };
  if (secure) {
    opts.silent = true;
    opts.replace = '*';
  }

  read(opts, cb);
}

/*
 * Do the same thing as "validate" but without a callback, so it can be used
 * anywhere.
 */
module.exports.validateSync = function(opts, descriptor) {
  Object.getOwnPropertyNames(descriptor).forEach(item =>
    checkPropertySync(opts, descriptor, item));
};

function checkPropertySync(opts, descriptor, propName) {
  var desc = descriptor[propName];
  if (desc === null || desc === undefined) {
    var err = new Error(util.format('Invalid property %s', propName));
    console.error(err);
    throw err;
  }
  if (desc.required && !opts[propName] && (!opts.prompt && desc.prompt)) {
    var err = new Error(util.format('Missing required option "%s"', propName));
    console.error(err);
    throw err;
  } else {
    if (opts[propName] && (desc.secure === true)) {
      makeSecure(opts, propName);
    }
  }
}

function makeSecure(opts, propName) {
  if (opts[propName] && (!(opts[propName] instanceof SecureValue))) {
    opts[propName] = new SecureValue(opts[propName]);
  }
}

/*
 * Produce some "help" text based on the descriptor.
 */
module.exports.getHelp = function(descriptor) {
  var tab = new Table(TableFormat);

  Object.keys(descriptor)
    .sort()
    .forEach( key => {
      let d = descriptor[key];
      tab.push([
        key,
        (d.shortOption ? '-' + d.shortOption : ''),
        ((d.required) ? '(required)': '(optional)'),
        ((d.name ? d.name : 'undefined')),
        ((d.scope == 'default') ? ((d.shortOption == 't' || d.shortOption == 'N') ? '(overrides -p/-u)' : '') : '(command specific)')
      ]);
    });

  return tab.toString();
};

/*
 * This is a little wrapper for a secure value.
 */
function SecureValue(val) {
  if (!(this instanceof SecureValue)) {
    return new SecureValue(val);
  }
  Object.defineProperty(this, 'value', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: val
  });
}

module.exports.SecureValue = SecureValue;

SecureValue.prototype.toString = function() {
  return '********';
};

SecureValue.prototype.getValue = function () {
  return this.value;
};
