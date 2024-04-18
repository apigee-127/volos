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
