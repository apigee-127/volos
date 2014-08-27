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

module.exports = function(quota) {
  var app = express();
  var counter = 1;

  app.get('/count',
    quota.expressMiddleware().apply(),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countId',
    quota.expressMiddleware().apply({ identifier: '/count' }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countFunctionId',
    quota.expressMiddleware().apply({ identifier: idFunc('/count') }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countWeight',
    quota.expressMiddleware().apply({ weight: 2 }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countWeightFunc',
    quota.expressMiddleware().apply({ weight: weightFunc(2) }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countWeightId',
    quota.expressMiddleware().apply({ identifier: '/countWeight2', weight: 2 }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countWeightIdFunction',
    quota.expressMiddleware().apply({ identifier: idFunc('/countWeight2f'), weight: weightFunc(2) }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countPerAddress',
    quota.expressMiddleware().applyPerAddress(),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countPerAddressId',
    quota.expressMiddleware().applyPerAddress({ identifier: '/countPerAddress' }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.get('/countPerAddressFunctionId',
    quota.expressMiddleware().applyPerAddress({ identifier: idFunc('/countPerAddress') }),
    function(req, resp) {
      resp.json({ count: counter++ });
    });

  app.use(function(err, req, res, next) {
    if (err.status !== 403) { return next(err);}
    res.status(403);
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
}