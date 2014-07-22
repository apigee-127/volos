'use strict';

var express = require('express');
var volos = require('./config/volos').default;
var oauthHelper = require('./lib/oauth-helper');
var _ = require('underscore');
var PORT = 8012;

var config = _.extend({
  validGrantTypes: [ 'client_credentials', 'authorization_code', 'implicit_grant', 'password' ],
  passwordCheck: checkPassword
}, volos.config);

// create Volos oauth
console.log(config)
var oauth = volos.oauth.create(config);

function checkPassword(username, password, cb) {
  cb(null, username === 'username' && password === 'password'); // implement as you will
}

var middleware = oauth.expressMiddleware();

var server = express();
server.get('/authorize', middleware.handleAuthorize());
server.post('/accesstoken', middleware.handleAccessToken());
server.post('/invalidate', middleware.invalidateToken());
server.post('/refresh', middleware.refreshToken());

server.get('/protected', middleware.authenticate(),
  function(req, res) {
    res.end('success!\n');
  }
);

oauthHelper.createApp(function(err, app) {
  if (err) { throw err; }

  // create a token and print some helpful information
  oauthHelper.createToken(app, oauth, function(err, creds) {
    if (err) { throw err; }

    console.log('Server routes:');
    console.log(server.routes);

    console.log('Server started on port %d\n', PORT);

    console.log('\nexample curl commands:\n');

    console.log('Get a token via Client Credentials:');
    console.log('curl -X POST "http://localhost:%d/accesstoken" -d ' +
        '"grant_type=client_credentials&client_id=%s&client_secret=%s"\n',
      PORT, encodeURIComponent(creds.clientId), encodeURIComponent(creds.clientSecret));

    console.log('Get a Token via Password:');
    console.log('curl -X POST "http://localhost:%d/accesstoken" -d ' +
        '"grant_type=password&client_id=%s&client_secret=%s&username=%s&password=%s"\n',
      PORT, encodeURIComponent(creds.clientId), encodeURIComponent(creds.clientSecret), 'username', 'password');

    console.log('Make a request to a protected endpoint with a token:');
    console.log('curl -H "Authorization: Bearer %s" "http://localhost:%s/protected"\n',
      creds.accessToken, PORT);

    // start listening
    server.listen(PORT);
  });
});
