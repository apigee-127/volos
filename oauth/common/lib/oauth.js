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
"use strict";

var debug = require('debug')('oauth');
var _ = require('underscore');
var querystring = require('querystring');
var Url = require('url');
var TOKEN_TYPE = 'bearer';

// Map grant type names to functions so we can avoid a big if / then / else
var GrantTypeFunctions = {
  client_credentials: clientCredentialsGrant,
  password: passwordCredentialsGrant,
  authorization_code: authorizationCodeGrant
};

/*
 * Options:
 *   validGrantTypes: An array of OAuth 2.0 grant types that will be supported. If not specified, only
 *      "authorization_code" will be supported.
 *   tokenLifetime: The default length of time, in milliseconds, that a token will survive until being
 *      expired. Optional.
 *   beforeCreateToken: An optional function that can customize the parameters passed to the token generation
 *      function. This is intended mostly to add a custom attributes field to the options hash, but could
 *      be used for other reasons. The callback must be called with no arguments to continue. If the callback
 *      is called with an error, a token will not be generated and the error will be returned to the client.
 *      Function signature: function beforeCreateToken(parsedBody, options, cb);
 */

function OAuth(spi, options) {
  options = _.extend({}, applyModuleDefaults(options));

  this.spi = spi;
  this.validGrantTypes = options.validGrantTypes;
  this.tokenLifetime = options.tokenLifetime;
  this.passwordCheck = options.passwordCheck;
  this.beforeCreateToken = options.beforeCreateToken;
}
module.exports = OAuth;

// Note: Cache passed to Oauth must not specify an encoding option.
OAuth.prototype.useCache = function(cache) {
  var OAuthCache = require('./oauth-cache');
  this.spi = OAuthCache.create(cache, this.spi);
  this.isCached = true;
};

OAuth.prototype.removeCache = function() {
  this.spi = this.spi.target;
  this.isCached = false;
};

OAuth.prototype.argoMiddleware = function(options) {
  var mw = require('./oauth-argo');
  return new mw(this, options);
};

OAuth.prototype.connectMiddleware = function(options) {
  var mw = require('./oauth-connect');
  return new mw(this, options);
};

OAuth.prototype.expressMiddleware = OAuth.prototype.connectMiddleware;

var DefaultOptions = {
  validGrantTypes: [ 'authorization_code' ],
  beforeCreateToken: function(hash, options, cb) { cb(); }
};

function applyModuleDefaults(options) {
  if (!options) {
    return DefaultOptions;
  }
  if (!options.validGrantTypes) {
    options.validGrantTypes = DefaultOptions.validGrantTypes;
  }
  if (!options.beforeCreateToken) {
    options.beforeCreateToken = DefaultOptions.beforeCreateToken;
  }
  return options;
}

/*
 * Respond to an "authorize" request. The result will be a URL -- the caller should return it as the
 * "Location" header along with a 302 status. The client must pass the query string that was passed
 * to the request. This request handles both the authorization_code and implicit grant types.
 */
OAuth.prototype.authorize = function(queryString, request, cb) {
  if (debug.enabled) {
    debug('authorize: ' + JSON.stringify(queryString));
  }
  var q;
  if (typeof queryString === 'string') {
    q = querystring.parse(queryString);
  } else if (typeof querystring === 'object') {
    q = queryString;
  } else {
    cb(makeError('invalid_request', 'Query string must be a string or an object'));
  }

  if (typeof request === 'function') {
      cb = request;
      request = undefined;
  }

  var addProps = {};
  if (q.state) { addProps.state = q.state; }
  if (!q.client_id) {
    return cb(makeError('invalid_request', 'client_id is required', addProps));
  }

  var rq = {
    clientId: q.client_id,
    request: request
  };
  if (q.redirect_uri) {
    rq.redirectUri = q.redirect_uri;
  }
  if (q.scope) {
    rq.scope = q.scope;
  }
  if (q.state) {
    rq.state = q.state;
  }
  if (q.response_type === 'token' && isSupportedGrantType(this, 'implicit_grant')) {
    this.spi.createTokenImplicitGrant(rq, function (err, result) {
      if (err) { return cb(makeError('invalid_request', err.message)); }
      cb(undefined, result);
    });
  } else {
    var self = this;
    this.spi.generateAuthorizationCode(rq, function(err, result) {
      if (err) { return cb(makeError('invalid_request', err.message)); }

      if (q.response_type === 'code' && isSupportedGrantType(self, 'authorization_code')) {
        cb(undefined, result);
      } else {
        // in this case, we do have an error, but we used the SPI to generate a redirection URL for us anyway
        var url = Url.parse(result, true);
        url.query.error = 'unsupported_response_type';
        delete url.query.code;
        delete url.search;
        cb(undefined, Url.format(url));
      }
    });
  }
};

