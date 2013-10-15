var express = require('express');
var spi = require('../../runtime-spi-apigee');
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
