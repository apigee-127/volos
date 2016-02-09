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
 * This module implements the runtime SPI by storing data in redis.
 *
 * options:
 *   host:    redis host (optional, default = 127.0.0.1)
 *   port:    redis port (optional, default = 6379)
 *   options: redis options (optional, default = {})
 */

/*
token_details = {
  access_token: token, // returned, not stored
  issued_at: time, // in ms
  ttl: ttl, // in secs
  scope: scope,
  application_id: application_id,
  developer_id: developer_id
}

auth_details = {
 redirectUri: redirectUri,
 scope: scope
}

schema:
 volos:oauth:hash(access_token) -> token_details
 volos:oauth:client_id:refresh_token -> token_details
 volos:oauth:client_id:auth_code -> auth_details
*/

var KEY_PREFIX = 'volos:oauth';
var CRYPTO_BYTES = 256 / 8;
var DEFAULT_TOKEN_LIFETIME = 60 * 60 * 24; // 1 day
var DEFAULT_REFRESH_TOKEN_LIFETIME = null; // never
var REFRESH_TYPE = 'refresh';
var AUTH_TTL = 60 * 5; // 5 minutes

var querystring = require('querystring');
var crypto = require('crypto');
var redis = require("redis");
var OAuthCommon = require('volos-oauth-common');
var Management = require('volos-management-redis');
var Url = require('url');
var _ = require('underscore');
var debug = require('debug')('redis');

// clone & extend hash
function extend(a, b) {
  return _.extend({}, a, b);
}

var create = function(config) {
  var mgmt = Management.create(config).getSpi(); // todo: can everything be abstracted into the common interface?
  var spi = new RedisRuntimeSpi(mgmt, config);
  var oauth = new OAuthCommon(spi, config);
  return oauth;
};
module.exports.create = create;

var RedisRuntimeSpi = function(mgmt, config) {
  config = config || {};
  var host = config.host || '127.0.0.1';
  var port = config.port || 6379;
  var db = config.db || 0;
  var ropts = _.extend({}, config.options) || {};
  this.hashAlgo = config.hashAlgo || 'sha256';
  this.client = redis.createClient(port, host, ropts);
  this.client.select(db);
  this.mgmt = mgmt;
};

/*
 * Generate an access token using client_credentials. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   scope: optional
 *   tokenLifetime: lifetime in milliseconds, optional
 *   attributes: hash of custom attributes to store and retrieve with token
 *
 * Returns an object with all the fields in the standard OAuth 2.0 response.
 */
RedisRuntimeSpi.prototype.createTokenClientCredentials = function(options, cb) {
  options = extend(options, { type: 'client_credentials' });
  var self = this;
  this.mgmt.getAppIdForCredentials(options.clientId, options.clientSecret, function(err, reply) {
    if (err) { return cb(err); }
    if (!reply) { return cb(errorWithCode('invalid_client')); }
    createAndStoreToken(self, options, cb);
  });
};

/*
 * Generate an access token using password credentials. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   scope: optional
 *   tokenLifetime: lifetime in milliseconds, optional
 *   refreshTokenLifetime: lifetime in milliseconds, optional, defaults no expiration
 *   username: required but not checked (must be checked outside this module)
 *   password: required by not checked (must be checked outside this module)
 *   attributes: hash of custom attributes to store and retrieve with token
 *
 * Returns an object with all the fields in the standard OAuth 2.0 response.
 */
RedisRuntimeSpi.prototype.createTokenPasswordCredentials = function(options, cb) {
  options = extend(options, { type: 'password', refresh: true });
  var self = this;
  this.mgmt.getAppIdForCredentials(options.clientId, options.clientSecret, function(err, reply) {
    if (err) { return cb(err); }
    if (!reply) { return cb(errorWithCode('invalid_client')); }
    createAndStoreToken(self, options, cb);
  });
};

