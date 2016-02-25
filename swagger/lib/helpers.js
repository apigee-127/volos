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
var helpersDir = 'api/helpers';
var SERVICES = ['x-a127-services', 'x-volos-resources'];
var OAUTH_PROP = 'x-volos-oauth-service';
var yaml = require('js-yaml');
var fs = require('fs');

var file = path.resolve(__dirname, '../spec/oauth_operations.yaml');
var oauthSwagger = yaml.safeLoad(fs.readFileSync(file, 'utf8'));

module.exports = {
  init: init,
  chain: chain,
  getHelperFunction: getHelperFunction,
  createResources: createResources
};

function init(config) {
  helpersDir = config.helpers || helpersDir;
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

function createResources(swagger) {

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
          getHelperFunction(serviceName + ' passwordCheck', serviceDefinition.options.passwordCheck);
      }

      if (serviceDefinition.options.beforeCreateToken) { // only exists on oauth
        serviceDefinition.options.beforeCreateToken =
          getHelperFunction(serviceName + ' beforeCreateToken', serviceDefinition.options.beforeCreateToken);
      }

      if (serviceDefinition.options.finalizeRecord) { // only exists on analytics
        serviceDefinition.options.finalizeRecord =
          getHelperFunction(serviceName + ' finalizeRecord', serviceDefinition.options.finalizeRecord);
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
          importOAuthTokenPaths(swagger, serviceName, serviceDefinition.options.tokenPaths);
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

function importOAuthTokenPaths(swagger, resourceName, paths) {

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