/*
 * Generate an access token.
 *
 * "body" must be the body of the POST request made by the client. This is required.
 * Options is optional and may include:
 *   authorizeHeader: if an Authorize header was on the request, include it here
 *   tokenLifetime: The time, in milliseconds, when the token should expire. If not specified,
 *     taken from the parent, otherwise it uses a system-level default
 *   attributes: An array of custom attributes to store with the token. [{}]
 */
OAuth.prototype.generateToken = function(body, options, cb) {
  // From RFC6749
  if (typeof options === 'function') {
    cb = options;
    options = undefined;
  }

  var parsedBody;
  if (typeof body === 'object') {
    parsedBody = body;
  } else if (typeof body === 'string') {
    parsedBody = querystring.parse(body);
  } else {
    cb(makeError('invalid_request', 'body must be a string or object'));
    return;
  }

  // Reject anything that does not match the valid grant types specified when the object was created
  if (!parsedBody.grant_type) {
    return cb(makeError('invalid_request', 'grant_type parameter is required'));
  }
  if (!isSupportedGrantType(this, parsedBody.grant_type)) {
    return cb(makeError('unsupported_grant_type', 'Unsupported grant type'));
  }

  options = applyTokenDefaults(this, options);

  var idSecret = getIdAndSecret(options.authorizeHeader, parsedBody);
  if (!idSecret) {
    if ((parsedBody.grant_type === 'authorization_code' || parsedBody.grant_type === 'password') && parsedBody.client_id) {
      idSecret = [parsedBody.client_id, null];
    } else {
      return cb(makeError('invalid_client', 'Client id and secret must be specified'));
    }
  }

  var createTokenFunction = GrantTypeFunctions[parsedBody.grant_type];

  if (!createTokenFunction) { return cb(makeError('unsupported_grant_type', 'Unsupported grant type')); }

  if (debug.enabled) { debug("grant_type: " + parsedBody.grant_type); }

  var self = this;
  this.beforeCreateToken(parsedBody, options, function(err) {
    if (err) { return cb(err); }

    createTokenFunction(self, parsedBody, idSecret[0], idSecret[1], options, function(err, result) {
      if (err) {
        err = makeError(err);
        if (options.authorizeHeader && err.code === 'invalid_client') {
          err.statusCode = 401;
          var auth = options.authorizeHeader.split(' ')[0];
          if (auth === 'Basic') {
            err.headers = {'WWW-Authenticate': 'Basic realm=' + idSecret[0]};
          }
        }
        cb(err);
      } else {
        debug('createToken : ' + result.access_token);
        result.token_type = TOKEN_TYPE;
        cb(undefined, result);
      }
    });
  });
};

var GenerateTokenDefaults = {
};
function applyTokenDefaults(self, o) {
  if (!o) {
    o = {};
  }
  if (!o.tokenLifetime) {
    o.tokenLifetime = self.tokenLifetime;
  }
  return o;
}

/*
 * Given a parsed request body, client ID, and secret, generate an access token.
 */
function clientCredentialsGrant(self, parsedBody, clientId, clientSecret, options, cb) {
  var gr = {
    clientId: clientId,
    clientSecret: clientSecret
  };
  if (parsedBody.scope) {
    gr.scope = parsedBody.scope;
  }
  if (options.tokenLifetime) {
    gr.tokenLifetime = options.tokenLifetime;
  }
  if (options.attributes) {
    gr.attributes = options.attributes;
  }

  self.spi.createTokenClientCredentials(gr, function(err, result) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, result);
    }
  });
}

