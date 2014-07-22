'use strict';

var volos = require('./config/volos').default;
var proxy = require('./lib/proxy');

// create Volos quota
var quota = volos.quota.create({
  timeUnit: 'minute',
  interval: 1,
  allow: 2
});

var middlewareOptions = {
  identifier: '*', // specifying an identifier will override using the request url
  weight: 1
};

// applies quota to each request
var middleware = quota.connectMiddleware().apply(middlewareOptions);

proxy.createProxy(middleware);
