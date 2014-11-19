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

var debug = require('debug')('cache');
var _ = require('underscore');
var encoder = require('./cache-encoder');

function CacheArgo(cache, options) {
  if (!(this instanceof CacheArgo)) {
    return new CacheArgo(cache, options);
  }

  this.internalCache = cache;
  this.options = options || {};
}
module.exports = CacheArgo;

// only caches "GET" requests
// id (optional) may be a string or a function that takes the request and generates a string id
CacheArgo.prototype.cache = function(id) {
  var self = this;
  var options = {
    ttl: this.internalCache.options.ttl
  };

  return function(handle) {

    var handler = function(env, next) {
      var req = env.request;
      var resp = env.response;
      var key;
      if (_.isFunction(id)) {
        key = id(req);
        if (key === undefined || key === null) {
          return next(env);
        }
      } else {
        key = id ? id : req.url;
      }
      req._key = key;

      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        self.internalCache.delete(key);
      }
      if (req.method !== 'GET') { return next(env); }

      var getSetCallback = function(err, buffer, fromCache) {
        if (err) { console.log('Cache error: ' + err); }

        if (buffer && fromCache) {
          if (debug.enabled) { debug('cache hit: ' + key); }
          encoder.setFromCache(buffer, resp);
        }
      };

      var populate = function(key, cb) {
        if (debug.enabled) { debug('cache miss: ' + key); }
        var doCache, content, headers;

        var addChunk = function(chunk) {
          if (Buffer.isBuffer(content) && Buffer.isBuffer(chunk)) {
            content = Buffer.concat([content, chunk]);
            doCache = true;
          } else {
            debug('multiple non-Buffer writes, not caching');
            doCache = false;
          }
        };

        // replace write() to intercept the content sent to the client
        resp._v_write = resp.write;
        resp.write = function(chunk, encoding) {
          resp._v_write(chunk, encoding);
          if (chunk) {
            if (content) {
              addChunk(chunk);
            } else {
              doCache = true;
              headers = resp._headers;
              content = chunk;
            }
          }
        };

        // replace end() to intercept the content returned to the client
        var end = resp.end;
        resp.end = function(chunk, encoding) {
          resp.end = end;
          if (chunk) {
            if (content) {
              addChunk(chunk, content);
            } else {
              resp.on('finish', function() {
                doCache = true;
                headers = resp._headers;
                content = chunk;
              });
            }
          }
          resp.end(chunk, encoding);

          if (!doCache) { headers = content = null; }
          encoder.cache(resp.statusCode, headers, content, cb);
        };

        return next();
      };

      resp.setHeader('Cache-Control', "public, max-age=" + Math.floor(options.ttl / 1000) + ", must-revalidate");
      self.internalCache.getSet(key, populate, options, getSetCallback);
    };

    if (_.isFunction(handle)) {
      handle('request', handler);
    } else {
      handler.apply(this, arguments);
    }
  };
};
