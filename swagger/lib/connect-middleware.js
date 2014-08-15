'use strict';

var _ = require('underscore');
var debug = require('debug')('swagger');

var swagger;
var resourcesMap; // name -> volos resource
var operationsMap; // operationId -> middleware chain
var authorizationsMap; // operationId -> middleware chain

var RESOURCES = 'x-volos-resources';
var APPLY = 'x-volos-apply';
var AUTH = 'x-volos-authorizations';

module.exports = middleware;

// the middleware
function middleware(swaggerObject) {

  if (swaggerObject) {
    swagger = swaggerObject;
    resourcesMap = createResources();
  }

  operationsMap = {};
  authorizationsMap = {};
  var mwChain = chain([ifAuthenticated, applyMiddleware]);

  return function(req, res, next) {
    if (debug.enabled) { debug('handle req: ' + req.path); }
    if (!(req.swagger && req.swagger.operation)) { return next(); }

    if (!swagger) {
      swagger = req.swagger.swaggerObject;
      resourcesMap = createResources();
    }

    mwChain(req, res, next);
  };
}

// check Swagger OAuth2
function ifAuthenticated(req, res, next) {

  var operation = req.swagger.operation;
  var authChain = operation.volos ? operation.volos.authChain : undefined; // cache

  if (!authChain) {
    if (debug.enabled) { debug('creating auth chain for: ' + operation.operationId); }

    var authorizations = operation[AUTH] || req.swagger.path[AUTH];

    var middlewares = [];
    if (authorizations) {
      _.each(authorizations, function(authorization, name) {
        var oauth = resourcesMap[name];
        var scopes = [];
        _.each(authorization, function(scopeDecl) {
          if (scopeDecl.scope) { scopes.push(scopeDecl.scope); }
        });
        if (debug.enabled) { debug('authenticate scopes: ' + scopes); }
        if (_.isEmpty(scopes)) { scopes = null; }
        middlewares.push(oauth.connectMiddleware().authenticate(scopes));
      });
    }

    authChain = chain(middlewares);

    if (!operation.volos) { operation.volos = {}; }
    operation.volos.authChain = authChain;
  }

  authChain(req, res, next);
}

function applyMiddleware(req, res, next) {

  var operation = req.swagger.operation;
  var mwChain = operation.volos ? operation.volos.mwChain : undefined; // cache

  if (!mwChain) {
    if (debug.enabled) { debug('creating volos chain for: ' + operation.operationId); }
    var opMw = createMiddlewareChain(operation[APPLY] || []);
    var pathMw = createMiddlewareChain(req.swagger.path[APPLY] || []);

    mwChain = chain([opMw, pathMw]);

    if (!req.swagger.volos) { req.swagger.volos = {}; }
    operation.volos.mwChain = mwChain;
  }

  mwChain(req, res, next);
}

function createMiddlewareChain(applications) {
  var middlewares = [];
  _.each(applications, function(applicationOptions, resourceName) {
    if (debug.enabled) { debug('chaining: ' + resourceName); }
    var resource = resourcesMap[resourceName];
    var mwDef = resource.connectMiddleware();
    var mwFactory = mwDef.cache || mwDef.apply;  // quota is apply(), cache is cache()
    if (mwFactory) {
      var mw = mwFactory.apply(mwDef, applicationOptions || []);
      middlewares.push(mw);
    } else {
      if (debug.enabled) { debug('unknown middleware: ' + mwDef); }
    }
  });

  return chain(middlewares);
}

function chain(middlewares) {

  if (!middlewares || middlewares.length < 1) {
    return function(req, res, next) { next(); };
  }

  return function(req, res, next) {
    function createNext(middleware, index) {
      return function(err) {
        if (err) { return next(err); }

        var nextIndex = index + 1;
        var nextMiddleware = middlewares[nextIndex] ? createNext(middlewares[nextIndex], nextIndex) : next;
        middleware(req, res, nextMiddleware);
      };
    }
    return createNext(middlewares[0], 0)();
  };
}

function createResources() {

  var resources = {};

  _.each(swagger[RESOURCES], function(def, name) {
    var module = require(def.provider);
    var options = _.isArray(def.options) ? def.options : [def.options];

    if (debug.enabled) {
      debug('creating resource: ' + name);
      debug('module: ' + def.provider);
      debug('options: ' + JSON.stringify(options));
    }

    var resource = module.create.apply(this, options);
    resources[name] = resource;
  });

  return resources;
}
