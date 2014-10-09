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

var apigeeAccess;
var hasApigeeAccess;

try {
  // Older versions of Apigee won't have this, so be prepared to work around.
  apigeeAccess = require('apigee-access');
  apigeeAccess.getQuota();
  hasApigeeAccess = true;
} catch (e) {
  debug('Operating without access to apigee-access');
}

var create = function(options) {
  return new Quota(ApigeeQuotaSpi, options);
};
module.exports.create = create;

var ApigeeQuotaSpi = function(options) {
  // Allow users to override use of apigee-access
  if (options.apigeeMode === 'local') {
    debug('Using apigee-access no matter what');
    this.useApigeeAccess = true;
  } else if (options.apigeeMode === 'remote') {
    debug('Using remote apigee proxy no matter what');
    this.useApigeeAccess = false;
  } else {
    this.useApigeeAccess = hasApigeeAccess;
  }

  assert(options.timeUnit);
  assert(options.interval);
  this.options = options;

  if (this.useApigeeAccess) {
    this.apigeeQuota = apigeeAccess.getQuota();
  } else {
    if (!options.uri) {
      throw new Error('uri parameter must be specified');
    }
    if (!options.key) {
      throw new Error('key parameter must be specified');
    }

    this.uri = options.uri;
    this.key = options.key;
  }
};

ApigeeQuotaSpi.prototype.getImplementationName = function(cb) {
  var self = this;
  selectImplementation(self, function(err, impl) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, impl.getImplementationName());
    }
  });
};

ApigeeQuotaSpi.prototype.apply = function(options, cb) {
  var self = this;
  selectImplementation(self, function(err, impl) {
    if (err) {
      cb(err);
    } else {
      impl.apply(options, function(err, result) {
        if (err) {
          debug('Quota error: %j', err);
        } else {
          debug('Quota result: %j', result);
        }
        cb(err, result);
      });
    }
  });
};

// Given the state of apigee-access, or the "version" of the remote proxy,
// select an implementation. This happens on the first call so that we can
// "start" the module if the proxy is down -- but this doesn't complete
// until we can get one successful HTTP call through
function selectImplementation(self, cb) {
  if (self.quotaImpl) {
    cb(undefined, self.quotaImpl);
    return;
  }

  var impl;
  if (self.apigeeQuota) {
    self.quotaImpl = new ApigeeAccessQuota(self);
    cb(undefined, self.quotaImpl);

  } else {
    superagent.agent().
      get(self.options.uri + '/v2/version').
      set('x-DNA-Api-Key', self.options.key).
      end(function(err, resp) {
        if (err) {
          debug('Error getting version: %s', err);
          if (err.code === 'ENOTFOUND') {
            err.message = 'Apigee Remote Proxy not found at: ' + self.uri + '. Check your configuration.';
          }
          cb(err);
        } else {
          if (resp.notFound || (resp.ok && !semver.satisfies(resp.text, '>=1.1.0'))) {
            if (self.options.startTime) {
              cb(new Error('Quotas with a fixed starting time are not supported'));
            } else {
              self.quotaImpl = new ApigeeOldRemoteQuota(self);
              cb(undefined, self.quotaImpl);
            }
          } else if (resp.ok) {
            self.quotaImpl = new ApigeeRemoteQuota(self);
            cb(undefined, self.quotaImpl);
          } else if (resp.unauthorized) {
            cb(new Error('Not authorized to call the remote proxy. Check the "key" parameter.'));
          } else {
            cb(new Error(util.format('HTTP error getting proxy version: %d. Check the "uri" parameter.', resp.statusCode)));
          }
        }
    });
  }
}

function makeNewQuotaRequest(self, opts, allow) {
  var r ={
    identifier: opts.identifier,
    weight: opts.weight,
    interval: self.options.interval,
    allow: allow,
    timeUnit: self.options.timeUnit
  };
  if (self.options.startTime) {
    // This type of quota just computes fixed buckets of 24 hours, 60 minutes,
    // etc. from a fixed start time. No fancy calendar math.
    r.startTime = self.options.startTime;
    r.quotaType = 'fixedStart';
  } else {
    // This is the quota type that works most like others in Volos.
    // The window starts when the first message for a given ID arrives.
    r.quotaType = 'flexi';
  }
  return r;
}

function ApigeeAccessQuota(quota) {
  debug('Using apigee-access for native quota');
  this.quota = quota;
}

ApigeeAccessQuota.prototype.getImplementationName = function() {
  return 'Local';
};

ApigeeAccessQuota.prototype.apply = function(opts, cb) {
  var allow = opts.allow || this.quota.options.allow;
  var r = makeNewQuotaRequest(this.quota, opts, allow);

  // Result is almost the same as a volos result
  debug('Local quota request: %j', r);
  this.quota.apigeeQuota.apply(r, function(err, result) {
    result.expiryTime = result.expiryTime - result.timestamp;
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

ApigeeRemoteQuota.prototype.getImplementationName = function() {
  return 'Remote';
};


ApigeeRemoteQuota.prototype.apply = function(opts, cb) {
  var allow = opts.allow || this.quota.options.allow;
  var r = makeNewQuotaRequest(this.quota, opts, allow);

  debug('Remote quota request: %j', r);
  superagent.agent().
    post(this.quota.options.uri + '/v2/quotas/apply').
    set('x-DNA-Api-Key', this.quota.options.key).
    type('json').
    send(r).
    end(function(err, resp) {
      if (err) {
        cb(err);
      } else if (resp.ok) {
        // result from apigee is almost what the module expects
        var result = resp.body;
        result.expiryTime = result.expiryTime - result.timestamp;
        cb(undefined, resp.body);
      } else {
        cb(new Error(util.format('Error updating remote quota: %d %s',
           resp.statusCode, resp.text)));
      }
    });
};

function ApigeeOldRemoteQuota(quota) {
  debug('Using a remote quota with the old protocol');
  this.quota = quota;
}

ApigeeOldRemoteQuota.prototype.getImplementationName = function() {
  return 'OldRemote';
};

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
  superagent.agent().
    post(this.quota.options.uri + '/quotas/distributed').
    set('x-DNA-Api-Key', this.quota.options.key).
    type('form').
    send(r).
    end(function(err, resp) {
      if (err) {
        cb(err);
      } else if (resp.ok) {
        debug('result: %s', resp.text);
        var result = {
          allowed: resp.body.allowed,
          used: resp.body.used,
          isAllowed: !resp.body.failed,
          expiryTime: resp.body.expiry_time - resp.body.ts
        };
        cb(undefined, result);
      } else {
        cb(new Error(util.format('Error updating remote quota: %d %s',
           resp.statusCode, resp.text)));
      }
    });
};
