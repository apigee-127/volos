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
var port = 10011;

module.exports = function(oauth) {
  var app = argo();
  var counter = 1;

  app
    .get('/count', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().apply(env, function() {
          env.response.body = { count: counter++ };
          next(env);
        });
      });
    })


    .get('/countId', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().apply({ identifier: '/count' }, env, function() {
          env.response.body = { count: counter++ };
          next(env);
        });
      });
    })

    .get('/countFunctionId', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().apply({ identifier: idFunc('/count') }, env, function() {
          env.response.body = { count: counter++ };
          next(env);
        });
      });
    })

    .get('/countWeight', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().apply({ weight: 2 }, env, function() {
          env.response.body = { count: counter++ };
          next(env);
        });
      });
    })

    .get('/countWeightFunc', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().apply({ weight: weightFunc(2) }, env, function() {
          env.response.body = { count: counter++ };
          next(env);
        });
      });
    })

    .get('/countWeightId', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().apply({ identifier: '/countWeight2', weight: 2 }, env, function() {
          env.response.body = { count: counter++ };
          next(env);
        });
      });
    })

    .get('/countWeightIdFunction', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().apply({ identifier: idFunc('/countWeight2f'), weight: weightFunc(2) }, env, function() {
          env.response.body = { count: counter++ };
          next(env);
        });
      });
    })

    .get('/countPerAddress', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().applyPerAddress(env, function() {
          env.response.body = { count: counter++ };
          next(env);
        });
      });
    })

    .get('/countPerAddressId', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().applyPerAddress({ identifier: '/countPerAddress' }, env, function() {
          env.response.body = { count: counter++ };
          next(env);
        });
      });
    })

    .get('/countPerAddressFunctionId', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().applyPerAddress({ identifier: idFunc('/countPerAddress') }, env, function() {
          env.response.body = { count: counter++ };
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