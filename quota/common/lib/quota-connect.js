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
var debug = require('debug')('quota');

function QuotaConnect(quota, options) {
  if (!(this instanceof QuotaConnect)) {
    return new QuotaConnect(quota, options);
  }

  this.quota = quota;
  this.options = options || {};
}
module.exports = QuotaConnect;

// applies quota and returns (403) error on exceeded
// options contains:
// key (optional) may be a string or a function that takes the request and generates a string id
//  note: for backward compatibility, 'identifier' may also be used
//   if not specified, id will default to the request originalUrl
// weight (optional) may be a number or a function that takes the request and generates a number
QuotaConnect.prototype.apply = function(options) {
  var self = this;
  return function(req, resp, next) {
    var opts = calcOptions(req, options);
    applyQuota(self, opts, resp, next);
  };
};

// applies quota on a per-caller address basis and returns (403) error on exceeded
// options contains:
// key (required, may be null) may be a string or a function that takes the request and generates a string id
//  note: for backward compatibility, 'identifier' may also be used
//   if not specified, key will be set to the request originalUrl
// weight (optional) may be a number or a function that takes the request and generates a number
//   if weight is specified, id is required (may be null)
QuotaConnect.prototype.applyPerAddress = function(options) {
  var self = this;
  return function(req, resp, next) {
    var opts = calcOptions(req, options);
    var remoteAddress = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.connection.remoteAddress;
    opts.identifier = opts.identifier + '/' + remoteAddress;
    if (debug.enabled) { debug('Quota check: ' + opts.identifier); }
    applyQuota(self, opts, resp, next);
  };
};

function calcOptions(req, opts) {
  var options = _.extend({}, opts); // clone
  if (_.isFunction(options.key)) { options.key = options.key(req); }
  if (_.isFunction(options.identifier)) { options.identifier = options.identifier(req); }
  if (_.isFunction(options.weight)) { options.weight = options.weight(req); }
  if (!options.identifier) { options.identifier = req.originalUrl; }
  return options;
}

function applyQuota(self, options, resp, next) {
  if (debug.enabled) { debug('Quota check: ' + options.identifier); }
  self.quota.apply(
    options,
    function(err, reply) {
      if (err) { return next(err); }
      resp.setHeader('X-RateLimit-Limit', reply.allowed);
      resp.setHeader('X-RateLimit-Remaining', reply.allowed - reply.used);
      resp.setHeader('X-RateLimit-Reset', (reply.expiryTime / 1000) >> 0);
      if (!reply.isAllowed) {
        if (debug.enabled) { debug('Quota exceeded: ' + options.identifier); }
        resp.statusCode = 403;
        err = new Error('exceeded quota');
        err.status = 403;
      }
      next(err);
    }
  );
}
