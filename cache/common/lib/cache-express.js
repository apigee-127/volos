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

function CacheExpress(cache, options) {
  if (!(this instanceof CacheExpress)) {
    return new CacheExpress(cache, options);
  }

  this.internalCache = cache;
  this.options = options || {};
}
module.exports = CacheExpress;

// only caches "GET" requests
// id (optional) may be a string or a function that takes the request and generates a string id
CacheExpress.prototype.cache = function(id) {
  var self = this;
  var options = {
    ttl: this.internalCache.options.ttl
  };
  return function(req, resp, next) {
    if (_.isFunction(id)) { id = id(req); }
    var key = id ? id : req.originalUrl;
    debug('Cache check');
    if (req.method === 'GET') {
      self.internalCache.get(key, function(err, reply) {
        if (err) { console.log('Cache error: ' + err); }
        resp.setHeader('Cache-Control', "public, max-age=" + Math.floor(options.ttl / 1000) + ", must-revalidate");
        if (reply) {
          if (debugEnabled) { debug('cache hit: ' + key); }
          var len = reply.readUInt8(0);
          var contentType = reply.toString('utf8', 1, len + 1);
          var content = reply.toString('utf8', len + 1);
          if (contentType !== '') { resp.setHeader('Content-Type', contentType); }
          resp._fromCache = true; // avoid double caching
          return resp.send(content);
        } else {
          if (debugEnabled) {
            debug('cache miss: ' + key);
          }

          var didWrite = false; // if multiple writes attempted, dumps cache

          // replace write() to intercept the content sent to the client
          resp._v_write = resp.write;
          resp.write = function (chunk, encoding) {
            resp._v_write(chunk, encoding);
            if (chunk) {
              if (didWrite) {
                self.internalCache.delete(key);
              } else {
                didWrite = true;
                var contentType = resp._headers['content-type'] || '';
                cache(self, key, options, contentType, chunk);
              }
            }
          };

          // replace end() to intercept the content returned to the client
          if (!didWrite) {
            var end = resp.end;
            resp.end = function (chunk, encoding) {
              resp.end = end;
              if (chunk && !resp._fromCache) { // avoid double caching
                resp.on('finish', function () {
                  var contentType = resp._headers['content-type'] || '';
                  cache(self, key, options, contentType, chunk);
                });
              }
              resp.end(chunk, encoding);
            };
            return next();
          }
        }
      });
    } else {
      return next();
    }
  };
};

function cache(self, key, options, contentType, chunk) {
  chunk = chunk.toString();
  var size = chunk.length + contentType.length + 1;
  var buffer = new Buffer(size);
  buffer.writeUInt8(contentType.length.valueOf(), 0);
  buffer.write(contentType, 1);
  buffer.write(chunk, contentType.length + 1);
  self.internalCache.set(key, buffer, options, function (err) {
    if (err) {
      console.log('Cache error: ' + err);
    } else if (debugEnabled) {
      debug('Cached: ' + key);
    }
  });
}
