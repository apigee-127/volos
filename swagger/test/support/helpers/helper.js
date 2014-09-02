'use strict';

module.exports = {
  quotaId: quotaId,
  cacheId: cacheId,
  passwordCheck: passwordCheck
};

function quotaId(req) {
  return '/quota';
}

function cacheId(req) {
  return '/cached';
}

function passwordCheck(username, password, cb) {
  cb(null, username === password);
}
