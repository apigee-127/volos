// apigee-cache
//
// This is a basic caching library, that uses the service locator framework to find an SPI.

var services = require('apigee-services');

var CACHE_SERVICE = 'CacheService';
var DEFAULT_ENCODING = 'utf8';
var DEFAULT_TTL = 300;

var caches = {};

function getCache(name, o) {

  var options = o;
  if (!options) {
    options = {};
  }

  var provider = caches[name];
  if (!provider) {
    var providerModule = services.locate(CACHE_SERVICE, options.provider);
    if (!providerModule) {
      throw new Error('No service providers available for ' + CACHE_SERVICE);
    }
    provider = providerModule.createCache(options);
    caches[name] = provider;
  }

  return new Cache(options, provider);
}
exports.getCache = getCache;

function Cache(options, provider) {
  if (!(this instanceof Cache)) {
    return new Cache(options, provider);
  }

  this.defaultTtl = options.defaultTtl ? convertNumber(options.defaultTtl, 'defaultTtl') : DEFAULT_TTL;

  this.provider = provider;
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
    return parseInt(value);
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

  var self = this;
  this.provider.get(key, function(err, r) {
    var result;
    if (r) {
      result = self.encoding ? r.toString(self.encoding) : r;
    }
    callback(err, result);
  });
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

  this.provider.set(key, value, options, function(err) {
    if (callback) {
      callback(err);
    }
  });
};

// Remove "key" from the cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.delete = function(key, callback) {
  validateKey(key);
  this.provider.delete(key, function(err) {
    if (callback) {
      callback(err);
    }
  });
};

// Clear the entire cache. If callback is supplied, call it when delete is complete with
// the error as the first element.
Cache.prototype.clear = function(callback) {
  this.provider.clear(function(err) {
    if (callback) {
      callback(err);
    }
  });
};

// Global setup -- register the default service provider

var defaultProvider = require('./defaultprovider.js');
services.register(CACHE_SERVICE, 'default', defaultProvider);


