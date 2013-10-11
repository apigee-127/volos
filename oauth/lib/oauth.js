var querystring = require('querystring');

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
 *   tokenLifetime: The default length of time, in milliseconds, that a token will survive until being expired.
 *     Optional.
 */

function OAuth(spi, options) {
  options = applyModuleDefaults(options);

  this.spi = spi;
  this.validGrantTypes = options.validGrantTypes;
  this.tokenLifetime = options.tokenLifetime;
  this.passwordCheck = options.passwordCheck;
}
module.exports = OAuth;

var DefaultOptions = {
  validGrantTypes: [ 'authorization_code' ]
};

function applyModuleDefaults(options) {
  if (!options) {
    return DefaultOptions;
  }
  if (!options.validGrantTypes) {
    options.validGrantTypes = DefaultOptions.validGrantTypes;
  }
  return options;
}

/*
 * Respond to an "authorize" request. The result will be a URL -- the caller should return it as the
 * "Location" header along with a 302 status. The client must pass the query string that was passed
 * to the request. This request handles both the authorization_code and implicit grant types.
 */
OAuth.prototype.authorize = function(queryString, cb) {
  var q = querystring.parse(queryString);

  if (q.response_type === 'code') {
    if (!isSupportedGrantType(this, 'authorization_code')) {
      cb(makeError('unsupported_grant_type', 'Invalid code type'));
      return;
    }
    doAuthorize(this, 'code', q, cb);

  } else if (q.response_type === 'token') {
    if (!isSupportedGrantType(this, 'implicit_grant')) {
      cb(makeError('unsupported_grant_type', 'Invalid code type'));
      return;
    }
    doAuthorize(this, 'token', q, cb);

  } else {
    cb(makeError('unsupported_grant_type', 'Invalid code type'));
    return;
  }
};

function doAuthorize(self, grantType, q, cb) {
  if (!q.client_id) {
    cb(makeError('invalid_request', 'client_id is required'));
  }
  var rq = {
    clientId: q.client_id
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

  if (grantType === 'code') {
    self.spi.generateAuthorizationCode(rq, function(err, result) {
      if (err) {
        // TODO more error codes
        cb(makeError('invalid_request', err.message));
      } else {
        cb(undefined, result);
      }
    });
  } else if (grantType === 'token') {
    self.spi.createTokenImplicitGrant(rq, function(err, result) {
      if (err) {
        // TODO more error codes
        cb(makeError('invalid_request', err.message));
      } else {
        cb(undefined, result);
      }
    });
  } else {
    throw new Error('Invalid grant');
  }
}

/*
 * Generate an access token.
 *
 * "body" must be the body of the POST request made by the client. This is required.
 * Options is optional and may include:
 *   authorizeHeader: if an Authorize header was on the request, include it here
 *   tokenLifetime: The time, in milliseconds, when the token should expire. If not specified,
 *     taken from the parent, otherwise it uses a system-level default
 */
OAuth.prototype.generateToken = function(body, options, cb) {
  // From RFC6749
  if (typeof options === 'function') {
    cb = options;
    options = undefined;
  }

  if (typeof body !== 'string') {
    throw new Error('body must be a string');
  }
  var parsedBody = querystring.parse(body);

  // Reject anything that does not match the valid grant types specified when the object was created
  if (!parsedBody.grant_type) {
    cb(makeError('invalid_request', 'grant_type parameter is required'));
    return;
  }
  if (!isSupportedGrantType(this, parsedBody.grant_type)) {
    cb(makeError('unsupported_grant_type', 'Unsupported grant type'));
    return;
  }

  options = applyTokenDefaults(this, options);

  var idSecret = getIdAndSecret(options.authorizeHeader, parsedBody);
  if (!idSecret) {
    cb(makeError('invalid_client', 'Client id and secret must be specified'));
    return;
  }

  if (GrantTypeFunctions[parsedBody.grant_type]) {
    GrantTypeFunctions[parsedBody.grant_type](this, parsedBody, idSecret[0], idSecret[1],
                                              options, function(err, result) {
        if (err) {
          cb(makeError('error', err.message));
        } else {
          cb(undefined, result);
        }
    });
  } else {
    cb(makeError('unsupported_grant_type', 'Unsupported grant type'));
  }
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
    gr.tokenLifetime = options.tokenLifetime
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
  var gr = {
    clientId: clientId,
    clientSecret: clientSecret
  };
  if (parsedBody.scope) {
    gr.scope = parsedBody.scope;
  }
  if (options.tokenLifetime) {
    gr.tokenLifetime = options.tokenLifetime
  }

  if (!self.passwordCheck) {
    cb(makeError('internal_error', 'Password check function not supplied'));
    return;
  }
  if (!parsedBody.username || !parsedBody.password) {
    cb(makeError('invalid_request', 'Missing username and password parameters'));
    return;
  }
  if (!self.passwordCheck(parsedBody.username, parsedBody.password)) {
    cb(makeError('unauthorized', 'Invalid credentials'));
    return;
  }
  gr.username = parsedBody.username;
  gr.password = parsedBody.password;

  self.spi.createTokenPasswordCredentials(gr, function(err, result) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, result);
    }
  });
}

function authorizationCodeGrant(self, parsedBody, clientId, clientSecret, options, cb) {
  if (!parsedBody.code) {
    cb(makeError('invalid_request', 'Missing authorization code'));
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
    gr.tokenLifetime = options.tokenLifetime
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
  if (typeof body !== 'string') {
    throw new Error('body must be a string');
  }
  var parsedBody = querystring.parse(body);

  if (!parsedBody.grant_type || (!parsedBody.grant_type === 'refresh_token')) {
    cb(makeError('invalid_request', 'Missing refresh_token grant type'));
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
      cb(makeError('error', err.message));
    } else {
      cb(undefined, result);
    }
  });
};

/*
 * Invalidate a token based on the spec.
 */
OAuth.prototype.invalidateToken = function(body, options, cb) {
  if (typeof body !== 'string') {
    throw new Error('body must be a string');
  }
  var parsedBody = querystring.parse(body);

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
OAuth.prototype.verifyToken = function(authorizationHeader, verb, path, cb) {
  if (typeof verb === 'function') {
    cb = verb;
    verb = undefined;
  } else if (typeof path === 'function') {
    cb = path;
    path = undefined;
  }

  var hdr = /Bearer (.+)/.exec(authorizationHeader);
  if (!hdr || (hdr.length < 2)) {
    cb(makeError('invalid_request', 'Invalid Authorization header'));
    return;
  }

  this.spi.verifyToken(hdr[1], verb, path,
    function(err, result) {
      if (err) {
        cb(makeError('invalid_token', err.message));
      } else {
        cb(undefined, result);
      }
  });
};

/*
 * Generate an Error. "code" must be set to a valid error code from section 5.2.
 */
function makeError(code, message) {
  var err = new Error(message);
  err.code = code;
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
    if (decoded.length < 3) {
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

// TODO middleware that uses functions to gather the appropriate stuff
// can plug in to HTTP as well as Express and Argo