/*
 * Generate an access token for authorization code once a code has been set up. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   code: Authorization code already generated by the "generateAuthorizationCode" method
 *   redirectUri: The same redirect URI that was set in the call to generate the authorization code
 *   tokenLifetime: lifetime in milliseconds, optional
 *   refreshTokenLifetime: lifetime in milliseconds, optional, defaults no expiration
 *   attributes: hash of custom attributes to store and retrieve with token
 *
 * Returns an object with all the fields in the standard OAuth 2.0 response.
 */
RedisRuntimeSpi.prototype.createTokenAuthorizationCode = function(options, cb) {
  var self = this;
  this.mgmt.getAppIdForCredentials(options.clientId, options.clientSecret, function(err, reply) {
    if (err) { return cb(err); }
    if (!reply) { return cb(errorWithCode('invalid_client')); }
    consumeAuthCode(self.client, options.clientId, options.code, function(err, hash) {
      if (err) { return cb(err); }
      if (options.redirectUri !== hash.redirectUri) { return cb(errorWithCode('invalid_grant')); }
      options = extend(options, { type: 'authorization_code', refresh: true, scope: hash.scope });
      createAndStoreToken(self, options, cb);
    });
  });
};

/*
 * Generate a redirect response for the authorization_code grant type. Parameters:
 *   clientId: required
 *   redirectUri: optional - if present, must match what was deployed along with the app
 *   scope: optional
 *   state: optional but certainly recommended
 *
 * Returns the redirect URI as a string.
 * 4.1.2
 */
RedisRuntimeSpi.prototype.generateAuthorizationCode = function(options, cb) {
  var self = this;
  self.mgmt.checkRedirectUri(options.clientId, options.redirectUri, function(err, redirectUri) {
    if (err) { return cb(err); }
    // past this point, errors must be part of the redirect uri
    createAndStoreAuthCode(self, options.clientId, options.scope, options.redirectUri, function(err, hash) {
      var qs = {};
      if (err) {
        qs.error = err.errorCode;
      } else {
        qs.code = hash.code;
        if (hash.scope) { qs.scope = hash.scope; }
      }
      if (options.state) { qs.state = options.state; }
      var url = Url.parse(redirectUri, true);
      url.query = extend(url.query, qs);
      url.search = null;
      var uri = Url.format(url);
      return cb(null, uri);
    });
  });
};

/*
 * Generate a redirect response for the implicit grant type. Parameters:
 *   clientId: required
 *   redirectUri: optional - if present, must match what was deployed along with the app
 *   scope: optional
 *   state: optional but certainly recommended
 *   attributes: hash of custom attributes to store and retrieve with token
 *
 * Returns the redirect URI as a string.
 */
RedisRuntimeSpi.prototype.createTokenImplicitGrant = function(options, cb) {
  var self = this;
  this.mgmt.checkRedirectUri(options.clientId, options.redirectUri, function(err, redirectUri) {
    if (err) { return cb(err); }
    // past this point, errors must be part of the redirect uri
    options = extend(options, { type: 'authorization_code', refresh: false});
    createAndStoreToken(self, options, function(err, reply) {
      var qs = {};
      if (err) {
        qs.error = err.errorCode;
      } else {
        qs = { access_token: reply.access_token, expires_in: reply.expires_in };
        if (reply.scope) { qs.scope = reply.scope; }
      }
      if (options.state) { qs.state = options.state; }
      var url = Url.parse(redirectUri, true);
      url.query = extend(url.query, qs);
      url.hash = querystring.stringify(url.query);
      url.query = null;
      url.search = null;
      var uri = Url.format(url);
      return cb(null, uri);
    });
  });
};

/*
 * Refresh an existing access token, and return a new token. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   refreshToken: required, from the original token grant
 *   tokenLifetime: lifetime in milliseconds, optional
 *   refreshTokenLifetime: lifetime in milliseconds, optional, defaults no expiration
 */
RedisRuntimeSpi.prototype.refreshToken = function(options, cb) {
  var self = this;
  var key = _key(options.clientId, hashToken(self, options.refreshToken));
  self.client.get(key, function(err, reply) {
    if (err) { return cb(err); }
    if (reply) {
      var token = JSON.parse(reply);
      options.scope = token.scope;
      options.attributes = token.attributes;
      options.refresh = true;
      createAndStoreToken(self, options, function(err, reply) {
        if (err) { return cb(err); }
        self.client.del(key);
        return cb(null, reply);
      });
    } else {
      return cb(invalidRequestError());
    }
  });
};