function passwordCredentialsGrant(self, parsedBody, clientId, clientSecret, options, cb) {
  if (!self.passwordCheck) {
    return cb(makeError('internal_error', 'Password check function not supplied'));
  }
  if (!parsedBody.username || !parsedBody.password) {
    return cb(makeError('invalid_request', 'Missing username and password parameters'));
  }
  var gr = {
    clientId: clientId,
    clientSecret: clientSecret
  };
  if (parsedBody.scope) {
    gr.scope = parsedBody.scope;
  }
  if (options.tokenLifetime) {
    gr.tokenLifetime = options.tokenLifetime;
  }
  if (options.attributes) {
    gr.attributes = options.attributes;
  }

  self.passwordCheck(parsedBody.username, parsedBody.password, function(err, result) {
    if (err) { debug(err); }
    if (!result) { return cb(makeError('invalid_client', 'Invalid credentials')); }

    gr.username = parsedBody.username;
    gr.password = parsedBody.password;

    self.spi.createTokenPasswordCredentials(gr, function(err, result) {
      if (err) {
        cb(err);
      } else {
        cb(undefined, result);
      }
    });
  });
}

function authorizationCodeGrant(self, parsedBody, clientId, clientSecret, options, cb) {
  if (!parsedBody.code) {
    return cb(makeError('invalid_request', 'Missing authorization code'));
  }
  var gr = {
    clientId: clientId,
    clientSecret: clientSecret,
    code: parsedBody.code,
    redirectUri: parsedBody.redirect_uri
  };
  if (parsedBody.scope) {
    gr.scope = parsedBody.scope;
  }
  if (options.tokenLifetime) {
    gr.tokenLifetime = options.tokenLifetime;
  }
  if (options.attributes) {
    gr.attributes = options.attributes;
  }

  self.spi.createTokenAuthorizationCode(gr, function(err, result) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, result);
    }
  });
}

/*
 * Refresh an access token or a refresh token. Parse the body as in the regular OAuth spec.
 */
OAuth.prototype.refreshToken = function(body, options, cb) {
  var parsedBody;
  if (typeof body === 'object') {
    parsedBody = body;
  } else if (typeof body === 'string') {
    parsedBody = querystring.parse(body);
  } else {
    cb(makeError('invalid_request', 'body must be a string or object'));
    return;
  }

  if (!parsedBody.grant_type || !parsedBody.refresh_token) {
    cb(makeError('invalid_request', 'must include grant_type and refresh_token'));
    return;
  }

  if (parsedBody.grant_type !== 'refresh_token') {
    cb(makeError('unsupported_grant_type', 'grant_type must be refresh_token'));
    return;
  }

  var idSecret = getIdAndSecret(options.authorizeHeader, parsedBody);
  if (!idSecret) {
    cb(makeError('invalid_client', 'Missing client ID and secret'));
    return;
  }

  if (!parsedBody.refresh_token) {
    cb(makeError('invalid_request', 'Missing refresh_token'));
    return;
  }
  var gr = {
    clientId: idSecret[0],
    clientSecret: idSecret[1],
    refreshToken: parsedBody.refresh_token
  };
  if (parsedBody.scope) {
    gr.scope = parsedBody.scope;
  }

  this.spi.refreshToken(gr, function(err, result) {
    if (err) {
      cb(makeError(err));
    } else {
      result.token_type = TOKEN_TYPE;
      cb(undefined, result);
    }
  });
};

/*
 * Invalidate a token based on the spec.
 */
OAuth.prototype.invalidateToken = function(body, options, cb) {
  var parsedBody;
  if (typeof body === 'object') {
    parsedBody = body;
  } else if (typeof body === 'string') {
    parsedBody = querystring.parse(body);
  } else {
    cb(makeError('invalid_request', 'body must be a string or object'));
    return;
  }

  var idSecret = getIdAndSecret(options.authorizeHeader, parsedBody);
  if (!idSecret) {
    cb(makeError('invalid_client', 'Missing client ID and secret'));
    return;
  }

  if (!parsedBody.token) {
    cb(makeError('invalid_request', 'Missing token parameter'));
    return;
  }
  var gr = {
    clientId: idSecret[0],
    clientSecret: idSecret[1],
    token: parsedBody.token
  };
  if (parsedBody.token_type_hint) {
    gr.tokenTypeHint = parsedBody.token_type_hint;
  }

  this.spi.invalidateToken(gr, function(err, result) {
    if (err) {
      cb(makeError('error', err.message));
    } else {
      cb(undefined, result);
    }
  });
};

