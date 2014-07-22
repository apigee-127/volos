'use strict';

var volos = require('./config/volos').default;
var proxy = require('./lib/proxy');

// create Volos cache
var cache = volos.cache.create('cache', {
  ttl: 1000
});

var identifier;

// specifying an static identifier (or function returning an identifier) will override using the request url...
identifier = '/';

var cacheMiddleware = cache.connectMiddleware().cache(identifier);

proxy.createProxy(cacheMiddleware);
