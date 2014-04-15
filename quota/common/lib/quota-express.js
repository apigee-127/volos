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
if (process.env.NODE_DEBUG && /quota/.test(process.env.NODE_DEBUG)) {
  debug = function(x) {
    console.log('Quota: ' + x);
  };
  debugEnabled = true;
} else {
  debug = function() { };
}

function QuotaExpress(quota, options) {
  if (!(this instanceof QuotaExpress)) {
    return new QuotaExpress(quota, options);
  }

  this.quota = quota;
  this.options = options || {};
}
module.exports = QuotaExpress;

QuotaExpress.prototype.apply = function(id, weight) {
  var options = {
    identifier: id,
    weight: weight
  };
  var self = this;
  return function(req, resp, next) {
    debug('Quota check');
    self.quota.apply(
      options,
      function(err, reply) {
        if (err) { return next(err); }
        if (!reply.isAllowed) {
          if (debugEnabled) { debug('Quota exceeded: ' + id); }
          resp.statusCode = 403;
          return resp.end(JSON.stringify({ error: 'exceeded quota' }));
        }
        next();
      }
    );
  };
};

QuotaExpress.prototype.applyPerAddress = function(id, weight) {
  var options = {
    identifier: id,
    weight: weight
  };
  var self = this;
  return function(req, resp, next) {
    var remoteAddress = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.connection.remoteAddress;
    options.identifier = id + '/' + remoteAddress;
    if (debugEnabled) { debug('Quota check: ' + options.identifier); }
    self.quota.apply(
      options,
      function(err, reply) {
        if (err) { return next(err); }
        if (!reply.isAllowed) {
          resp.statusCode = 403;
          return resp.end(JSON.stringify({ error: 'exceeded quota' }));
        }
        next();
      }
    );
  };
};
