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
var querystring = require('querystring');
var url = require('url');

var debugEnabled;
var debug;
if (process.env.NODE_DEBUG && /quota/.test(process.env.NODE_DEBUG)) {
  debug = function(x) {
    console.log('Quota: ' + x);
  };
  debugEnabled = true;
} else {
  debug = function() { };
}

function QuotaArgo(quota, options) {
  if (!(this instanceof QuotaArgo)) {
    return new QuotaArgo(quota, options);
  }

  this.quota = quota;
  this.options = options || {};
}
module.exports = QuotaArgo;


QuotaArgo.prototype.apply = function(id, weight, env, next) {
  var options = {
    identifier: id,
    weight: weight
  };
  var self = this;
  self.quota.apply(
    options,
    function(err, reply) {
      if (err) {
        if (debugEnabled) { debug('Quota apply error: ' + err); }
        env.response.statusCode = 500;
        env.response.body = { error: 'error applying quota' };
      }
      if (!reply.isAllowed) {
        if (debugEnabled) { debug('Quota exceeded: ' + id); }
        env.response.statusCode = 403;
        env.response.body = { error: 'exceeded quota' };
      }
      next();
    }
  );
};

QuotaArgo.prototype.applyPerAddress = function(id, weight, env, next) {
  var options = {
    identifier: id,
    weight: weight
  };
  var self = this;
  var remoteAddress = (env.request.headers['x-forwarded-for'] || '').split(',')[0] || env.request.connection.remoteAddress;
  options.identifier = id + '/' + remoteAddress;
  if (debugEnabled) { debug('Quota check: ' + options.identifier); }
  self.quota.apply(
    options,
    function(err, reply) {
      if (err) {
        if (debugEnabled) { debug('Quota apply error: ' + err); }
        env.response.statusCode = 500;
        env.response.body = { error: 'error applying quota' };
      }
      if (!reply.isAllowed) {
        if (debugEnabled) { debug('Quota exceeded: ' + options.identifier); }
        env.response.statusCode = 403;
        env.response.body = { error: 'exceeded quota' };
      }
      next();
    }
  );
};


QuotaArgo.prototype.authorize = function(env, next) {
  debug('Argo authorize');

  var self = this;
  var auth = function(params, env, next) {
    self.oauth.authorize(params, function(err, result) {
      if (err) {
        if (debugEnabled) {
          debug('Authorization error: ' + err);
        }
        makeError(err, env);
      } else {
        env.response.statusCode = 302;
        env.response.setHeader('Location', result);
      }
      env._oauthAuthenticated = true;
      next(env);
    });
  }

  if (env.request.method === 'GET') {
    var params = url.parse(env.request.url, true).query;
    auth(params, env, next);
  } else {
    env.request.getBody(function(err, body) {
      var params = querystring.parse(body.toString());
      auth(params, env, next);
    });
  }
};
