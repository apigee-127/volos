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

var _ = require('underscore');
var assert = require('assert');
var Quota = require('volos-quota-common');
var redis = require("redis");
var KEY_PREFIX = "volos:quota:";

/*
 * This is a quota implementation that uses buckets in Redis. Each quota bucket is simply
 * an object with a ttl.
 */

/*
 schema:
 volos:quota:identifier -> count
 */

var create = function(options) {
  return new Quota(RedisQuotaSpi, options);
};
module.exports.create = create;


function RedisQuotaSpi(options) {
  this.options = options;
  this.buckets = {};

  assert(options.timeInterval);
  if (options.startTime) {
    assert.equal(typeof options.startTime, 'number');
  }

  var host = options.host || '127.0.0.1';
  var port = options.port || 6379;
  var db = options.db || 0;
  var ropts = _.extend({}, options.options) || {};
  this.client = redis.createClient(port, host, ropts);
  this.client.select(db);
}

RedisQuotaSpi.prototype.destroy = function() {
  clearTimeout(this.timer);
};

RedisQuotaSpi.prototype.apply = function(options, cb) {
  var self = this;
  var key = KEY_PREFIX + options.identifier;

  // Atomic check for (a) if the key exists, and (b) how long until it expires.
  self.client.ttl(key, function(err, ttl) {
    if (err) { return cb(err, null); }

    if (ttl < 0) {
      // -2 means the key does not exist.
      // -1 means the key exists but is set never to expire.
      // In either case, we need to create a new, expiring key.
      var now = Date.now();
      ttl = self.calculateExpiration(now) - now;
      if (ttl < 1000) {
        // Any created record would immediately expire, so skip that step.
        returnResult(ttl, options.weight);
      } else {
        // Atomically set the key and its expiry time.
        self.client.setex(key, (ttl / 1000) >> 0, options.weight, function(err) {
          if (err) { return cb(err, null); }

          returnResult(ttl, options.weight);
        });
      }
    } else {
      // The key exists - increment it
      // In theory, Redis may have deleted the key in the meantime. In that case,
      // this creates a new key with no expiry date. Fortunately, the ttl check
      // above will ignore the new entry.
      self.client.incrby(key, options.weight, function(err, count) {
        if (err) { return cb(err, null); }

        returnResult(ttl * 1000, count);
      });
    }
  });

  function returnResult(ttl, count) {
    var allow = options.allow || self.options.allow;

    var result = {
      allowed: allow,
      used: count,
      isAllowed: (count <= allow),
      expiryTime: ttl
    };
    cb(undefined, result);
  }

};

// Separate this out for white-box unit testing

RedisQuotaSpi.prototype.calculateExpiration = function(now) {
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
