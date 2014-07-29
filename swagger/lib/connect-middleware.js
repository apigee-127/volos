'use strict';

// Swagger OAuth: http://developers-blog.helloreverb.com/enabling-oauth-with-swagger/
// todo: hook up the swagger oauth routes
// todo: currently must *not* have same cache at global & operation levels

var _ = require('underscore');
var debug = require('debug')('swagger');

var deploymentConfig;
var resourcesMap; // name -> volos resource
var operationsMap = {}; // operationId -> middleware chain
var authorizationsMap = {}; // operationId -> middleware chain

module.exports = middleware;

// the middleware
function middleware(volosConfig) {

  deploymentConfig = volosConfig;
  resourcesMap = createResources();
  var mwChain = chain([ifAuthenticated, applyMiddleware]);

  return function(req, res, next) {
    if (debug.enabled) { debug('handle req: ' + req.path); }
    if (!getOperationId(req)) { return next(); }
    mwChain(req, res, next);
  };
}

// check Swagger OAuth2
function ifAuthenticated(req, res, next) {

  var operationId = getOperationId(req);
  if (!operationId) { return next(); }

  var authChain = authorizationsMap[operationId];

  if (!authChain) {
    // use the operation.authorizations if present, otherwise api.authorizations
    var authorizations = req.swagger.operation ? req.swagger.operation.authorizations : undefined;
    if (!authorizations) {
      authorizations = req.swagger.api ? req.swagger.api.authorizations : undefined;
    }

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
    authorizationsMap[operationId] = authChain;
  }

  authChain(req, res, next);
}

function getOperationId(req) {
  if (req.swagger && req.swagger.operation) {
    return req.swagger.operation.nickname;
  } else {
    debug('no operation defined for ' + req.path);
    return undefined;
  }
}

function applyMiddleware(req, res, next) {

  var operationId = getOperationId(req);
  if (!operationId) { return next(); }

  var mwChain = operationsMap[operationId];

  if (!mwChain) {
    var specific = deploymentConfig.operations[operationId];
    var global = deploymentConfig.global;

    mwChain = createMiddlewareChain(global.concat(specific));
    operationsMap[operationId] = mwChain;
  }

  mwChain(req, res, next);
}

function createMiddlewareChain(applications) {
  var middlewares = [];
  _.each(applications, function (application) {
    _.each(application, function(applicationOptions, resourceName) {
      var resource = resourcesMap[resourceName];
      var mwDef = resource.connectMiddleware();
      var mwFactory = mwDef.cache ? mwDef.cache : mwDef.apply;  // quota is apply(), cache is cache() todo: standardize
      var mw = mwFactory.apply(mwDef, applicationOptions || []);
      middlewares.push(mw);
    });
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

  _.each(deploymentConfig.resources, function(def, name) {
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
