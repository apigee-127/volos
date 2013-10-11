var debug;
if (process.env.NODE_DEBUG && /oauth/.test(process.env.NODE_DEBUG)) {
  debug = function(x) {
    console.log('OAuth: ' + x);
  };
  debugEnabled = true;
} else {
  debug = function() { };
}

function OAuthExpress(oauth, options) {
  if (!(this instanceof OAuthExpress)) {
    return new OAuthExpress(oauth, options);
  }

  this.oauth = oauth;
  this.options = options || {};
}
module.exports = OAuthExpress;

OAuthExpress.prototype.handleAuthorize = function() {
  var self = this;
  return function(req, resp) {
  debug('Express authorize');
    self.oauth.authorize(req.query, function(err, result) {
      if (err) {
        if (debugEnabled) {
          debug('Authorization error: ' + err);
        }
        makeError(err, resp);
      } else {
        resp.status(301);
        resp.set('Location', result);
        resp.send();
      }
    });
  };
};

OAuthExpress.prototype.handleAccessToken = function() {
  var self = this;
  return function(req, resp) {
    debug('Express accessToken');
    getRequestBody(req, function(body) {
      req.body = body;
      self.oauth.generateToken(body, { authorizeHeader: req.get('authorization') },
        function(err, result) {
          if (err) {
            if (debugEnabled) {
              debug('Access token error: ' + err);
            }
            makeError(err, resp);
          } else {
            resp.json(result);
          }
        });
    });
  };
};

OAuthExpress.prototype.authenticate = function() {
  var self = this;
  return function(req, resp, next) {
    debug('Express authenticate');
    self.oauth.verifyToken(
      req.get('authorization'),
      req.method, req.path,
      function(err, result) {
        if (err) {
          if (debugEnabled) {
            debug('Authentication error: ' + err);
          }
          makeError(err, resp);
          // In express, once we set the response we're done
        } else {
          next();
        }
      }
    );
  };
};

OAuthExpress.prototype.refreshToken = function() {
  var self = this;
  return function(req, resp) {
    debug('Express refreshToken');
    getRequestBody(req, function(body) {
      req.body = body;
      self.oauth.refreshToken(body, { authorizeHeader: req.get('authorization') },
        function(err, result) {
          if (err) {
            if (debugEnabled) {
              debug('Refresh token error: ' + err);
            }
            makeError(err, resp);
          } else {
            resp.json(result);
          }
        });
    });
  };
};

OAuthExpress.prototype.invalidateToken = function() {
  var self = this;
  return function(req, resp) {
    debug('Express invalidateToken');
    getRequestBody(req, function(body) {
      req.body = body;
      self.oauth.invalidateToken(body, { authorizeHeader: req.get('authorization') },
        function(err, result) {
          if (err) {
            if (debugEnabled) {
              debug('Refresh token error: ' + err);
            }
            makeError(err, resp);
          } else {
            resp.json(result);
          }
        });
    });
  };
};

function getRequestBody(req, cb) {
  var body = '';
  req.setEncoding('utf8');
  req.on('readable', function() {
    var chunk;
    do {
      chunk = req.read();
      if (chunk) {
        body += chunk;
      }
    } while (chunk);
  });
  req.on('end', function() {
    cb(body);
  });
}

function makeError(err, resp) {
  var rb = {
    error_description: err.message
  };
  if (err.code) {
    rb.error_code = err.code;
  } else {
    rb.error_code = 'unknown_error';
  }
  // TODO proper response code
  resp.json(500, rb);
}
