/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2014 Apigee Corporation

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
'use strict';

var _ = require('underscore');
var path = require('path');
var debug = require('debug')('swagger');

var swagger;
var resourcesMap; // name -> volos resource
var authorizationsMap; // operationId -> middleware chain

var SERVICES = ['x-a127-services', 'x-volos-resources'];
var VOLOS_AUTH = 'x-volos-authorizations';
var A127_AUTH = 'x-a127-authorizations';
var OAUTH_PROP = 'x-volos-oauth-service';

var yamljs = require('yamljs');
var oauthSwagger = require('../spec/oauth_operations.yaml');

var helpers = require('./helpers');

module.exports = middleware;

// config is a hash
// config.helpers is a directory path pointing to helper modules. defaults to 'api/helpers'.
function middleware(swaggerObject, config) {

  config = config || {};
  helpers.init(config);

  setSwagger(swaggerObject);

  authorizationsMap = {};

  var mwFunction = function(req, res, next) {
    if (debug.enabled) { debug('handle req: ' + req.path); }
    if (!(req.swagger && req.swagger.operation)) { return next(); }

    if (!swagger) {
      setSwagger(req.swagger.swaggerObject);
    }

    ifAuthenticated(req, res, next);
  };

  mwFunction.resources = resourcesMap; // backward compatible and exposes the resourceMap to clients
  mwFunction.controllers = path.resolve(__dirname, 'controllers'); // to map default oauth token routes
  mwFunction.swaggerSecurityHandlers = swaggerSecurityHandlers();

  return mwFunction;
}

function swaggerSecurityHandlers() {

  var handlers = {}; // name -> handler

  _.each(resourcesMap, function(resource, name) {
    if (resource.validGrantTypes) { // validGrantTypes only exists on oauth
      handlers[name] = new SwaggerSecurityHandler(resource);
    }
  });

  return handlers;
}

function SwaggerSecurityHandler(oauth) {

  return function(request, securityDefinition, scopes, cb) {

    function done(err, result) {
      if (err) {
        debug('Authentication error: %s', err);
        cb(err);
      } else {
        request.token = result;
        cb();
      }
    }

    if (securityDefinition.type === 'oauth2') {
      debug('authenticate oauth, scopes: %s', scopes);
      oauth.verifyToken(request.headers.authorization, scopes, done);

    } else if (securityDefinition.type === 'apiKey') {
      var apiKey = scopes;
      debug('authenticate api key');
      oauth.verifyApiKey(apiKey, done);

    } else if (securityDefinition.type === 'basic') {
      debug('authenticate basic auth');
      var header = request.headers['authorization'] || '';
      var token = header.split(/\s+/).pop() || '';
      var auth = new Buffer(token, 'base64').toString();
      var usernamePassword = auth.split(/:/);
      oauth.verifyPassword(usernamePassword[0], usernamePassword[1], done);

    } else {
      // should never happen
      return cb(new Error(util.format('Invalidate type for security handler: %s', securityDefinition.type)));
    }
  }
}


function addResourcesToRequestMW() {
  var resources = {
    resources: resourcesMap
  };
  return function(req, res, next) {
    req.volos = resources;
    next();
  };
}

function setSwagger(swaggerObject) {
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
        if (debug.enabled) { debug('authenticate scope: ' + authorization.scope); }
        middlewares.push(oauth.connectMiddleware().authenticate(authorization.scope));
      });
    }

    middlewares.push(addResourcesToRequestMW());
    authChain = helpers.chain(middlewares);

    if (!operation.volos) { operation.volos = {}; }
    operation.volos.authChain = authChain;
  }

  authChain(req, res, next);
}

function createResources() {

  var services = {};

  SERVICES.forEach(function(serviceDefNameTuple) {
    _.each(swagger[serviceDefNameTuple], function(serviceDefinition, serviceName) {
      var module = require(serviceDefinition.provider);

      if (debug.enabled) {
        debug('creating service: ' + serviceName);
        debug('module: ' + serviceDefinition.provider);
        debug('options: ' + JSON.stringify(serviceDefinition.options));
      }

      if (serviceDefinition.options.passwordCheck) { // only exists on oauth
        serviceDefinition.options.passwordCheck =
          helpers.getHelperFunction(serviceName + ' passwordCheck', serviceDefinition.options.passwordCheck);
      }

      if (serviceDefinition.options.beforeCreateToken) { // only exists on oauth
        serviceDefinition.options.beforeCreateToken =
          helpers.getHelperFunction(serviceName + ' beforeCreateToken', serviceDefinition.options.beforeCreateToken);
      }

      // fallback only exists on Apigee cache
      // this is used to defer creation in the case it references a fallback cache yet to be created
      if (serviceDefinition.options.fallback) {
        var deferred = { deferredName: serviceDefinition.options.fallback };
        serviceDefinition.options.fallback = { create: function defer() { return deferred; } }
      }

      var service = services[serviceName] = module.create.apply(this, [serviceDefinition.options]);

      if (service.validGrantTypes) { // the presence of validGrantTypes identifies the service as oauth
        if (serviceDefinition.options.cache) {
          service.cacheName = serviceDefinition.options.cache;
        }
        if (serviceDefinition.options.tokenPaths) {
          importOAuthTokenPaths(serviceName, serviceDefinition.options.tokenPaths);
        }
      }
    });
  });

   // make 2nd pass to ensure forward cache references will work
  _.each(services, function(service, serviceName) {
    if (service.validGrantTypes && service.useCache && service.cacheName) {
      var cache = services[service.cacheName];
      service.useCache(cache);
    }
    if (service.cache && service.cache.deferredName) {
      if (!services[service.cache.deferredName]) {
        throw new Error('Cache fallback option must name a valid cache. Invalid reference: ' + service.cache.deferredName);
      }
      service.cache = services[service.cache.deferredName];
    }
  });

  return services;
}

function importOAuthTokenPaths(resourceName, paths) {

  if (paths.length === 0) { return; }

  var allPaths = swagger.paths || (swagger.paths = {});
  var allDefinitions = swagger.definitions || (swagger.definitions = {});

  // err if would overwrite any paths
  var allPathNames = Object.keys(allPaths);
  var existingPaths = _.filter(paths, function(path) { return _.contains(allPathNames, path); });
  if (existingPaths.length > 0) {
    throw new Error('Paths ' + existingPaths + ' already exist. Cannot insert OAuth.');
  }

  // err if would overwrite any definitions
  var existingDefinitions = _.filter(allDefinitions, function(key) {
    return _.contains(Object.keys(oauthSwagger.definitions), key);
  });
  if (existingDefinitions.length > 0) {
    throw new Error('Definitions ' + existingDefinitions + ' already exist. Cannot insert OAuth.');
  }

  // add the token paths
  _.each(paths, function(path, name) {
    var keyPath = '/' + name;
    allPaths[path] = oauthSwagger.paths[keyPath];
    if (!allPaths[path]) {
      var keys = Object.keys(oauthSwagger.paths).map(function(key) { return key.substring(1); });
      throw new Error('Invalid tokenPath key: ' + name + '. Must be one of: ' + keys);
    }
    allPaths[path][OAUTH_PROP] = resourceName;
  });

  // add the definitions
  _.each(oauthSwagger.definitions, function(value, key) {
    allDefinitions[key] = value;
  });
}
