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

var _ = require('underscore');
var debug;
var debugEnabled;
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
        resp.status(302);
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
            resp.set({
              'Cache-Control': 'no-store',
              'Pragma': 'no-cache'
            });
            resp.json(result);
          }
        });
    });
  };
};

OAuthExpress.prototype.authenticate = function(scopes) {
  var self = this;
  return function(req, resp, next) {
    debug('Express authenticate');
    self.oauth.verifyToken(
      req.get('authorization'),
      scopes,
      function(err, result) {
        if (err) {
          if (debugEnabled) {
            debug('Authentication error: ' + err);
          }
          makeError(err, resp);
          // In express, once we set the response we're done
        } else {
          req.token = result;
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
            resp.set({
              'Cache-Control': 'no-store',
              'Pragma': 'no-cache'
            });
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
  if (req.complete) { return cb(req.body); }
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
  if (err.state) {
    rb.state = err.state;
  }
  if (err.code) {
    rb.error = err.code;
  } else {
    rb.error = 'server_error';
  }
  if (err.headers) {
    _.each(_.keys(err.headers), function(name) {
      resp.setHeader(name, err.headers[name]);
    });
  }
  resp.json(err.statusCode, rb);
}
