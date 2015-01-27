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

/*
 * This module implements the cache SPI by storing data in Redis -- version 2.6 or greater.
 *
 * options: {
 *   ttl:      the default ttl (in ms) to use for cached values (otherwise, 300ms)
 *   encoding: the default string encoding to use for cached values (optional)
 *   host:    redis host (optional, default = 127.0.0.1)
 *   port:    redis port (optional, default = 6379)
 *   options: redis options (hash, optional) - note: return_buffers will be forced to true
 *  }
 */

/*
 schema:
   volos:cache:name:key -> value
 */

var Common = require('volos-cache-common');
var redis = require('redis');
var _ = require('underscore');

var KEY_PREFIX = 'volos:cache';

function create(name, options) {
  return new Common(Cache, name, options);
}
exports.create = create;

function Cache(name, options) {
  if (!(this instanceof Cache)) {
    throw new Error('Do not run directly.');
  }

  var host = options.host || '127.0.0.1';
  var port = options.port || 6379;
  var db = options.db || 0;
  var ropts = _.extend({}, options.options) || {};
  ropts.return_buffers = true;
  this.client = redis.createClient(port, host, ropts);
  this.client.select(db);
  this.name = name;
}

// Retrieve the element from cache and return as the second argument to "callback". (First argument is
// the error, or undefined if there is no error). It is an error to call this with no callback.
Cache.prototype.get = function(key, callback) {
  var self = this;
  this.client.get(this._key(key), callback);
};

// Set "value" in the cache under "key". "options" is optional and implementation-dependent.
// If callback is supplied, call it when the set is complete, passing the error as the first
// argument if there is one.
Cache.prototype.set = function(key, value, options, callback) {
  this.client.psetex(this._key(key), options.ttl, value, function(err, reply) {
    return callback ? callback(err, reply) : null;
  });
};

// Remove "key" from the cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.delete = function(key, callback) {
  this.client.del(this._key(key), function(err, reply) {
    return callback ? callback(err, reply) : null;
  });
};

// Clear the entire cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.clear = function(callback) {
  var self = this;
  this.client.keys(this._key('*'), function(err, reply) {
    if (err) { return callback ? callback(err, reply) : null; }
    var multi = self.client.multi();
    for (var i = 0; i < reply.length; i++) {
      multi.del(reply[i]);
    }
    multi.exec(callback);
  });
};

Cache.prototype._key = function(key) {
  return KEY_PREFIX + ':' + this.name + ':' + key;
};
