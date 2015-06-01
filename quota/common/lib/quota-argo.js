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

function QuotaArgo(quota, options) {
  if (!(this instanceof QuotaArgo)) {
    return new QuotaArgo(quota, options);
  }

  this.quota = quota;
  this.options = options || {};
}
module.exports = QuotaArgo;


// applies quota and returns (403) error on exceeded
// options contains:
// identifier (optional) may be a string or a function that takes the request and generates a string id
//   if not specified, id will default to the request originalUrl
// weight (optional) may be a number or a function that takes the request and generates a number
QuotaArgo.prototype.apply = function(options, env, next) {
  if (!next) { next = env; env = options; options = undefined; }
  var opts = calcOptions(env.request, options);
  applyQuota(this, opts, env.response, next);
};

// applies quota on a per-caller address basis and returns (403) error on exceeded
// options contains:
// identifier (required, may be null) may be a string or a function that takes the request and generates a string id
//   if not specified, id will be set to the request originalUrl
// weight (optional) may be a number or a function that takes the request and generates a number
//   if weight is specified, id is required (may be null)
QuotaArgo.prototype.applyPerAddress = function(options, env, next) {
  if (!next) { next = env; env = options; options = undefined; }
  var opts = calcOptions(env.request, options);
  var remoteAddress = (env.request.headers['x-forwarded-for'] || '').split(',')[0] || env.request.connection.remoteAddress;
  opts.identifier = opts.identifier + '/' + remoteAddress;
  applyQuota(this, opts, env.response, next);
};


function calcOptions(req, opts) {
  var options = _.extend({}, opts); // clone
  if (_.isFunction(options.identifier)) { options.identifier = options.identifier(req); }
  if (_.isFunction(options.weight)) { options.weight = options.weight(req); }
  if (!options.identifier) { options.identifier = req.url; }
  return options;
}

function applyQuota(self, options, response, next) {
  debug('Quota check: ', options.identifier);
  self.quota.apply(
    options,
    function(err, reply) {
      if (err) {
        debug('Quota apply error: ', err);
        response.statusCode = 500;
        response.body = { error: 'error applying quota' };
        return;
      }
      response.setHeader('X-RateLimit-Limit', reply.allowed);
      response.setHeader('X-RateLimit-Remaining', reply.allowed - reply.used);
      response.setHeader('X-RateLimit-Reset', (reply.expiryTime / 1000) >> 0);
      if (!reply.isAllowed) {
        debug('Quota exceeded:', options.identifier);
        response.statusCode = 403;
        response.body = { error: 'exceeded quota' };
        response.end();
      } else {
        next();
      }
    }
  );
}
