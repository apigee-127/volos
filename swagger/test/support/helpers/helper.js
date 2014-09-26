'use strict';

module.exports = {
  quotaId: quotaId,
  cacheId: cacheId,
  passwordCheck: passwordCheck,
  spikeArrestId: spikeArrestId
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
