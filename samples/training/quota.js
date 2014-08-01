'use strict';

var volos = require('./config/volos').default;
var proxy = require('./lib/proxy');
var _ = require('underscore');

// create Volos quota
var quota = volos.quota.create(_.extend({
  timeUnit: 'minute',
  interval: 1,
  allow: 2
}, volos.config));

var middlewareOptions = {
  identifier: '*', // specifying an identifier will override using the request url
  weight: 1
};

// applies quota to each request
var middleware = quota.connectMiddleware().apply(middlewareOptions);

proxy.createProxy(middleware);
