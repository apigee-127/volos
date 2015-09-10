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

var resourcesMap; // name -> volos resource
var authorizationsMap; // operationId -> middleware chain

var VOLOS_AUTH = 'x-volos-authorizations';
var A127_AUTH = 'x-a127-authorizations';

var helpers = require('./helpers');

module.exports = middleware;

// config is a hash
// config.helpers is a directory path pointing to helper modules. defaults to 'api/helpers'.
function middleware(swaggerObject, config) {

  config = config || {};
  helpers.init(config);

  if (swaggerObject) {
    resourcesMap = helpers.createResources(swaggerObject);
  }

  authorizationsMap = {};

  var mwFunction = function(req, res, next) {
    if (debug.enabled) { debug('handle req: ' + req.path); }
    if (!(req.swagger && req.swagger.operation)) { return next(); }

    if (!swaggerObject) {
      resourcesMap = helpers.createResources(req.swagger.swaggerObject);
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
