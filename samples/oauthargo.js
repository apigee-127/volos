var argo = require('argo');
var spi = require('runtime-spi-apigee');
var oauth = require('apigee-oauth');
var opts = require('./config');

var port = 10010;

var runtime = new spi(opts);

var oOpts = {
  validGrantTypes: [ 'client_credentials', 'authorization_code',
                     'implicit_grant', 'password' ],
  passwordCheck: checkPassword
};
var oauthRuntime = new oauth(runtime, oOpts);

console.log('Initialized OAuth runtime');

function checkPassword(username, password) {
  return true;
}

argo().get('/dogs', function(handle) {
  handle('request', function(env, next) {
    env.response.body = [ 'Bo', 'Luke', 'Daisy' ];
    next(env);
  });
}).use(oauthRuntime.argoMiddleware(
    // It seems like Argo doesn't strip the query parameters when checking the URI so here we go.
    { authorizeUri: '^/authorize.*',
      accessTokenUri: '/accesstoken'
    }))
  .listen(port);

console.log('Listening on %d', port);
