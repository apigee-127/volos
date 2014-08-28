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
 * This module implements the runtime SPI by talking to a proxy that is hosted inside Apigee.
 *
 * options:
 *   uri: The URI that your Apigee DNA Adapter is deployed to Apigee
 *   key: The API key for your adapter
 */

var url = require('url');
var http = require('http');
var https = require('https');
var querystring = require('querystring');
var OAuthCommon = require('volos-oauth-common');
var apigee = require('apigee-access');
var debug = require('debug')('apigee');
var superagent = require('superagent');
var _ = require('underscore');
var oldProtocol = require('./apigeeoldremote');

var apigeeAccess;
var hasApigeeAccess = false;

try {
  // Older versions of Apigee won't have this, so be prepared to work around.
  apigeeAccess = require('apigee-access');
  if (apigeeAccess.getQuota()) {
    hasApigeeAccess = true;
  }
} catch (e) {
  debug('Operating without access to apigee-access');
}


var create = function(options) {
  var spi = new ApigeeRuntimeSpi(options);
  var oauth = new OAuthCommon(spi, options);
  return oauth;
};
module.exports.create = create;

var ApigeeRuntimeSpi = function(options) {
  if (hasApigeeAccess) {
    if (!options.uri) {
      throw new Error('uri parameter must be specified');
    }
    if (!options.key) {
      throw new Error('key parameter must be specified');
    }

    this.uri = options.uri;
    this.key = options.key;
  }

  this.oauth = new OAuthCommon(ApigeeRuntimeSpi, options);
};

// Given the state of apigee-access, or the "version" of the remote proxy,
// select an implementation. This happens on the first call so that we can
// "start" the module if the proxy is down -- but this doesn't complete
// until we can get one successful HTTP call through
function selectImplementation(self, cb) {
  if (self.impl) {
    cb(undefined, self.impl);
    return;
  }

  self.impl = new oldProtocol.OldRemoteOAuth(self);
  cb(undefined, self.impl);
/*
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
          cb(err);
        } else {
          if (resp.notFound || !semver.satisfies(resp.text, '>=1.0.0')) {
            if (self.options.startTime) {
              cb(new Error('Quotas with a fixed starting time are not supported'));
            } else {
              self.quotaImpl = new ApigeeOldRemoteQuota(self);
              cb(undefined, self.quotaImpl);
            }
          } else if (resp.ok) {
            self.quotaImpl = new ApigeeRemoteQuota(self);
            cb(undefined, self.quotaImpl);
          } else {
            cb(new Error(util.format('HTTP error getting proxy version: %d', resp.statusCode)));
          }
        }
    });
  }
  */
}

/*
 * Generate an access token using client_credentials. Options:
 *   clientId: required
 *   clientSecret: required
 *   scope: optional
 *   tokenLifetime: lifetime in milliseconds, optional
 *   attributes: hash of custom attributes to store and retrieve with token
 *
 * Returns an object with all the fields in the standard OAuth 2.0 response.
 */
ApigeeRuntimeSpi.prototype.createTokenClientCredentials = function(options, cb) {
  selectImplementation(this, function(err, impl) {
    impl.createTokenClientCredentials(options, cb);
  });
};

/*
 * Generate an access token using password credentials. Options:
 *   clientId: required
 *   clientSecret: required
 *   scope: optional
 *   tokenLifetime: lifetime in milliseconds, optional
 *   username: required but not checked (must be checked outside this module)
 *   password: required by not checked (must be checked outside this module)
 *
 * Returns an object with all the fields in the standard OAuth 2.0 response.
 */
ApigeeRuntimeSpi.prototype.createTokenPasswordCredentials = function(options, cb) {
  selectImplementation(this, function(err, impl) {
    impl.createTokenPasswordCredentials(options, cb);
  });
};

/*
 * Generate an access token for authorization code once a code has been set up. Options:
 *   clientId: required
 *   clientSecret: required
 *   code: Authorization code already generated by the "generateAuthorizationCode" method
 *   redirectUri: The same redirect URI that was set in the call to generate the authorization code
 *   tokenLifetime: lifetime in milliseconds, optional
 *
 * Returns an object with all the fields in the standard OAuth 2.0 response.
 */
ApigeeRuntimeSpi.prototype.createTokenAuthorizationCode = function(options, cb) {
  selectImplementation(this, function(err, impl) {
    impl.createTokenAuthorizationCode(options, cb);
  });
};

/*
 * Generate a redirect response for the authorization_code grant type. Options:
 *   clientId: required
 *   redirectUri: required and must match what was deployed along with the app
 *   scope: optional
 *   state: optional but certainly recommended
 *
 * Returns the redirect URI as a string.
 */
ApigeeRuntimeSpi.prototype.generateAuthorizationCode = function(options, cb) {
  selectImplementation(this, function(err, impl) {
    impl.generateAuthorizationCode(options, cb);
  });
};

/*
 * Generate a redirect response for the implicit grant type. Options:
 *   clientId: required
 *   redirectUri: required and must match what was deployed along with the app
 *   scope: optional
 *   state: optional but certainly recommended
 *
 * Returns the redirect URI as a string.
 */
ApigeeRuntimeSpi.prototype.createTokenImplicitGrant = function(options, cb) {
  selectImplementation(this, function(err, impl) {
    impl.createTokenImplicitGrant(options, cb);
  });
};

/*
 * Refresh an existing access token, and return a new token. Options:
 *   clientId: required
 *   clientSecret: required
 *   refreshToken: required, from the original token grant
 *   scope: optional
 */
ApigeeRuntimeSpi.prototype.refreshToken = function(options, cb) {
  selectImplementation(this, function(err, impl) {
    impl.refreshToken(options, cb);
  });
};

/*
 * Invalidate an existing token. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   refreshToken: either this or accessToken must be specified
 *   accessToken: same
 */
ApigeeRuntimeSpi.prototype.invalidateToken = function(options, cb) {
  selectImplementation(this, function(err, impl) {
    impl.invalidateToken(options, cb);
  });
};

/*
 * Validate an access token.
 */
ApigeeRuntimeSpi.prototype.verifyToken = function(token, requiredScopes, cb) {
  selectImplementation(this, function(err, impl) {
    impl.verifyToken(token, requiredScopes, cb);
  });
};
