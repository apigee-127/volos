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
 * This module implements the cache SPI by storing data in memory.
 *
 * options: {
 *   ttl:     the default ttl (in ms) to use for cached values (otherwise, 300ms)
 *   encoding: the default string encoding to use for cached values (optional)
 * }
 */

var LRU = require('lru-cache-plus');

var Common = require('volos-cache-common');
var caches = {};

function create(name, options) {
  return new Common(Cache, name, options);
}
exports.create = create;

function Cache(name, options) {
  if (!(this instanceof Cache)) {
    throw new Error('Do not run directly.');
  }

  var entries = caches[name];
  if (!entries) {
    var lruOpts = {};
    lruOpts.maxAge = options.ttl;
    lruOpts.max = options.maxEntries || 1000;
    entries = new LRU(lruOpts);
    caches[name] = entries;
  }

  this.entries = entries;
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
  var value = this.entries.get(key);
  if (value && this.encoding) {
    value = value.toString(this.encoding);
  }

  callback(undefined, value);
};

// Set "value" in the cache under "key". "options" is optional and implementation-dependent.
// If callback is supplied, call it when the set is complete, passing the error as the first
// argument if there is one. If "value" is a string, then it will be converted to a buffer
// using the encoding field set in "options" or "utf8" otherwise.
Cache.prototype.set = function(key, value, options, callback) {
  this.entries.set(key, value, options.ttl);
  if (callback) {
    callback();
  }
};

// Remove "key" from the cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.delete = function(key, callback) {
  this.entries.del(key);
  if (callback) {
    callback();
  }
};

// Clear the entire cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.clear = function(callback) {
  this.entries.reset();
  if (callback) {
    callback();
  }
};
