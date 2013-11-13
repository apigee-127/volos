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

// apigee-cache
//
// This is a basic caching library, which can be used by a number of higher-level modules.

/*
 * This module implements the runtime SPI by storing data in redis.
 *
 * options:
 *   host:    redis host (optional, default = 127.0.0.1)
 *   port:    redis port (optional, default = 6379)
 *   options: redis options (optional, default = { return_buffers: true }) - note: will force return_buffers: true
 */

/*
 schema:
 volos:cache:name:key -> value
 */

var redis = require("redis");

var DEFAULT_ENCODING = 'utf8';
var DEFAULT_TTL = 300;
var KEY_PREFIX = 'volos:cache';

function getCache(name, o) {

  var options = o || {};
  options.options = options.options || {};
  options.options.return_buffers = true;
  return new Cache(name, options);
}
exports.getCache = getCache;

function Cache(name, options) {
  if (!(this instanceof Cache)) {
    return new Cache(name, options);
  }

  var host = options.host || '127.0.0.1';
  var port = options.port || 6379;
  var ropts = options.options || {};
  this.client = redis.createClient(port, host, ropts);

  this.defaultTtl = options.defaultTtl ? convertNumber(options.defaultTtl, 'defaultTtl') : DEFAULT_TTL;
  this.name = name;
}

function validateKey(key) {
  if (!key) {
    throw new Error('key is required');
  }
  if (typeof key !== 'string') {
    throw new Error('key must be a string');
  }
}

function convertValue(value, encoding) {
  if (typeof value === 'string') {
    return new Buffer(value, encoding);
  } else if (value instanceof Buffer) {
    return value;
  } else {
    throw new Error('value must be a string or a Buffer');
  }
}

function convertNumber(value, name) {
  if (typeof value === 'string') {
    return parseInt(value, 10);
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(name + ' must be a string or a number');
  }
}

// Set the text encoding for values retrieved from the cache. The value will be returned as a string
// in the specified encoding. If this function is never called, then values will always be returned as buffers.
Cache.prototype.setEncoding = function(encoding) {
  this.encoding = encoding;
};

// Retrieve the element from cache and return as the second argument to "callback". (First argument is
// the error, or undefined if there is no error). It is an error to call this with no callback.
// If "setEncoding" was previously called on this cache, then the value will be returned as a string
// in the specified encoding. Otherwise, a Buffer will be returned.
Cache.prototype.get = function(key, callback) {
  validateKey(key);
  if (!callback) { throw new Error('callback is required'); }
  if (typeof callback !== 'function') { throw new Error('callback must be a function'); }

  var self = this;
  this.client.get(this._key(key), function(err, reply) {
    if (reply && self.encoding) {
      reply = reply.toString(self.encoding);
    }

    callback(undefined, reply);
  });
};

// Set "value" in the cache under "key". "options" is optional and implementation-dependent.
// If callback is supplied, call it when the set is complete, passing the error as the first
// argument if there is one. If "value" is a string, then it will be converted to a buffer
// using the encoding field set in "options," or "utf8" otherwise.
Cache.prototype.set = function(key, v, o, c) {
  validateKey(key);

  var callback;
  var options;

  if (!o) {
    options = {};
  } else if (typeof o === 'function') {
    options = {};
    callback = o;
  } else {
    if (typeof c !== 'function') {
      throw new Error('callback must be a function');
    }
    options = o;
    callback = c;
  }

  var value = convertValue(v, options.encoding);
  var ttl = options.ttl ? convertNumber(options.ttl, 'ttl') : this.defaultTtl;

  this.client.setex(this._key(key), ttl, value, function(err, reply) {
    return callback ? callback(err, reply) : null;
  });
};

// Remove "key" from the cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.delete = function(key, callback) {
  validateKey(key);
  this.client.del(this._key(key), function(err, reply) {
    return callback ? callback(err, reply) : null;
  });
};

// Clear the entire cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.clear = function(callback) {
  this.client.keys(this._key('*'), function(err, reply) {
    if (err) { return callback ? callback(err, reply) : null; }
    var multi = this.client.multi();
    for (var i = 0; i < reply.length; i++) {
      multi.del(reply[i]);
    }
    multi.exec(callback);
  });
};

Cache.prototype._key = function(key) {
  return KEY_PREFIX + ':' + this.name + ':' + key;
};
