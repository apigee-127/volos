var argo = require('argo');
var spi = require('../../apigee-runtime');
var oauth = require('..');
var opts = require('../../common/testconfig');

var port = 10011;

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

argo()
  .get('/dogs', function(handle) {
  handle('request', function(env, next) {
    env.response.body = [ 'Bo', 'Luke', 'Daisy' ];
    next(env);
  });
})
  .get('/ok', function(handle) {
    handle('request', function(env, next) {
      env.response.body = 'ok';
      next(env);
    });
  })
  .use(oauthRuntime.argoMiddleware(
    // It seems like Argo doesn't strip the query parameters when checking the URI so here we go.
    { authorizeUri: '^/authorize.*',
      accessTokenUri: '/accesstoken'
    }))
  .listen(port);

