/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2014 Apigee Corporation

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
'use strict';

var util = require('util');
var _ = require('underscore');

var TIME_UNITS = {
  second: 1000,
  minute: 60000
};

// options.timeUnit ('second', 'minute') default = second
// options.allow (Number) default = 1
// options.bufferSize (Number) optional, use a memory buffer up to bufferSize to hold elements
function SpikeArrest(Spi, o) {
  var options = _.extend({}, o);
  options.timeUnit = o.timeUnit || 'second';
  options.allow = checkNumber(o.allow, 'allow') || 1;
  options.bufferSize = checkNumber(o.bufferSize, 'bufferSize') || 0;

  options.timeInterval = TIME_UNITS[options.timeUnit];
  if (!options.timeInterval) {
    throw new Error(util.format('Invalid timeUnit %s', options.timeUnit));
  }

  options.windowSize = calcWindowSize(options);

  this.options = options;
  var spi = new Spi(options);
  if (options.bufferSize > 0) {
    var Buffer = require('./memory_buffer');
    var buffer = Buffer.create(spi, options);
    this.spikeArrest = buffer;
  } else {
    this.spikeArrest = spi;
  }
}
module.exports = SpikeArrest;

// options.key (String) options, default = "_default"
// options.weight (Number) default = 1
// cb is invoked with first parameter error, second with stats on the spike arrest
// stats.allowed = setting of "allow"
// stats.used = current value
// stats.isAllowed = true if allowed
// stats.expiryTime = end time (ms) for this window
SpikeArrest.prototype.apply = function(o, cb) {
  var options = o || {};
  try {
    options.weight = checkNumber(o.weight, 'weight') || 1;
  } catch (err) {
    return cb(err);
  }

  options.key = options.key || "_default";
  if (typeof options.key !== 'string') {
    return cb(new Error('key must be a string'));
  }

  this.spikeArrest.apply(options, function(err, result) {
    cb(err, result);
  });
};

SpikeArrest.prototype.connectMiddleware = function(options) {
  var mw = require('./spikearrest-connect');
  return new mw(this, options);
};

SpikeArrest.prototype.expressMiddleware = SpikeArrest.prototype.connectMiddleware;

function checkNumber(val, name) {
  if (!val) { return undefined; }
  if (typeof val === 'number') { return val; }
  if (typeof val === 'string') {
    var int = parseInt(val, 10);
    if (!isNaN(int)) { return int; }
  }
  throw new Error(util.format('%s must be a number', name));
}

function calcWindowSize(options) {
  return options.timeInterval / options.allow;
}
