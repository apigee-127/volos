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

var express = require('express');
var assert = require('assert');
var fs = require('fs');
var path = require('path');

module.exports = function(cache) {
  var app = express();
  var counter = 1;

  app.get('/count',
    cache.expressMiddleware().cache(),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countId',
    cache.expressMiddleware().cache('/count'),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countIdFunction',
    cache.expressMiddleware().cache(idFunc),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/emit500',
    cache.expressMiddleware().cache(),
    function(req, resp) {
      resp.status(500).json({ count: counter++ });
    });

  app.get('/emit201',
    cache.expressMiddleware().cache(),
    function(req, resp) {
      resp.status(201).json({ count: counter++ });
    });

  app.post('/count',
    cache.expressMiddleware().cache(),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countIdFunctionNull',
    cache.expressMiddleware().cache(nullIdFunc),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/stream',
    cache.expressMiddleware().cache(),
    function(req, resp) {
      resp.setHeader('counter', ++counter);
      fs.createReadStream(path.join(__dirname, 'testdata.txt')).pipe(resp);
    });

  return app;
};

var idFunc = function(req) {
  assert(req);
  return '/count';
};

var nullIdFunc = function(req) {
  assert(req);
  return null;
};
