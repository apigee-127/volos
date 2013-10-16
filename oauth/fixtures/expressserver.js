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

var express = require('express');
var spi = require('../../apigee-runtime');
var oauth = require('..');
var opts = require('../../common/testconfig');

var port = 10010;

var runtime = new spi(opts);

var oOpts = {
  validGrantTypes: [ 'client_credentials', 'authorization_code',
                     'implicit_grant', 'password' ],
  passwordCheck: checkPassword
};
var oauthRuntime = new oauth(runtime, oOpts);

function checkPassword(username, password) {
  return true;
}

var app = express();

app.get('/authorize', oauthRuntime.expressMiddleware().handleAuthorize());
app.post('/accesstoken', oauthRuntime.expressMiddleware().handleAccessToken());
app.post('/invalidate', oauthRuntime.expressMiddleware().invalidateToken());
app.post('/refresh', oauthRuntime.expressMiddleware().refreshToken());
app.use(oauthRuntime.expressMiddleware().authenticate());

app.get('/dogs',
  oauthRuntime.expressMiddleware().authenticate(),
  function(req, resp) {
  resp.json(['John', 'Paul', 'George', 'Ringo']);
});

app.get('/ok', function(req, resp) {
  resp.send(200, 'ok');
});

console.log('Going to listen on %d', port);
app.listen(port);
