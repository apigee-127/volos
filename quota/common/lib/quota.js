/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2013 Apigee Corporation

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
"use strict";

var util = require('util');
var _ = require('underscore');

function checkNumber(val, name) {
  if (!val) {
    return undefined;
  }
  if (typeof val === 'string') {
    return parseInt(val, 10);
  } else if (typeof val === 'number') {
    return val;
  } else {
    throw new Error(util.format('%s must be a number', name));
  }
}

var TimeUnits = [ 'hour', 'minute', 'day', 'week' ];

var MINUTE = 60000;
var HOUR = MINUTE * 60;
var DAY = HOUR * 24;
var WEEK = DAY * 7;

// options.startTime (Date, Number, or String date) default = now
//    If set, quota starts at the start time, modulated by what time it is now
// options.rollingWindow (boolean) default = false
//    If set, then quota is rolled over the last period, not reset periodically
// options.timeUnit ("hours", "minutes", or "days") default = minutes
// options.interval (Number) default = 1
// options.allow (Number) default = 1
// options.consistency (string) A hint to some SPIs about how to distribute quota around
// options.bufferSize (Number) optional, use a memory buffer up to bufferSize to hold quota elements
// options.bufferTimeout (Number) optional, flush the buffer every Number ms (default: 300)

function Quota(Spi, o) {
  var options = _.extend({}, o) || {};
  options.timeUnit = o.timeUnit || 'minute';
  options.interval = checkNumber(o.interval, 'interval') || 1;
  options.allow = checkNumber(o.allow, 'allow') || 1;
  options.rollingWindow = o.rollingWindow || false;
  options.bufferSize = checkNumber(o.bufferSize, 'bufferSize') || 0;

  if (!options.timeUnit in TimeUnits) {
    throw new Error(util.format('Invalid timeUnit %s', options.timeUnit));
  }

  if ('minute' === options.timeUnit) {
    options.timeInterval = MINUTE;
  } else if ('hour' === options.timeUnit) {
    options.timeInterval = HOUR;
  } else if ('day' === options.timeUnit) {
    options.timeInterval = DAY;
  } else if ('week' === options.timeUnit) {
    options.timeInterval = WEEK;
  }

  if (options.startTime) {
    if (typeof options.startTime === 'string') {
      var sd = new Date(options.startTime);
      options.startTime = sd.getTime();
    } else if (options.startTime instanceof Date) {
      options.startTime = options.startTime.getTime();
    } else if (typeof options.startTime !== 'number') {
      throw new Error(util.format('Invalid start time %s', options.startTime));
    }
  }

  if (options.bufferSize > 0) {
    options.bufferTimeout = checkNumber(o.bufferTimeout, 'bufferTimeout') || 300;
  }

  this.options = options;
  var spi = new Spi(options);
  if (options.bufferSize > 0) {
    var Buffer = require('./memory_buffer');
    var buffer = Buffer.create(spi, options);
    this.quota = buffer;
  } else {
    this.quota = spi;
  }
}
module.exports = Quota;

// options.key (Non-object) required (for backward compatibility, options.identifier is also allowed)
// options.weight (Number) default = 1
// options.allow (Number) default = whatever was set in policy setup, and this allows override
// cb is invoked with first parameter error, second with stats on the quota
// stats.allowed = setting of "allow"
// stats.used = current value
// stats.isAllowed = true if allowed
// stats.expiryTime = end time (ms) for this window

Quota.prototype.apply = function(o, cb) {
  var options = o || {};
  try {
    options.weight = checkNumber(o.weight, 'weight') || 1;
    options.allow = checkNumber(o.allow, 'allow') || this.options.allow;
  } catch (err) {
    return cb(err);
  }

  if (options.key) { options.identifier = options.key; delete(options.key); }

  if (!options.identifier) {
    return cb(new Error('identifier must be set'));
  }
  if (typeof options.identifier !== 'string') {
    return cb(new Error('identifier must be a string'));
  }

  this.quota.apply(options, function(err, result) {
    cb(err, result);
  });
};

Quota.prototype.connectMiddleware = function(options) {
  var mw = require('./quota-connect');
  return new mw(this, options);
};

Quota.prototype.expressMiddleware = Quota.prototype.connectMiddleware;

Quota.prototype.argoMiddleware = function(options) {
  var mw = require('./quota-argo');
  return new mw(this, options);
};
