'use strict';

module.exports = {
  quotaId: quotaId,
  cacheId: cacheId,
  passwordCheck: passwordCheck,
  spikeArrestId: spikeArrestId,
  beforeCreateToken: beforeCreateToken
};

function quotaId(req) {
  return '/quota';
}

function cacheId(req) {
  return '/cached';
}

function spikeArrestId(req) {
  return 'spikeArrest';
}

function passwordCheck(username, password, cb) {
  cb(null, username === password);
}

function beforeCreateToken(parsedBody, options, next) {
  options.attributes = options.attributes || {};
  options.attributes['beforeCreateTokenCalled'] = true;
  next();
}
