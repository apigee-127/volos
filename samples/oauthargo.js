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

// In a real deployment, you would replace these with the real NPM module names.
var ApigeeRuntime = require('../oauth/providers/apigee');
var OAuth = require('../oauth');
var config = require('./config');

var port = 10010;

var runtime = new ApigeeRuntime(config);

var options = {
  validGrantTypes: [ 'client_credentials', 'authorization_code',
                     'implicit_grant', 'password' ],
  passwordCheck: function() { return true; }
};

var oauthFactory = new OAuth(runtime, options);
var oauth = oauthFactory.argoMiddleware({
  authorizeUri: '^/authorize.*',
  accessTokenUri: '/accesstoken'
});

console.log('Initialized OAuth runtime');

argo()
  .use(oauth)
  .get('/dogs', function(handle) {
    handle('request', function(env, next) {
      env.oauth.authenticate(env, function(env) {
        if (env.oauth.error) {
          return next(env);
        }

        env.response.body = [ 'Bo', 'Luke', 'Daisy' ];
        next(env);
      });
    });
  })
  .listen(port);

console.log('Listening on %d', port);
