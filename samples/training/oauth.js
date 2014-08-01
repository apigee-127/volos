'use strict';

var volos = require('./config/volos').default;
var proxy = require('./lib/proxy');

// create Volos oauth
var oauth = volos.oauth.create(volos.config);

var scopes;

// required scopes may optionally be specified
//scopes = 'scope1 scope2';

var middleware = oauth.connectMiddleware().authenticate(scopes);

proxy.createProxy(middleware);
