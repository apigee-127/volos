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

module.exports = function(middleware) {
  var app = express();
  var counter = 1;

  app.use(fakeSwagger);
  app.use(middleware);

  app.get('/clean',
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/cached',
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/quota',
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/secured',
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  return app;
};

function fakeSwagger(req, res, next) {
  var nickname = req.path.substring(1);
  req.swagger = {};
  req.swagger.operation = { nickname: nickname };
  if (nickname === 'secured') {
    req.swagger.operation.authorizations = securedAuth;
  }
  next();
}

var securedAuth = {
  "oauth2": [
    {
      "scope": "scope1",
      "description": "whatevs"
    }
  ]
};
