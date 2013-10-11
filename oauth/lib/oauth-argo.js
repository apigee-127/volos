var url = require('url');

var debug;
if (process.env.NODE_DEBUG && /oauth/.test(process.env.NODE_DEBUG)) {
  debug = function(x) {
    console.log('OAuth: ' + x);
  };
  debugEnabled = true;
} else {
  debug = function() { };
}

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
      if (self.options.authorizeUri) {
        console.log('authorize = %s', self.options.authorizeUri);
        argo.route(self.options.authorizeUri, { methods: ['GET'] },
          function(handle) {
            handle('request', function(env, next) {
              self.authorize(env, next);
            });
          }
        );
      }
      if (self.options.accessTokenUri) {
        console.log('access token = %s', self.options.accessTokenUri);
        argo.route(self.options.accessTokenUri, { methods: ['POST'] },
          function(handle) {
            handle('request', function(env, next) {
              self.accessToken(env, next);
            });
          }
        );
      }
      argo.use(function(handle) {
        handle('request', function(env, next) {
          self.authenticate(env, next);
        });
      });
      // TODO the existing OAuth package overrides the default argo "route" method -- why?
    }
  };
};

OAuthArgo.prototype.authorize = function(env, next) {
  debug('Argo authorize');
  var parsed = url.parse(env.request.url);
  this.oauth.authorize(parsed.query, function(err, result) {
    if (err) {
      if (debugEnabled) {
        debug('Authorization error: ' + err);
      }
      makeError(err, env);
    } else {
      env.response.statusCode = 301;
      env.response.setHeader('Location', result);
    }
    env._oauthAuthenticated = true;
    next(env);
  });
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
    if (debugEnabled) {
      debug('Access token body: ' + JSON.stringify(body) + ' type ' + typeof body);
    }
    self.oauth.generateToken(body, { authorizeHeader: env.request.headers.authorization },
      function(err, result) {
        if (err) {
          if (debugEnabled) {
            debug('Access token error: ' + err);
          }
          makeError(err, env);
        } else {
          env.response.body = result;
        }
        env._oauthAuthenticated = true;
        next(env);
      });
  });
};

OAuthArgo.prototype.authenticate = function(env, next) {
  debug('Argo authenticate');
  if (env._oauthAuthenticated) {
    next(env);
  } else {
    var parsedUrl = url.parse(env.request.url);
    this.oauth.verifyToken(
      env.request.headers.authorization,
      env.request.method,
      parsedUrl.pathname,
      function(err, result) {
        if (err) {
          if (debugEnabled) {
            debug('Authentication error: ' + err);
          }
          makeError(err, env);
        } else {
          env._oauthAuthenticated = true;
        }
        next(env);
      }
    );
  }
};

function makeError(err, env) {
  env.response.body = {
    error_description: err.message
  };
  if (err.code) {
    env.response.body.error_code = err.code;
  } else {
    env.response.body.error_code = 'unknown_error';
  }
  env.response.statusCode = 500;
}