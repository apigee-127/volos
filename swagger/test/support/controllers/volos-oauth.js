'use strict';

module.exports = {
  token: token
};

function token(req, res, next) {
  var oauth = req.volos.resources[req.swagger.path['x-volos-oauth-service']];
  oauth.expressMiddleware().handleAccessToken()(req, res, next);
}
