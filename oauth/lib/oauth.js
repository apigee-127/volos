function OAuth(options) {
  // options.validGrantTypes = ('implicit', 'authorization_code', 'client_credentials', 'password') required, can be array
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

OAuth.prototype.generateToken = function(body, authorizeHeader, passwordFunc, attributes, cb) {
  // RFC 6749
  // Authorization code and implicit grant:
  // Validate authorizeHeader
  // Check body for grant_type, code, redirect_uri, client_id
  // Client credentials:
  // Just skip any more authentication

  // password: call passwordFunc to validate it, it calls "next" when done

  // Set "attributes" on the generated token
  // cb(err, result)
  // result.access_token, token_type, expires_in, refresh_token
};

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

// TODO middleware that uses functions to gather the appropriate stuff
// can plug in to HTTP as well as Express and Argo