/*
 * Invalidate an existing token. Options is a hash containing:
 *   clientId: required
 *   clientSecret: required
 *   token: required
 *   tokenTypeHint: optional
 */
RedisRuntimeSpi.prototype.invalidateToken = function(options, cb) {
  var self = this;
  this.mgmt.getAppIdForCredentials(options.clientId, options.clientSecret, function(err, reply) {
    if (err) { return cb(err); }
    if (!reply) { return cb(invalidRequestError()); }

    var hashedToken = hashToken(self, options.token);
    self.client.del(_key(hashedToken));
    self.client.del(_key(options.clientId, hashedToken));
    return cb(null, 'OK');
  });
};

/*
 * Validate an access token.
 */
RedisRuntimeSpi.prototype.verifyToken = function(token, requiredScopes, cb) {
  debug('verifyToken: ' + token);
  var self = this;
  self.client.get(_key(hashToken(self, token)), function(err, reply) {
    if (err) { return cb(err); }
    if (!reply) { return cb(errorWithCode('invalid_token')); }

    var token_details = JSON.parse(reply);
    if (!Array.isArray(requiredScopes)) {
      requiredScopes = requiredScopes ? requiredScopes.split(' ') : [];
    }
    var grantedScopes = token_details.scope ? token_details.scope.split(' ') : [];
    if (_.difference(requiredScopes, grantedScopes).length > 0) {
      return cb(errorWithCode('invalid_scope'));
    }
    var expires_in = calculateExpiresIn(token_details);
    if (!expires_in) { return cb(invalidRequestError()); }
    var result = {
      appId: token_details.application_id,
      developerId: token_details.developer_id,
      attributes: token_details.attributes,
      expires_in: expires_in,
      scope: token_details.scope
    };
    return cb(null, result);
  });
};

RedisRuntimeSpi.prototype.verifyApiKey = function(apiKey, request, cb) {
  debug('verifyApiKey: %s', apiKey);
  var self = this;
  self.mgmt.getAppForClientId(apiKey, function(err, app) {
    if (err) {
      if (err.statusCode === 404) {
        err = errorWithCode('access_denied');
        err.message = 'Invalid API Key';
      }
      return cb(err);
    }
    cb(null, !!app);
  });
};

// utility functions

// in seconds
function calculateExpiresIn(token_details) {
  var now = new Date().getTime();
  var expiration = token_details.issued_at + (token_details.ttl * 1000);
  var remaining = expiration - now;
  return (remaining > 0) ? (remaining / 1000) : 0;
}

function createAndStoreAuthCode(self, clientId, requestedScope, redirectUri, cb) {
  self.mgmt.getAppForClientId(clientId, function(err, app) {
    if (err) { return cb(err); }

    determineGrantedScope(requestedScope, app, function(err, grantedScope) {
      if (err) { return cb(err); }

      var code = genSecureToken();
      var hash = JSON.stringify({ redirectUri: redirectUri, scope: grantedScope });
      self.client.setex(_key(clientId, code), AUTH_TTL, hash, function(err) {
        if (err) { return err; }
        return cb(null, { code: code, scope: grantedScope });
      });
    });
  });
}

function consumeAuthCode(client, clientId, code, cb) {
  client.get(_key(clientId, code), function(err, hash) {
    if (err) { return cb(err); }
    if (!hash) { return cb(errorWithCode('invalid_grant')); }
    client.del(_key(clientId, code), function(err) {
      return cb(err, JSON.parse(hash));
    });
  });
}

/* options: {
 *   clientId: required
 *   clientSecret: required, unless type === 'authorization_code' || type == 'password'
 *   scope: optional
 *   tokenLifetime: lifetime in milliseconds, optional
 *   refreshTokenLifetime: lifetime in milliseconds, optional, defaults no expiration
 *   type: required
 *   refresh: optional (default: false)
 *   attributes: hash of custom attributes to store and retrieve with token
 *   }
 */
