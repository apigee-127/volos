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

var SpikeArrest = require('volos-spikearrest-common');

// options.timeUnit ('second', 'minute') default = second
// options.allow (Number) default = 1
// options.bufferSize (Number) optional, use a memory buffer up to bufferSize to hold elements
var create = function(options) {
  return new SpikeArrest(MemorySpikeArrestSpi, options);
};
module.exports.create = create;


// options.windowSize (Number) number of ms per apply
// options.timeInterval (Number) number of seconds in the timeUnit
function MemorySpikeArrestSpi(options) {
  this.options = options;
  this.keys = {};
  setInterval(function cleanup() {

  }, 10000);

}

// options.key (Non-object)
// options.weight (Number) default = 1
MemorySpikeArrestSpi.prototype.apply = function(options, cb) {
  var now = Date.now();

  var allowed = true;
  var bucket = this.keys[options.key];
  if (!bucket) { bucket = {}; this.keys[options.key] = bucket; }

  if (now < bucket.windowExpires) {
    bucket.used = bucket.used + options.weight || options.weight;
    allowed = false;
  } else {
    this.keys[options.key] = bucket;
    bucket.windowExpires = now + (options.weight * this.options.windowSize);
    bucket.used = options.weight;
  }

  var result = {
    allowed: options.allow || this.options.allow,
    used: bucket.used,
    isAllowed: allowed,
    expiryTime: bucket.windowExpires - now
  };
  cb(undefined, result);
};

// todo: add a periodic cleanup
