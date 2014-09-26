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

module.exports = function(spikeArrest) {
  var app = express();
  var counter = 1;

  app.get('/count',
    spikeArrest.expressMiddleware().apply({ key: '/count' }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countId',
    spikeArrest.expressMiddleware().apply({ key: '/count' }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countFunctionId',
    spikeArrest.expressMiddleware().apply({ key: idFunc('/count') }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countWeight',
    spikeArrest.expressMiddleware().apply({  key: '/countWeight', weight: 2 }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countWeightFunc',
    spikeArrest.expressMiddleware().apply({ key: '/countWeightFunc', weight: weightFunc(2) }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countWeightId',
    spikeArrest.expressMiddleware().apply({ key: '/countWeight2', weight: 2 }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countWeightIdFunction',
    spikeArrest.expressMiddleware().apply({ key: idFunc('/countWeight2f'), weight: weightFunc(2) }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.use(function(err, req, res, next) {
    if (err.status !== 503) { return next(err);}
    res.status(503);
    res.send(err.message);
  });

  return app;
};

var idFunc = function(id) {
  return function(req) {
    assert(req);
    return id;
  };
};

var weightFunc = function(weight) {
  return function(req) {
    assert(req);
    return weight;
  };
};
