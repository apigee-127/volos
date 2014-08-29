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

var express = require('express');
var assert = require('assert');
var swagger = require('swagger-tools').middleware.v2_0;
var volos = require('../../');
var path = require('path');
var yaml = require('yamljs');

module.exports = function(middleware) {
  var app = express();

  var swaggerObject = require('./swagger.yaml');
  app.use(swagger.swaggerMetadata(swaggerObject));
  app.use(volos());

  app.use(swagger.swaggerRouter({ controllers: path.join(__dirname, 'controllers') }));

  app.use(function(err, req, res, next) {
    if (err.status !== 403) { return next(err);}
    res.status(403);
    res.send(err.message);
  });

  return app;
};
