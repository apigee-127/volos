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

var debug = require('debug')('oauth');
var _ = require('underscore');
var Url = require('url');

function OAuthConnect(oauth, options) {
  if (!(this instanceof OAuthConnect)) {
    return new OAuthConnect(oauth, options);
  }

  this.oauth = oauth;
  this.options = options || {};
}
module.exports = OAuthConnect;

OAuthConnect.prototype.handleAuthorize = function() {
  var self = this;
  return function(req, resp) {
  debug('Express authorize');
    if (!req.query) {
      req.query = Url.parse(req.url).query;
    }
    self.oauth.authorize(req.query, req, function(err, result) {
      if (err) {
        debug('Authorization error: %s', err);
        sendError(err, resp);
      } else {
        resp.statusCode = 302;
        debug('Setting location header to %s', result);
        resp.setHeader('Location', result);
        resp.end();
      }
    });
  };
};

OAuthConnect.prototype.handleAccessToken = function() {
  var self = this;
  return function(req, resp) {
    debug('Express accessToken');
    getRequestBody(req, function(body) {
      req.body = body;
      self.oauth.generateToken(body, { authorizeHeader: req.headers.authorization, request: req },
        function(err, result) {
          if (err) {
            debug('Access token error: %s', err);
            sendError(err, resp);
          } else {
            resp.setHeader('Cache-Control', 'no-store');
            resp.setHeader('Pragma', 'no-cache');
            sendJson(resp, result);
          }
        });
    });
  };
};

OAuthConnect.prototype.authenticate = function(scopes) {
  var self = this;
  return function(req, resp, next) {
    debug('Express authenticate');
    self.oauth.verifyToken(
      req.headers.authorization,
      scopes,
      function(err, result) {
        handleAuthenticateResult(err, result, req, resp, next);
      }
    );
  };
};

OAuthConnect.prototype.authenticateApiKey = function(keyFunction) {
  var self = this;
  return function(req, resp, next) {
    debug('Connect authenticate ApiKey');
    keyFunction(request, function(err, apiKey) {
      if (err) { return cb(err); }
      self.oauth.verifyApiKey(
        apiKey,
        function(err, result) {
          handleAuthenticateResult(err, result, req, resp, next);
        }
      );
    });
  };
};

OAuthConnect.prototype.authenticateBasicAuth = function() {
  var self = this;
  return function(req, resp, next) {
    debug('Connect authenticate BasicAuth');
    var header = request.headers['authorization'] || '';
    var token = header.split(/\s+/).pop() || '';
    var auth = new Buffer(token, 'base64').toString();
    var usernamePassword = auth.split(/:/);
    self.oauth.verifyPassword(
      usernamePassword[0],
      usernamePassword[1],
      function(err, result) {
        handleAuthenticateResult(err, result, req, resp, next);
      }
    );
  };
};

function handleAuthenticateResult(err, result, req, resp, next) {
  if (err) {
    debug('Authentication error: %s', err);
    sendError(err, resp);
  } else {
    req.token = result;
    next();
  }
}

OAuthConnect.prototype.refreshToken = function() {
  var self = this;
  return function(req, resp) {
    debug('Connect refreshToken');
    getRequestBody(req, function(body) {
      req.body = body;
      self.oauth.refreshToken(body, { authorizeHeader: req.headers.authorization, request: req },
        function(err, result) {
          if (err) {
            debug('Refresh token error: %s', err);
            sendError(err, resp);
          } else {
            resp.setHeader('Cache-Control', 'no-store');
            resp.setHeader('Pragma', 'no-cache');
            sendJson(resp, result);
          }
        });
    });
  };
};

OAuthConnect.prototype.invalidateToken = function() {
  var self = this;
  return function(req, resp) {
    debug('Connect invalidateToken');
    getRequestBody(req, function(body) {
      req.body = body;
      self.oauth.invalidateToken(body, { authorizeHeader: req.headers.authorization, request: req },
        function(err, result) {
          if (err) {
            debug('Invalidate token error: %s', err);
            sendError(err, resp);
          } else {
            sendJson(resp, result);
          }
        });
    });
  };
};

function sendError(err, resp) {
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
  sendJson(resp, err.statusCode, rb);
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

function sendJson(resp, code, body) {
  if (!body) { body = code; code = undefined; }
  if (code) { resp.statusCode = code; }
  resp.setHeader('Content-Type', 'application/json');
  resp.end(JSON.stringify(body));
}
