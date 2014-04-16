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
var debug;
var debugEnabled;
if (process.env.NODE_DEBUG && /cache/.test(process.env.NODE_DEBUG)) {
  debug = function(x) {
    console.log('Quota: ' + x);
  };
  debugEnabled = true;
} else {
  debug = function() { };
}

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

    handle('request', function(env, next) {
      var req = env.request;
      if (req.method === 'GET') {
        var resp = env.response;
        if (_.isFunction(id)) { id = id(req); }
        var key = id ? id : req.url;

        debug('Cache check');
        self.internalCache.get(key, function (err, reply) {
          if (err) { console.log('Cache error: ' + err); }
          resp.setHeader('Cache-Control', "public, max-age=" + Math.floor(options.ttl / 1000) + ", must-revalidate");
          if (reply) {
            if (debugEnabled) { debug('cache hit: ' + key); }
            var len = reply.readUInt8(0);
            var contentType = reply.toString('utf8', 1, len + 1);
            var content = reply.toString('utf8', len + 1);
            resp.setHeader('Content-Type', contentType);
            resp.body = content;
            env.argo._routed = true; // bypass further pipeline processing
            resp.from_cache = true; // avoid double caching
          } else {
            if (debugEnabled) { debug('cache miss: ' + key); }
          }
        });
      }
      return next(env);
    });

    handle('response', function(env, next) {
      var req = env.request;
      var resp = env.response;
      if (req.method === 'GET' && !resp.from_cache) { // avoid double caching
        if (_.isFunction(id)) { id = id(req); }
        var key = id ? id : req.url;

        // replace end() to intercept the content returned to the client
        var end = resp.end;
        resp.end = function(chunk, encoding) {
          resp.end = end;
          var contentType = resp._headers['content-type'];
          var size = chunk.length + contentType.length + 1;
          var buffer = new Buffer(size);
          buffer.writeUInt8(contentType.length.valueOf(), 0);
          buffer.write(contentType, 1);
          buffer.write(chunk, contentType.length + 1);
          self.internalCache.set(key, buffer, options, function(err) {
            if (err) {
              console.log('Cache error: ' + err);
            } else if (debugEnabled) {
              debug('Cached: ' + key);
            }
          });
          resp.end(chunk, encoding);
        };
      }
      return next(env);
    });
  };
};