/*
 * Verify a token given an authorization header, plus optional path and
 * verb. Some implementations may use those in order to do additional checks.
 */
OAuth.prototype.verifyToken = function(authorizationHeader, requiredScopes, cb) {
  if (typeof requiredScopes === 'function') {
    cb = requiredScopes;
    requiredScopes = undefined;
  }

  var hdr = /Bearer (.+)/.exec(authorizationHeader);
  if (!hdr) {
    return cb(makeError('missing_authorization', 'Missing Authorization header'));
  }
  if (hdr.length < 2) {
    return cb(makeError('invalid_request', 'Invalid Authorization header'));
  }

  debug('verifyToken : ' + hdr[1]);
  this.spi.verifyToken(hdr[1], requiredScopes,
    function(err, result) {
      if (err) {
        cb(makeError(err));
      } else {
        cb(undefined, result);
      }
  });
};

/*
 * Verify an API key given an api key and the request (optional).
 */
OAuth.prototype.verifyApiKey = function(apiKey, request, cb) {
  if (typeof request === 'function') {
    cb = request;
    request = undefined;
  }
  if (!apiKey || typeof apiKey !== 'string') {
    return cb(makeError('invalid_token'));
  }
  debug('verifyApiKey: %s', apiKey);
  this.spi.verifyApiKey(apiKey, request,
    function(err, result) {
      if (err) {
        cb(makeError(err));
      } else {
        cb(undefined, result);
      }
    });
};

/*
 * Verify basic Auth using password helper function.
 */
OAuth.prototype.verifyPassword = function(username, password, cb) {
  if (!this.passwordCheck) {
    return cb(makeError('internal_error', 'Password check function not supplied'));
  }
  if (!username || !password) {
    return cb(makeError('missing_authorization', 'Missing username and/or password'));
  }

  this.passwordCheck(username, password, function(err, reply) {
    if (err) { return cb(makeError(err)); }
    if (reply) { return cb(); }
    cb(makeError('invalid_authorization'));
  });
};

// Private

/*
 * Generate an Error. "code" must be set to a valid error code from section 5.2.
 */
function makeError(code, message, errProps) {

  if (code.statusCode) {
    return code;
  } else if (code.errorCode) { // use spi's errorCode
    message = code.message;
    code = code.errorCode;
  }

  var err = new Error(message);
  err.code = code;
  switch(code) {
    case "invalid_request":
    case "invalid_client":
    case "invalid_grant":
    case "unauthorized_client":
    case "unsupported_grant_type":
    case "invalid_scope":
      err.statusCode = 400;
      break;
    case "access_denied":
      err.statusCode = 403;
      break;
    case "invalid_token":
    case "missing_authorization":
    case "invalid_authorization":
      err.statusCode = 401;
      break;
    default:
      err.statusCode = 500;
  }
  if (errProps) {
    _.extend(err, errProps);
  }
  return err;
}

function isSupportedGrantType(self, gt) {
  return (self.validGrantTypes.some(function(s) {
    return s === gt;
  }));
}

function getIdAndSecret(authorizeHeader, parsedBody) {
  // 2.3.1: Client id and secret may be in Basic format, or in the request body
  var clientId;
  var clientSecret;
  if (authorizeHeader) {
    var parsedHeader = /Basic (.+)/.exec(authorizeHeader);
    if (!parsedHeader) {
      return null;
    }
    if (parsedHeader.length < 2) {
      return null;
    }

    var decodedHeader = new Buffer(parsedHeader[1], 'base64').toString();
    var decoded = /([^:]+):([^:]+)/.exec(decodedHeader);
    if (!decoded || decoded.length < 3) {
      return null;
    }

    clientId = decoded[1];
    clientSecret = decoded[2];
  } else {
    clientId = parsedBody.client_id;
    clientSecret = parsedBody.client_secret;
  }
  if (clientId && clientSecret) {
    return [clientId, clientSecret];
  }
  return null;
}
