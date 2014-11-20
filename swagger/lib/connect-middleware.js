'use strict';

var _ = require('underscore');
var path = require('path');
var debug = require('debug')('swagger');

var swagger;
var resourcesMap; // name -> volos resource
var operationsMap; // operationId -> middleware chain
var authorizationsMap; // operationId -> middleware chain
var helpersDir = 'api/helpers';

var SERVICES = ['x-a127-services', 'x-volos-resources'];
var VOLOS_APPLY = 'x-volos-apply';
var A127_APPLY = 'x-a127-apply';
var VOLOS_AUTH = 'x-volos-authorizations';
var A127_AUTH = 'x-a127-authorizations';

var yamljs = require('yamljs');
var oauthSwagger = require('../spec/oauth_operations.yaml');

module.exports = middleware;

// config is a hash
// config.helpers is a directory path pointing to helper modules. defaults to 'api/helpers'.
function middleware(swaggerObject, config) {

  config = config || {};
  helpersDir = config.helpers || helpersDir;

  setSwagger(swaggerObject, config);

  operationsMap = {};
  authorizationsMap = {};
  var mwChain = chain([ifAuthenticated, applyMiddleware]);

  var mwFunction = function(req, res, next) {
    if (debug.enabled) { debug('handle req: ' + req.path); }
    if (!(req.swagger && req.swagger.operation)) { return next(); }

    if (!swagger) {
      setSwagger(req.swagger.swaggerObject, config);
    }

    mwChain(req, res, next);
  };

  mwFunction.resources = resourcesMap; // backward compatible and exposes the resourceMap to clients
  mwFunction.controllers = path.resolve(__dirname, 'controllers'); // to map default oauth token routes

  return mwFunction;
}

function addResourceToRequestMW(oauth) {
  var resource = { oauth: oauth};
  return function(req, res, next) {
    req.volos = resource;
    next();
  };
}

function setSwagger(swaggerObject, config) {
  if (swaggerObject) {
    swagger = swaggerObject;
    resourcesMap = createResources();
  }
}

// check Swagger OAuth2
function ifAuthenticated(req, res, next) {

  var operation = req.swagger.operation;
  var authChain = operation.volos ? operation.volos.authChain : undefined; // cache

  if (!authChain) {
    if (debug.enabled) { debug('creating auth chain for: ' + operation.operationId); }

    var authorizations = operation[A127_AUTH] ||
                         req.swagger.path[A127_AUTH] ||
                         operation[VOLOS_AUTH] ||
                         req.swagger.path[VOLOS_AUTH];

    var middlewares = [];
    if (authorizations) {
      _.each(authorizations, function(authorization, name) {
        var oauth = resourcesMap[name];
        var scopes = [];
        if (debug.enabled) { debug('authenticate scope: ' + authorization.scope); }
        middlewares.push(oauth.connectMiddleware().authenticate(authorization.scope));
      });
    }

    middlewares.push(addResourceToRequestMW(req.swagger.path.oauth));
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

    var middlewares = [
      createMiddlewareChain(operation[A127_APPLY]),
      createMiddlewareChain(req.swagger.path[A127_APPLY]),
      createMiddlewareChain(operation[VOLOS_APPLY]),
      createMiddlewareChain(req.swagger.path[VOLOS_APPLY])
    ].filter(function(ea) { return !!ea; });

    mwChain = chain(middlewares);

    if (!req.swagger.volos) { req.swagger.volos = {}; }
    operation.volos.mwChain = mwChain;
  }

  mwChain(req, res, next);
}

function createMiddlewareChain(applications) {
  if (!applications) { return undefined; }
  var middlewares = [];
  _.each(applications, function(options, resourceName) {
    if (debug.enabled) { debug('chaining: ' + resourceName); }
    var resource = resourcesMap[resourceName];
    if (!resource) { throw new Error('attempt to reference unknown resource: ' + resourceName); }
    var mwDef = resource.connectMiddleware();
    var mwFactory = mwDef.cache || mwDef.apply;  // quota is apply(), cache is cache()
    if (mwFactory) {
      if (_.isObject(options.key)) {
        options.key = getHelperFunction(resourceName + '.key', options.key);
      }
      var mw = mwFactory.apply(mwDef, [options || {}]);
      middlewares.push(mw);
    } else {
      throw new Error('unknown middleware: ' + resourceName);
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

  SERVICES.forEach(function(resource) {
    _.each(swagger[resource], function(def, name) {
      var module = require(def.provider);

      if (debug.enabled) {
        debug('creating resource: ' + name);
        debug('module: ' + def.provider);
        debug('options: ' + JSON.stringify(def.options));
      }

      if (def.options.passwordCheck) { // only exists on oauth
        def.options.passwordCheck = getHelperFunction(name + ' passwordCheck', def.options.passwordCheck);
      }

      var resource = module.create.apply(this, [def.options]);

      if (def.options.tokenPaths) { // only exists on oauth
        importOAuth(resource, def.options.tokenPaths);
      }

      resources[name] = resource;
    });
  });

  return resources;
}

function importOAuth(oauth, paths) {

  if (paths.length === 0) { return; }

  var allPaths = swagger.paths || (swagger.paths = {});
  var allDefinitions = swagger.definitions || (swagger.definitions = {});

  // err if would overwrite any paths
  var existingPaths = _.filter(paths, function(path) { return _.contains(allPaths, path); });
  if (existingPaths.length > 0) {
    throw new Error('Paths ' + existingPaths + ' already exist. Cannot insert OAuth.');
  }

  // err if would overwrite any definitions
  var existingDefinitions = _.filter(allDefinitions, function(key) {
    return _.contains(Object.keys(oauthSwagger.definitions), key);
  });
  if (existingDefinitions.length > 0) {
    throw new Error('Definition ' + existingDefinitions + ' already exist. Cannot insert OAuth.');
  }

  // add the token paths
  _.each(paths, function(path, name) {
    var keyPath = '/' + name;
    allPaths[path] = oauthSwagger.paths[keyPath];
    if (!allPaths[path]) {
      var keys = Object.keys(oauthSwagger.paths).map(function(key) { return key.substring(1); });
      throw new Error('Invalid tokenPath key: ' + name + '. Must be one of: ' + keys);
    }
    allPaths[path].oauth = oauth;
  });

  // add the definitions
  _.each(oauthSwagger.definitions, function(value, key) {
    allDefinitions[key] = value;
  });
}


function getHelperFunction(resourceName, options) {
  if (_.isFunction(options)) { return options; }
  if (options.helper && options.function) {
    var helperPath = path.join(helpersDir, options.helper);
    var helper = require(helperPath);
    var func = helper[options.function];
    if (!func) {
      throw new Error('unknown function: \'' + options.function + '\' on helper: ' + helperPath);
    }
    return func;
  } else {
    throw new Error('illegal options for: ' + resourceName);
  }
}
