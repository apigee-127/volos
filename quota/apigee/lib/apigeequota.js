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

/*
 * A quota SPI that uses the Apigee proxy defined in the "proxy" directory. This proxy has
 * a set of API calls that use the Apigee quota policy, and communicate using form-encoded
 * parameters.
 */

var assert = require('assert');
var debug = require('debug')('apigee');
var http = require('http');
var https = require('https');
var Quota = require('volos-quota-common');
var querystring = require('querystring');
var semver = require('semver');
var superagent = require('superagent');
var util = require('util');
var url = require('url');

var apigeeQuota;

try {
  // Older versions of Apigee won't have this, so be prepared to work around.
  var apigee = require('apigee-access');
  apigeeQuota = apigee.getQuota();
} catch (e) {
  debug('Operating without access to apigee-access');
}

var create = function(options) {
  return new Quota(ApigeeQuotaSpi, options);
};
module.exports.create = create;

var ApigeeQuotaSpi = function(options) {
  assert(options.timeUnit);
  assert(options.interval);
  this.options = options;

  if (!apigeeQuota) {
    if (!options.uri) {
      throw new Error('uri parameter must be specified');
    }
    if (!options.key) {
      throw new Error('key parameter must be specified');
    }

    /* TODO
    if (options.startTime) {
      throw new Error('Quotas with a fixed starting time are not supported');
    }
    */

    this.uri = options.uri;
    this.key = options.key;
  }
};

ApigeeQuotaSpi.prototype.apply = function(options, cb) {
  if (this.quotaImpl) {
    this.quotaImpl.apply(options, cb);

  } else {
    var self = this;
    selectImplementation(self, function(err) {
      if (err) {
        cb(err);
      } else {
        self.quotaImpl.apply(options, cb);
      }
    });
  }
};

// Given the state of apigee-access, or the "version" of the remote proxy,
// select an implementation. This happens on the first call so that we can
// "start" the module if the proxy is down -- but this doesn't complete
// until we can get one successful HTTP call through
function selectImplementation(self, cb) {
  var impl;
  if (self.apigeeQuota) {
    impl = new ApigeeAccessQuota(self);
    cb();

  } else {
    var agent = makeAgent(self.options);
    agent.get(self.options.uri + '/v2/version').end(function(err, resp) {
        if (err) {
          cb(err);
        } else {
          if (resp.ok && semver.satisfies(resp.text, '>=1.0.0')) {
            impl = new ApigeeRemoteQuota(self);
            cb();
          } else {
            if (self.options.startTime) {
              cb(new Error('Quotas with a fixed starting time are not supported'));
            } else {
              impl = new ApigeeOldRemoteQuota(self);
              cb();
            }
          }
        }
    });
  }
  self.quotaImpl = impl;
}

function makeNewQuotaRequest(self, opts, allow) {
  var r ={
    identifier: opts.identifier,
    weight: opts.weight,
    interval: self.options.interval,
    allow: allow,
    timeUnit: self.options.timeUnit
  };
  if (opts.startTime) {
    r.startTime = opts.startTime;
    r.quotaType = 'calendar';
  } else {
    r.quotaType = 'rollingwindow';
  }
  return r;
}

function ApigeeAccessQuota(quota) {
  debug('Using apigee-access for native quota');
  this.quota = quota;
}

ApigeeAccessQuota.prototype.apply = function(opts, cb) {
  var allow = opts.allow || this.quota.options.allow;
  var r = makeNewQuotaRequest(this.quota, opts, allow);

  // Result is the same as a volos result
  debug('Local quota request: %j', r);
  this.quota.apigeeQuota.apply(r, function(err, result) {
    if (err) {
      cb(err);
    } else {
      debug('Quota result: %j', result);
      cb(undefined, result);
    }
  });
};

function ApigeeRemoteQuota(quota) {
  debug('Using a remote quota');
  this.quota = quota;
}

ApigeeRemoteQuota.prototype.apply = function(opts, cb) {
  var allow = opts.allow || this.quota.options.allow;
  var r = makeNewQuotaRequest(this.quota, opts, allow);

  debug('Remote quota request: %j', r);
  makeAgent(this.quota.options).
    post(this.quota.options.uri + '/v2/quotas/apply').
    type('json').
    send(r).
    end(function(err, resp) {
      if (err) {
        cb(err);
      } else {
        debug('Quota result: %j', resp);
        cb(undefined, resp);
      }
    });
};

function ApigeeOldRemoteQuota(quota) {
  debug('Using a remote quota with the old protocol');
  this.quota = quota;
}

ApigeeOldRemoteQuota.prototype.apply = function(opts, cb) {
  var allow = opts.allow || this.quota.options.allow;

  var r = {
    identifier: opts.identifier,
    weight: opts.weight,
    interval: this.quota.options.interval,
    allow: allow,
    unit: this.quota.options.timeUnit
  };

  debug('Old remote quota request: %j', r);
  makeAgent(this.quota.options).
    post(this.quota.options.uri + '/quotas/distributed').
    type('form').
    send(r).
    end(function(err, resp) {
      if (err) {
        cb(err);
      } else {
        debug('Quota result: %j', resp);
        cb(undefined, resp);
      }
    });
};

function makeAgent(options) {
  var agent = superagent.agent()
    .set('x-DNA-Api-Key', options.key);
  return agent;
}
