'use strict';

module.exports = {
  quotaId: quotaId,
  cacheId: cacheId
};

function quotaId(req) {
  return '/quota';
}

function cacheId(req) {
  return '/cached';
}
