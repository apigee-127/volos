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

var DEFAULT_ENCODING = 'utf8';
var DEFAULT_TTL = 300;

var caches = {};

function getCache(name, o) {

  var options = o;
  if (!options) {
    options = {};
  }

  var entries = caches[name];
  if (!entries) {
    entries = {};
    caches[name] = entries;
  }
  return new Cache(options, entries);
}
exports.getCache = getCache;

function Cache(options, entries) {
  if (!(this instanceof Cache)) {
    return new Cache(options);
  }

  this.defaultTtl = options.defaultTtl ? convertNumber(options.defaultTtl, 'defaultTtl') : DEFAULT_TTL;
  this.entries = entries;
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
  if (!callback) {
    throw new Error('callback is required');
  }
  if (typeof callback !== 'function') {
    throw new Error('callback must be a function');
  }

  var entry = this.entries[key];
  var value;
  if (entry) {
    if (Date.now() > entry.expiration) {
      delete this.entries[key];
    } else if (this.encoding) {
      value = entry.value.toString(this.encoding);
    } else {
      value = entry.value;
    }
  }

  callback(undefined, value);
};

// Set "value" in the cache under "key". "options" is optional and implementation-dependent.
// If callback is supplied, call it when the set is complete, passing the error as the first
// argument if there is one. If "value" is a string, then it will be convered to a buffer
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
  options.ttl = options.ttl ? convertNumber(options.ttl, 'ttl') : this.defaultTtl;

  var entry = new Entry(value, Date.now() + options.ttl);
  this.entries[key] = entry;
  if (callback) {
    callback();
  }
};

// Remove "key" from the cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.delete = function(key, callback) {
  validateKey(key);
  delete this.entries[key];
  if (callback) {
    callback();
  }
};

// Clear the entire cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.clear = function(callback) {
  // Since cache entries are shared, we can't just let them get GCed -- we have to go through and clean up.
  for (var e in this.entries) {
    if (this.entries.hasOwnProperty(e)) {
      delete this.entries[e];
    }
  }
  if (callback) {
    callback();
  }
};

function Entry(value, expiration) {
  if (!(this instanceof Entry)) {
    return new Entry();
  }

  this.value = value;
  this.expiration = expiration;
}



