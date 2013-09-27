var querystring = require('querystring');

// Map grant type names to functions so we can avoid a big if / then / else
var GrantTypeFunctions = {
  client_credentials: clientCredentialsGrant
};

function OAuth(options) {
  options = applyModuleDefaults(options);

  this.validGrantTypes = options.validGrantTypes;
}
module.exports.OAuth = OAuth;

var DefaultOptions = {
  validGrantTypes: [ 'authorization_code' ]
};

function applyModuleDefaults(options) {
  if (!options.validGrantTypes) {
    options.validGrantTypes = DefaultOptions.validGrantTypes;
  }
}

OAuth.prototype.generateAuthCode = function(queryString, authorizeHeader, attributes, cb) {
  // RFC 6749
  // Authorization code, implicit grant:
  // Validate authorizeHeader
  // Check queryString for response_type, client_id, redirect_uri, scope, state
  // cb(err, result)
  // err.code = matches OAuth 2.0 spec
  // err.description
  // err.state
  // result.code = authorization code
  // result.state = state
};

/*
 * Generate an access token.
 *
 * "body" must be the body of the POST request made by the client. This is required.
 * Options is optional and may include:
 *   authorizeHeader: if an Authorize header was on the request, include it here
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

  parsedBody = querystring.parse(body);

  // Reject anything that does not match the valid grant types specified when the object was created
  if (!parsedBody.grant_type) {
    throw makeError('invalid_request', 'grant_type parameter is required');
  }
  if (!this.validGrantTypes.some(function(gt) {
    return (parsedBody.grant_type === gt);
  })) {
    throw makeError('unsupported_grant_type', 'Unsupported grant type');
  }

  // 2.3.1: Client id and secret may be in Basic format, or in the request body
  var clientId;
  var clientSecret;
  if (options.authorizeHeader) {
    var parsedHeader = parseAuthorizationHeader(options.authorizeHeader);
    clientId = parsedHeader[0];
    clientSecret = parsedHeader[1];
  } else {
    clientId = parsedBody.client_id;
    clientSecret = parsedBody.client_secret;
  }
  if (!clientId || !clientSecret) {
    throw makeError('invalid_client', 'Client id and secret must be specified');
  }

  if (GrantTypeFunctions[parsedBody.grant_type]) {
    GrantTypeFunctions[parsedBody.grant_type](parsedBody, clientId, clientSecret, options, cb);
  } else {
    throw makeError('unsupported_grant_type', 'Unsupported grant type');
  }
};

/*
 * Given a parsed request body, client ID, and secret, generate an access token.
 */
function clientCredentialsGrant(parsedBody, clientId, clientSecret, cb) {
  var gr = {
    clientId: clientId,
    clientSecret: clientSecret,
    scope: parsedBody.scope
  };

}

OAuth.prototype.refreshToken = function(body, authorizeHeader, cb) {
  // RFC 6749
  // Validate authorizeHeader
  // Check body for grant_type, refresh_token, scope
  // Call cb as before
};

OAuth.prototype.invalidateToken = function(body, authorizeHeader, cb) {
  // RFC 7009
  // Validate authorizeHeader
  // Check token and token_type_hint

};

OAuth.prototype.verifyToken = function(token, cb) {
  // RFC6750
  // Validate token and call cb
};

/*
 * Generate an Error. "code" must be set to a valid error code from section 5.2.
 */
function makeError(code, message) {
  var err = new Error(message);
  err.code = code;
  return err;
}

// TODO middleware that uses functions to gather the appropriate stuff
// can plug in to HTTP as well as Express and Argo
