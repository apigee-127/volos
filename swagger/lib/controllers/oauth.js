'use strict';

module.exports = {
  token: token,
  authorize: authorize,
  invalidate: invalidate,
  refresh: refresh
};

function authorize(req, res, next) {
  req.volos.oauth.expressMiddleware().handleAuthorize()(req, res, next);
}

function token(req, res, next) {
  req.volos.oauth.expressMiddleware().handleAccessToken()(req, res, next);
}

function invalidate(req, res, next) {
  req.volos.oauth.expressMiddleware().invalidateToken()(req, res, next);
}

function refresh(req, res, next) {
  req.volos.oauth.expressMiddleware().refreshToken()(req, res, next);
}
