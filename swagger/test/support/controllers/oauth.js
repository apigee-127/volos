'use strict';

module.exports = {
  token: token
};

function token(req, res, next) {
  req.volos.oauth.expressMiddleware().handleAccessToken()(req, res, next);
}
