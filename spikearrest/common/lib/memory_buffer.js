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

var _ = require('underscore');
var debug = require('debug')('spikearrest');

// todo: use a better queue structure for buffer
// todo: can we avoid creating a bucket for the non-buffered case?

// options.timeUnit ("second", "minute") default = second
// options.allow (Number) default = 1
// options.timeInterval (Number) number of seconds in the timeUnit
// options.windowSize (Number) number of ms per apply
// options.bufferSize (Number) number of ms per apply

var create = function(spi, options) {
  return new MemoryBuffer(spi, options);
};
module.exports.create = create;

function MemoryBuffer(spi, options) {
  this.spi = spi;
  this.options = options;

  this.keys = {};
}

MemoryBuffer.prototype.apply = function(options, cb) {
  var now = Date.now();

  var bucket = this.keys[options.key];
  if (!bucket) {
    bucket = { buffer: [] };
    this.keys[options.key] = bucket;
  }
  debug('applying: %j to bucket: %j', options, bucket);

  if (bucket.buffer.length >= this.options.bufferSize) { // just fail
    var result = {
      allowed: options.allow || this.options.allow,
      used: bucket.buffer.length,
      isAllowed: false,
      expiryTime: (now - bucket.nextWindow) + (options.timeInterval * this.buffer.length) // kinda
    };
    return cb(null, result);
  }

  if (this.applying || now < bucket.nextWindow) {
    this.buffer(bucket, options, now, cb);
  } else {
    bucket.nextWindow = now + this.options.windowSize;
    this.internalApply(bucket, new BufferItem(options, cb));
  }
};

MemoryBuffer.prototype.buffer = function(bucket, options, now, cb) {
  bucket.buffer.push(new BufferItem(options, cb));
  this.scheduleBuffer(bucket, now);
};

MemoryBuffer.prototype.scheduleBuffer = function(bucket, now) {
  var self = this;
  if (!bucket.applying && bucket.buffer.length > 0) {
    setTimeout(function() {
      var item = bucket.buffer.pop();
      if (item) { self.internalApply(bucket, item); }
    }, bucket.nextWindow - now);
  }
};

MemoryBuffer.prototype.internalApply = function(bucket, item) {
  bucket.applying = item;
  var self = this;
  this.spi.apply(item.options, function(err, result) {
    var now = Date.now();
    bucket.applying = undefined;
    bucket.nextWindow = now + result.expiryTime;
    self.scheduleBuffer(bucket, now);
    if (result.isAllowed) {
      item.cb(err, result);
    } else {
      self.buffer(bucket, item.options, now, item.cb);
    }
  });
};

var BufferItem = function(options, cb) {
  this.options = options;
  this.cb = cb;
};
