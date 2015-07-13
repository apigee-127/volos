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

var TimeUnits = [ 'hour', 'minute', 'day', 'week', 'month' ];

var MINUTE = 60000;
var HOUR = MINUTE * 60;
var DAY = HOUR * 24;
var WEEK = DAY * 7;
var MONTH = DAY * 31;

// options.startTime (Date, Number, or String date) default = now
//    If set, quota starts at the start time, modulated by what time it is now
// options.rollingWindow (boolean) default = false
//    If set, then quota is rolled over the last period, not reset periodically
// options.timeUnit ("minute", "hour", "day", "month") default = minute
// options.interval (Number) default = 1
// options.allow (Number) default = 1
// options.consistency (string) A hint to some SPIs about how to distribute quota around
// options.bufferSize (Number) optional, use a memory buffer up to bufferSize to hold quota elements
// options.bufferTimeout (Number) optional, flush the buffer every Number ms
//    (default: 5000ms for minute, 60000ms for others)

function Quota(Spi, o) {
  var options = _.extend({}, o) || {};
  options.timeUnit = o.timeUnit || 'minute';
  options.interval = checkNumber(o.interval, 'interval') || 1;
  options.allow = checkNumber(o.allow, 'allow') || 1;
  options.rollingWindow = o.rollingWindow || false;
  options.bufferSize = checkNumber(o.bufferSize, 'bufferSize') || 0;

  if (TimeUnits.indexOf(options.timeUnit) < 0) {
    throw new Error(util.format('Invalid timeUnit %s', options.timeUnit));
  }

  if (options.bufferSize) {
    options.bufferTimeout = checkNumber(o.bufferTimeout, 'bufferTimeout');
  }

  if ('minute' === options.timeUnit) {
    options.timeInterval = MINUTE;
    if (options.bufferSize && !options.bufferTimeout) { options.bufferTimeout = 5000; }
  } else if ('hour' === options.timeUnit) {
    options.timeInterval = HOUR;
  } else if ('day' === options.timeUnit) {
    options.timeInterval = DAY;
  } else if ('week' === options.timeUnit) {
    options.timeInterval = WEEK;
  } else if ('month' === options.timeUnit) {
    options.timeInterval = MONTH;
  }

  if (options.bufferSize && !options.bufferTimeout) { options.bufferTimeout = MINUTE; }

  if (options.startTime) {
    if (options.timeInterval === MONTH) {
      throw new Error('start time not allowed for month time units');
    }
    if (typeof options.startTime === 'string') {
      options.startTime = new Date(options.startTime).getTime();
    } else if (options.startTime instanceof Date) {
      options.startTime = options.startTime.getTime();
    }
    if (isNaN(options.startTime) || typeof options.startTime !== 'number') {
      throw new Error(util.format('Invalid start time %s', options.startTime));
    }
  }

  this.options = options;
  var spi = new Spi(options);
  if (options.bufferSize > 0) {
    var Buffer = require('./memory_buffer');
    this.quota = Buffer.create(spi, options);
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
    return cb(new Error('key must be set'));
  }
  if (typeof options.identifier !== 'string') {
    return cb(new Error('key must be a string'));
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

function checkNumber(val, name) {
  if (!val) { return undefined; }
  if (typeof val === 'string') {
    var int = parseInt(val, 10);
    if (!isNaN(int)) { return int; }
  }
  else if (typeof val === 'number') {
    return val;
  }
  throw new Error(util.format('%s must be a number', name));
}
