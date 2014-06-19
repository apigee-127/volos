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
var debug = require('debug')('oauth');

function OAuthArgo(oauth, options) {
  if (!(this instanceof OAuthArgo)) {
    return new OAuthArgo(oauth, options);
  }

  this.oauth = oauth;
  this.options = options || {};
}
module.exports = OAuthArgo;

OAuthArgo.prototype.package = function(argo) {
  var self = this;
  return {
    name: 'OAuth',
    install: function() {
      argo.use(function(handle) {
        handle('request', function(env, next) {
          env.oauth = {
            authenticate: self.authenticate.bind(self),
            authorize: self.authorize.bind(self)
          };
          next(env);
        });
      });
      if (self.options.authorizeUri) {
        if (debug.enabled) { debug('authorize = ' + self.options.authorizeUri); }
        argo.route(self.options.authorizeUri, { methods: ['GET'] },
          function(handle) {
            handle('request', function(env, next) {
              self.authorize(env, next);
            });
          }
        );
      }
      if (self.options.accessTokenUri) {
        if (debug.enabled) { debug('access token = ' + self.options.accessTokenUri); }
        argo.route(self.options.accessTokenUri, { methods: ['POST'] },
          function(handle) {
            handle('request', function(env, next) {
              self.accessToken(env, next);
            });
          }
        );
      }
      if (self.options.refreshTokenUri) {
        if (debug.enabled) { debug('refresh token = ' + self.options.refreshTokenUri); }
        argo.route(self.options.refreshTokenUri, { methods: ['POST'] },
          function(handle) {
            handle('request', function(env, next) {
              self.refreshToken(env, next);
            });
          }
        );
      }
      if (self.options.invalidateTokenUri) {
        if (debug.enabled) { debug('invalidate token = ' + self.options.refreshTokenUri); }
        argo.route(self.options.invalidateTokenUri, { methods: ['POST'] },
          function(handle) {
            handle('request', function(env, next) {
              self.invalidateToken(env, next);
            });
          }
        );
      }
    }
  };
};

OAuthArgo.prototype.authorize = function(env, next) {
  debug('Argo authorize');

  var self = this;
  var auth = function(params, env, next) {
    self.oauth.authorize(params, env.request, function(err, result) {
      if (err) {
        if (debug.enabled) {
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
  };

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

OAuthArgo.prototype.accessToken = function(env, next) {
  debug('Argo accessToken');
  var self = this;
  env.request.getBody(function(bodyErr, body) {
    if (bodyErr) {
      makeError(bodyErr, env);
      env._oauthAuthenticated = true;
      next(env);
      return;
    }

    if (body instanceof Buffer) {
      body = body.toString('ascii');
    }
    if (debug.enabled) {
      debug('Access token body: ' + JSON.stringify(body) + ' type ' + typeof body);
    }
    self.oauth.generateToken(body, { authorizeHeader: env.request.headers.authorization, request: env.request },
      function(err, result) {
        if (err) {
          if (debug.enabled) {
            debug('Access token error: ' + err);
          }
          makeError(err, env);
        } else {
          env.response.setHeader('Cache-Control', 'no-store');
          env.response.setHeader('Pragma', 'no-cache');
          env.response.body = result;
        }
        env._oauthAuthenticated = true;
        next(env);
      });
  });
};

OAuthArgo.prototype.authenticate = function(scopes, env, next) {
  debug('Argo authenticate');
  if (env._oauthAuthenticated) {
    next(env);
  } else {
    var parsedUrl = url.parse(env.request.url);
    this.oauth.verifyToken(
      env.request.headers.authorization,
      scopes,
      function(err, result) {
        if (err) {
          if (debug.enabled) {
            debug('Authentication error: ' + err);
          }
          makeError(err, env);
        } else {
          var context = {
            authenticated: true,
            developerId: result.developerId,
            appId: result.appId
          };
          env.oauth.result = context;
        }
        next(env);
      }
    );
  }
};

OAuthArgo.prototype.refreshToken = function(env, next) {
  debug('Argo refreshToken');
  var self = this;
  env.request.getBody(function(bodyErr, body) {
    if (bodyErr) {
      makeError(bodyErr, env);
      env._oauthAuthenticated = true;
      next(env);
      return;
    }

    if (body instanceof Buffer) {
      body = body.toString('ascii');
    }
    if (debug.enabled) {
      debug('Access token body: ' + JSON.stringify(body) + ' type ' + typeof body);
    }
    self.oauth.refreshToken(body, { authorizeHeader: env.request.headers.authorization, request: env.request },
      function(err, result) {
        if (err) {
          if (debug.enabled) {
            debug('Access token error: ' + err);
          }
          makeError(err, env);
        } else {
          env.response.setHeader('Cache-Control', 'no-store');
          env.response.setHeader('Pragma', 'no-cache');
          env.response.body = result;
        }
        env._oauthAuthenticated = true;
        next(env);
      });
  });
};

OAuthArgo.prototype.invalidateToken = function(env, next) {
  debug('Argo invalidateToken');
  var self = this;
  env.request.getBody(function(bodyErr, body) {
    if (bodyErr) {
      makeError(bodyErr, env);
      env._oauthAuthenticated = true;
      next(env);
      return;
    }

    if (body instanceof Buffer) {
      body = body.toString('ascii');
    }
    if (debug.enabled) {
      debug('Access token body: ' + JSON.stringify(body) + ' type ' + typeof body);
    }
    self.oauth.invalidateToken(body, { authorizeHeader: env.request.headers.authorization, request: env.request },
      function(err, result) {
        if (err) {
          if (debug.enabled) {
            debug('Access token error: ' + err);
          }
          makeError(err, env);
        } else {
          env.response.setHeader('Cache-Control', 'no-store');
          env.response.setHeader('Pragma', 'no-cache');
          env.response.body = result;
        }
        env._oauthAuthenticated = true;
        next(env);
      });
  });
};

function makeError(err, env) {
  env.oauth.error = err;
  env.response.body = {
    error_description: err.message
  };
  if (err.code) {
    env.response.body.error = err.code;
  } else {
    env.response.body.error = 'server_error';
  }
  if (err.headers) {
    _.each(_.keys(err.headers), function(name) {
      env.response.setHeader(name, err.headers[name]);
    });
  }
  env.response.statusCode = err.statusCode;
}
