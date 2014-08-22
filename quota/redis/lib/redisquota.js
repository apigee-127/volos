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
  self.client.incrby(key, options.weight, function(err, count) {
    if (err) { return cb(err, null); }

    var now = Date.now();
    if (count === options.weight) {
      var ttl = self.calculateExpiration(now) - now;
      self.client.expire(key, (ttl / 1000) >> 0);
      returnResult(ttl);
    } else {
      self.client.ttl(key, function(err, ttl) {
        if (err) { return cb(err); }
        returnResult(ttl * 1000);
      });
    }

    function returnResult(ttl) {
      var allow = options.allow || self.options.allow;

      var result = {
        allowed: allow,
        used: count,
        isAllowed: (count <= allow),
        expiryTime: ttl
      };
      cb(undefined, result);
    }
  });
};

// Separate this out for white-box unit testing

RedisQuotaSpi.prototype.calculateExpiration = function(now) {
  assert.equal(typeof now, 'number');

  if (this.options.startTime) {
    // "calendar" start quota -- calculate time until the end of the bucket
    var remaining = (now - this.options.startTime) % this.options.timeInterval;
    return now + this.options.timeInterval - remaining;

  } else {
    // Default quota type -- start counting from now
    return now + this.options.timeInterval;
  }
};
