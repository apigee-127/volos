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
'use strict';

var assert = require('assert');

var Quota = require('volos-quota-common');

/*
 * This is a quota implementation that uses buckets in memory. Each quota bucket is simply
 * an object with an expiration time.
 */

var create = function(options) {
  return new Quota(MemoryQuotaSpi, options);
};
module.exports.create = create;


function MemoryQuotaSpi(options) {
  this.options = options;
  this.buckets = {};

  assert(options.timeInterval);
  if (options.startTime) {
    assert.equal(typeof options.startTime, 'number');
  }

  var self = this;
  this.timer = setInterval(function() {
    trimTokens(self);
  }, options.timeInterval);
}

MemoryQuotaSpi.prototype.destroy = function() {
  clearTimeout(this.timer);
};

MemoryQuotaSpi.prototype.apply = function(options, cb) {
  var bucket = this.buckets[options.identifier];
  var now = Date.now();

  if (!bucket) {
    bucket = {
      count: 0,
      expires: this.calculateExpiration(now)
    };
    this.buckets[options.identifier] = bucket;
  }

  if (now > bucket.expires) {
    // Quota bucket has expired. The timer also runs but only periodically
    bucket.count = 0;
    bucket.expires = this.calculateExpiration(now);
  }

  bucket.count += options.weight;

  var allow = options.allow || this.options.allow;

  var result = {
    allowed: allow,
    used: bucket.count,
    isAllowed: (bucket.count <= allow),
    expiryTime: bucket.expires - now
  };
  cb(undefined, result);
};

// Separate this out for white-box unit testing

MemoryQuotaSpi.prototype.calculateExpiration = function(now) {
  assert.equal(typeof now, 'number');

  if (this.options.startTime) {
    // "calendar" start quota -- calculate time until the end of the bucket
    var remaining = (now - this.options.startTime) % this.options.timeInterval;
    return now + this.options.timeInterval - remaining;

  } else {

    if ('month' === this.options.timeUnit) {

      var date = new Date(now);
      return new Date(date.getFullYear(), date.getMonth() + 1, 1) - 1; // last ms of this month

    } else {

      // Default quota type -- start counting from now
      return now + this.options.timeInterval;
    }
  }
};

/*
 * Quotas always obey their expiration times (which prevents us from having to register a huge
 * number of individual timeouts) but we still want to periodically clean them up to prevent memory
 * issues. This job runs once per time interval (minute, hour, day, or week) and removes expired tokens.
 */
function trimTokens(self) {
  var now = Date.now();
  for (var b in Object.keys(self.buckets)) {
    if (now > b.expires) {
      delete self.buckets.b;
    }
  }
}
