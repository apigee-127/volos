'use strict';

var volos = require('./config/volos').default;
var proxy = require('./lib/proxy');
var _ = require('underscore');

// create Volos cache
var cache = volos.cache.create('cache', _.extend({
  ttl: 1000
}, volos.config));

var identifier;

// specifying an static identifier (or function returning an identifier) will override using the request url...
identifier = '/';

var cacheMiddleware = cache.connectMiddleware().cache(identifier);

proxy.createProxy(cacheMiddleware);
