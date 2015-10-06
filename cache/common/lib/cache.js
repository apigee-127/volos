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
var DEFAULT_TTL = 300;
var EM = require('events').EventEmitter;
var eventEmitter = new EM();
eventEmitter.setMaxListeners(100);

function Cache(Spi, name, options) {
  if (!options && _.isObject(name)) { // allow name to be passed as part of options
    options = name;
    name = options.name;
    delete(options.name);
  }
  this.name = name;
  this.options = _.extend({}, options) || {};
  this.options.ttl = this.options.ttl ? convertNumber(this.options.ttl, 'ttl') : DEFAULT_TTL;
  this.cache = new Spi(name, this.options);
}
module.exports = Cache;

// Set the text encoding for values retrieved from the cache. The value will be returned as a string
// in the specified encoding. If this function is never called, then values will always be returned as buffers.
Cache.prototype.setEncoding = function(encoding) {
  this.options.encoding = encoding;
};

// Retrieve an element from cache if present and set it using the provided populate function if not.
// This method will also handle the "thundering herd" issue by coordinating waiting for already in-progress getSet()
// requests and population for the same key.
// The populate (key, callback) function must invoke its callback(error, reply) function on completion. If there is an
// error, it must be passed as the first parameter (otherwise undefined or null). Assuming no error, the second
// parameter is the value passed to the cache.
// The options parameter contains any options to be passed as a part of the cache set() function.
// The callback (error, reply, fromCache) function will be called after all processing has completed. It is called
// immediately (fromCache == true) if the cache contains the item. Otherwise, it will be called once the
// populate function has completed.
// If "setEncoding" was previously called on this cache, then the value will be returned as a string
// in the specified encoding. Otherwise, a Buffer will be returned.
// key, populate, and callback are required. options is optional.
Cache.prototype.getSet = function(key, populate, options, callback) {
  validateKey(key);
  if (!callback) { callback = options; options = {}; }
  if (typeof populate !== 'function') { throw new Error('populate must be a function'); }
  if (typeof callback !== 'function') { throw new Error('callback must be a function'); }

  var self = this;
  this.get(key, function(err, reply) {
    if (err || reply) { return callback(err, reply, true); }

    var event = self.name + key;
    if (EM.listenerCount(eventEmitter, event) === 0) {
      eventEmitter.once(event, function(err, reply) {
        callback(err, reply, false); // special case for the populate (fromCache == false)
      });
    } else {
      eventEmitter.once(event, callback);
      return;
    }

    populate(key, function(err, reply) {
      if (err || !reply) { return eventEmitter.emit(event, err, reply); }

      self.set(key, reply, options, function(err) {
        if (reply && options.encoding) {
          reply = reply.toString(options.encoding);
        }
        eventEmitter.emit(event, err, reply, true);
      });
    });
  });
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

  var options = this.options;
  this.cache.get(key, function(err, reply) {
    if (reply && options.encoding) {
      reply = reply.toString(options.encoding);
    }
    callback(err, reply);
  });
};

// Set "value" in the cache under "key". "options" is optional and implementation-dependent.
// If callback is supplied, call it when the set is complete, passing the error as the first
// argument if there is one. If "value" is a string, then it will be converted to a buffer
// using the encoding field set in "options" or "utf8" otherwise.
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
    if (c && typeof c !== 'function') {
      throw new Error('callback must be a function');
    }
    options = o;
    callback = c;
  }

  try {
    var value = convertValue(v, options.encoding);
  } catch (err) {
    if (callback) {
      return callback(err);
    } else {
      throw err;
    }
  }
  options.ttl = options.ttl ? convertNumber(options.ttl, 'ttl') : this.options.ttl;

  this.cache.set(key, value, options, callback);
};

// Remove "key" from the cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.delete = function(key, callback) {
  validateKey(key);
  this.cache.delete(key, callback);
};

// Clear the entire cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.clear = function(callback) {
  this.cache.clear(callback);
};

Cache.prototype.connectMiddleware = function(options) {
  var mw = require('./cache-connect');
  return new mw(this, options);
};

Cache.prototype.expressMiddleware = Cache.prototype.connectMiddleware;

Cache.prototype.argoMiddleware = function(options) {
  var mw = require('./cache-argo');
  return new mw(this, options);
};

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