function createAndStoreToken(self, options, cb) {
  getAppForOptions(self, options, function(err, app) {
    if (err || !app) { return cb(errorWithCode('access_denied')); }

    determineGrantedScope(options.scope, app, function(err, grantedScope) {
      if (err) { return cb(err); }

      var ttl = options.tokenLifetime ? (options.tokenLifetime / 1000) : DEFAULT_TOKEN_LIFETIME;
      var token = genSecureToken();
      storeToken(self, app, token, options.type, options.clientId, ttl, grantedScope, options.attributes, function(err, reply) {
        var tokenResponse = reply;
        if (err) { return cb(err); }
        if (options.refresh) {
          var refreshToken = genSecureToken();
          var refreshTtl = options.refreshTokenLifetime ? (options.refreshTokenLifetime / 1000) : DEFAULT_REFRESH_TOKEN_LIFETIME;
          storeToken(self, app, refreshToken, REFRESH_TYPE, options.clientId, refreshTtl, grantedScope, options.attributes, function(err) {
            if (err) { return cb(err); }
            tokenResponse.refresh_token = refreshToken;
            tokenResponse.refresh_token_expires_in = refreshTtl ? refreshTtl : 0;
            return cb(null, tokenResponse);
          });
        } else {
          return cb(null, tokenResponse);
        }
      });
    });
  });
}

function getAppForOptions(self, options, cb) {
  if (!options.clientSecret && (options.type === 'authorization_code' || options.type === 'password')) {
    self.mgmt.getAppForClientId(options.clientId, cb);
  } else {
    self.mgmt.getAppForCredentials(options.clientId, options.clientSecret, cb);
  }
}

// given a requested scope, returns granted scopes
// grants what it can, ignores what it can't. but if no default and no match, fails.
function determineGrantedScope(requestedScope, app, cb) {
  if (!requestedScope) { return cb(null, app.defaultScope); }
  if (!app.scopes) { return cb(null, null); }
  var requestedScopes = requestedScope.split(' ');
  var grantedScopes = _.intersection(requestedScopes, app.scopes);
  if (grantedScopes.length === 0) {
    if (!app.defaultScope) { return cb(errorWithCode('invalid_scope')); }
    grantedScopes.push(app.defaultScope);
  }
  return cb(null, grantedScopes.join(' '));
}

function invalidRequestError() {
  return errorWithCode('invalid_request');
}

function genSecureToken() {
  return encodeURIComponent(crypto.randomBytes(CRYPTO_BYTES).toString('base64'));
}

function hashToken(self, token) {
  return crypto.createHash(self.hashAlgo).update(token).digest("hex");
}

function storeToken(self, app, token, type, clientId, ttl, scope, attributes, cb) {
  var client = self.client;
  if (debug.enabled) { debug('storeToken: ' + token + ((type === REFRESH_TYPE) ? ' (refresh)' : '')); }
  var response = {
    issued_at: new Date().getTime(),
    access_token: token,
    ttl: ttl,
    scope: scope
  };
  if (scope) { response.scope = scope; }
  if (attributes) { response.attributes = attributes; }
  var toStore = _.extend({ application_id: app.id, developer_id: app.developerId }, response);
  delete toStore.access_token;
  var storeString = JSON.stringify(toStore);
  var hashedToken = hashToken(self, token);
  response.expires_in = ttl;
  delete(response.ttl);
  var key = (type === REFRESH_TYPE) ? _key(clientId, hashedToken) :_key(hashedToken);
  if (ttl) {
    client.setex(key, ttl, storeString, function(err) {
      return cb(err, response);
    });
  } else {
    client.set(key, storeString, function(err) {
      return cb(err, response);
    });
  }
}

function _key() {
  var argsArray = [].slice.apply(arguments);
  argsArray.unshift(KEY_PREFIX);
  return argsArray.join(':');
}

function errorWithCode(code) {
  var err = new Error(code);
  err.errorCode = code;
  return err;
}
