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

/*
 * This module implements the cache SPI by storing data in Apigee.
 *
 * options: {
 *   ttl:     the default ttl (in ms) to use for cached values (truncated to the nearest lower second, minimum of 1)
 *   encoding: the default string encoding to use for cached values (optional)
 *   fallback: Volos cache module to use if not running on Apigee (eg. volos-cache-memory) (optional)
 * }
 */

/*
 The options may also contain the following Apigee-specific optional parameters:

 resource: The name of an Apigee "cache resource" where the data should be stored. Cache resources are used to
           fine-tune memory allocation and other cache parameters. If not specified, a default resource will be used.
           If the cache resource does not exist, then an error will be thrown. See below for more documentation in this
           feature.

 scope:    Specifies whether cache entries are prefixed to prevent collisions. Valid values are "global", "application,"
           and "exclusive". The default scope is "exclusive."
           exclusive:   Cache entries are only seen by Node.js caches in the same application that have the same name.
           application: Cache entries are seen by all Node.js caches that are part of the same Apigee Edge application.
           global:      Cache entries are seen by all Node.js applications in the same Apigee "environment."

 timeout:  How long to wait to fetch a result from the distributed cache, in seconds. The default 30 seconds.
           Latency-sensitive applications may wish to reduce this in order to prevent slow response times if the cache
           infrastructure is overloaded.

 For information about how to create a cache resource, see the Apigee Edge doc topic Manage Caches for an Environment.
 */

var Common = require('volos-cache-common');
var apigee = require('apigee-access');
var _ = require('underscore');
var debug = require('debug')('apigee');

function create(name, options) {
  return new Common(Cache, name, options);
}
exports.create = create;

function Cache(name, options) {
  if (!(this instanceof Cache)) {
    throw new Error('Do not run directly.');
  }

  var cache;
  if (apigee.getMode() === apigee.APIGEE_MODE) {
    options.defaultTtl = Math.max((options.ttl / 1000) >> 0, 1);
    cache = apigee.getCache(name, options);
    _.extend(cache, monkeyPatch);
  } else if (options.fallback) {
    if (typeof options.fallback === 'string') {
      debug('Apigee cache falling back to %s', options.fallback);
      cache = require(options.fallback).create(name, options);
    } else {
      debug('Apigee cache falling back to specified module');
      cache = options.fallback.create(name, options);
    }
  }
  if (!cache) { throw new Error('Error: Apigee cache not available. Specify "fallback" option to use this cache outside of Apigee.'); }

  return cache;
}

var monkeyPatch = {
  set: function(key, value, options, callback) {
    var ttl = options.ttl ? Math.max((options.ttl / 1000) >> 0, 1) : null;
    this.put(key, value, ttl, callback);
  },

  delete: function(key, callback) {
    this.remove(key, callback);
  }
};

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
  var self = this;
  this.entries.get(key, function(err, value) {
    if (value && self.encoding) {
      value = value.toString(self.encoding);
    }
    callback(err, value);
  });
};

// Set "value" in the cache under "key". "options" is optional and implementation-dependent.
// If callback is supplied, call it when the set is complete, passing the error as the first
// argument if there is one. If "value" is a string, then it will be converted to a buffer
// using the encoding field set in "options" or "utf8" otherwise.
Cache.prototype.set = function(key, value, options, callback) {
  this.entries.set(key, value, options, callback);
};

// Remove "key" from the cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.delete = function(key, callback) {
  this.entries.delete(key, callback);
};

// Not supported by Apigee!
Cache.prototype.clear = function(callback) {
  var err = new Error('clear is not supported');
  if (callback) {
    callback(err);
  } else {
    throw err;
  }
};
