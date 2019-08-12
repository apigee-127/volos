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

var argo = require('argo');

var usePort = 10020

module.exports = function(oauth) {
  var app = argo();
  var port = usePort++
  app
    .get('/dogs', function(handle) {
      handle('request', function(env, next) {
        oauth.argoMiddleware().authenticate('scope2', env, function() {
          env.response.body = [ 'Bo', 'Luke', 'Daisy' ];
          next(env);
        });
      });
    })
    .get('/ok', function(handle) {
      handle('request', function(env, next) {
        env.response.body = 'ok';
        next(env);
      });
    })
    .use(oauth.argoMiddleware(
      // It seems like Argo doesn't strip the query parameters when checking the URI so here we go.
      { authorizeUri: '^/authorize.*',
        accessTokenUri: '/accesstoken',
        refreshTokenUri: '/refresh',
        invalidateTokenUri: '/invalidate'
      }))
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
