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

var argo = require('argo');
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var usePort = 10030

module.exports = function(cache) {
  var counter = 1;
  var port = usePort++
  var app = argo();
  app
//    .use(cache.argoMiddleware().cache())

    .get('/count',
      function(handle) {
        handle('request', function(env, next) {
          cache.argoMiddleware().cache()(env, function() {
            env.response.body = { count: counter++ };
            next(env);
          });
        });
    })

    .get('/countId',
      function(handle) {
        handle('request', function(env, next) {
          cache.argoMiddleware().cache('/count')(env, function() {
            env.response.body = { count: counter++ };
            next(env);
          });
        });
    })

    .get('/countIdFunction',
      function(handle) {
        handle('request', function(env, next) {
          cache.argoMiddleware().cache(idFunc)(env, function() {
            env.response.body = { count: counter++ };
            next(env);
          });
        });
    })

    .get('/emit500',
      function(handle) {
        handle('request', function(env, next) {
          cache.argoMiddleware().cache()(env, function() {
            env.response.statusCode = 500;
            env.response.body = { count: counter++ };
            next(env);
          });
        });
    })

    .get('/emit201',
      function(handle) {
        handle('request', function(env, next) {
          cache.argoMiddleware().cache()(env, function() {
            env.response.statusCode = 201;
            env.response.body = { count: counter++ };
            next(env);
          });
        });
    })

    .post('/count',
      function(handle) {
        handle('request', function(env, next) {
          cache.argoMiddleware().cache()(env, function() {
            env.response.body = { count: counter++ };
            next(env);
          });
        });
    })

    .get('/countIdFunctionNull',
      function(handle) {
        handle('request', function(env, next) {
          cache.argoMiddleware().cache(nullIdFunc)(env, function() {
            env.response.body = { count: counter++ };
            next(env);
          });
        });
    })

    .get('/stream',
      function(handle) {
        handle('request', function(env, next) {
          cache.argoMiddleware().cache()(env, function() {
            env.response.setHeader('counter', ++counter);
            env.response.body = fs.createReadStream(path.join(__dirname, 'testdata.txt'));
            next(env);
          });
        });
    })

    .listen(port);

// supertest expects an address function that returns the port
// (I couldn't figure out how to get the dynamic port from argo)
  app.address = function() {
    var addr = {};
    addr.port = port;
    return addr;
  };

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
