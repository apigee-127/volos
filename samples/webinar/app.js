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

/**** Init ****/

var volos = require('./volos');
var init = require('./init');
init.createApp(initOauth);


/**** OAuth ****/

var oauth;
var application;
function initOauth(app) {

  application = app;
  var OAuth = volos.OAuth;

  var oauthConfig = {
    encryptionKey: 'abc123',
    validGrantTypes: [ 'client_credentials', 'authorization_code', 'implicit_grant', 'password' ],
    passwordCheck: oauthCheckPassword
  };

  oauth = OAuth.create(oauthConfig);

  function oauthCheckPassword(username, password, cb) {
    cb(null, username === 'sganyo' && password === 'password'); // implement appropriately
  }

  console.log('Initialized OAuth');

  startExpress();
}



/**** Express ****/

var express = require('express');
var PORT = 10010;

function startExpress() {

  var app = express();
  app.get('/authorize', oauth.expressMiddleware().handleAuthorize());
  app.post('/accesstoken', oauth.expressMiddleware().handleAccessToken());
  app.post('/invalidate', oauth.expressMiddleware().invalidateToken());
  app.post('/refresh', oauth.expressMiddleware().refreshToken());

  app.use(oauth.expressMiddleware().authenticate());

  app.get('/twitter',
    oauth.expressMiddleware().authenticate(),
    enforceQuota,
    runTwitterSearch
  );

  console.log(app.routes);
  console.log('Express listening on %d', PORT);
  app.listen(PORT);

  printCurlExamples();
}



/**** Quota ****/

var quota = volos.Quota.create({
  timeUnit: 'minute',
  interval: 1,
  allow: 2
});

function enforceQuota(req, resp, next) {

  var hit = { identifier: 'Twitter Search', weight: 1 };

  quota.apply(hit, function(err, result) {

    console.log('Quota: %s', JSON.stringify(result));
    if (err) { return next(err); }
    if (!result.isAllowed) {
      return resp.send(403, { error: 'over quota' });
    }
    next();
  });
}



/**** Twitter ****/

var twitter = require('./twitter');

function runTwitterSearch(req, resp, next) {

  var query = { q: req.query.search, count: 5 };

  twitter.cachedSearch(query, function(err, reply) {
    if (err) { return next(err); }
    resp.json(reply);
  });
}



/**** Misc ****/

function printCurlExamples() {

  init.createToken(application, oauth, function(creds) {

    console.log('\nexample curl commands:\n');

    console.log('Get a Password Token:');
    console.log('curl -X POST "http://localhost:%s/accesstoken" -d ' +
      '"grant_type=password&client_id=%s&client_secret=%s&username=%s&password=%s"\n',
      PORT, encodeURIComponent(creds.clientId), encodeURIComponent(creds.clientSecret), 'sganyo', 'password');

    console.log('Twitter Search:');
    console.log('curl -H "Authorization: Bearer %s" "http://localhost:%s/twitter?search=apigee"\n',
      creds.accessToken, PORT);
  });
}

