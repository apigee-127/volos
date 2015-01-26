/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2014 Apigee Corporation

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

var assert = require('assert');
var initializeSwagger = require('swagger-tools').initializeMiddleware;
var path = require('path');
var yaml = require('yamljs');
var qs = require('querystring');
var Url = require('url');
var connect = require('connect');
var bodyParser = require('body-parser');
var _ = require('underscore');
var debug = require('debug')('swagger');

var volos = require('../../');

module.exports = function(swaggerObject, cb) {

  // this must be before swaggerMetadata - it rewrites swaggerObject
  var volosAuth = volos.auth(swaggerObject, {
    helpers: path.join(__dirname, 'helpers')
  });

  initializeSwagger(swaggerObject, function(swagger) {
    var app = connect();
    app.use(expressCompatibility);
    app.use(bodyParser.urlencoded({ extended: false }));

    app.use(swagger.swaggerMetadata(swaggerObject));
    app.use(swagger.swaggerSecurity(volosAuth.swaggerSecurityHandlers));

    app.use(volosAuth);
    app.use(volos.app);

    app.use(swagger.swaggerRouter({
      controllers: [
        path.join(__dirname, 'controllers'),
        path.join(__dirname, '..', '..', 'lib', 'controllers')
      ]
    }));

    app.use(function(err, req, res, next) {
      if (err.status !== 403 && err.status !== 503) { return next(err);}
      res.status(err.status);
      res.end(err.message);
    });

    app.volos = volosAuth; // allow test to access volosAuth
    cb(app);
  });
};

function expressCompatibility(req, res, next) {

  if (!req.query) {
    req.query = Url.parse(req.url, true).query;
  }

  res.json = function(obj) {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(JSON.stringify(obj));
  };

  if (!req.get) req.get = function(name) {
    return this.headers[name];
  };

  if (!res.set) { res.set = res.setHeader; }
  if (!res.get) { res.get = res.getHeader; }
  if (!res.status) {
    res.status = function(status) {
      res.statusCode = status;
    };
  }

  next();
}
