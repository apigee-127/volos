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

var VOLOS_APPLY = 'x-volos-apply';
var A127_APPLY = 'x-a127-apply';

var helpers = require('./helpers');

module.exports = middleware;

function middleware(req, res, next) {

  if (!req.swagger || !req.swagger.operation) { return next(); }

  var operation = req.swagger.operation;
  var mwChain = operation.volos ? operation.volos.mwChain : undefined; // cache

  if (!mwChain) {
    if (debug.enabled) { debug('creating volos chain for: ' + operation.operationId); }

    var middlewares = [
      createMiddlewareChain(operation[A127_APPLY], req),
      createMiddlewareChain(req.swagger.path[A127_APPLY], req),
      createMiddlewareChain(operation[VOLOS_APPLY], req),
      createMiddlewareChain(req.swagger.path[VOLOS_APPLY], req)
    ].filter(function(ea) { return !!ea; });

    mwChain = helpers.chain(middlewares);

    if (!req.swagger.volos) { req.swagger.volos = {}; }
    operation.volos.mwChain = mwChain;
  }

  mwChain(req, res, next);
}

function createMiddlewareChain(applications, req) {
  if (!applications) { return undefined; }
  var middlewares = [];
  _.each(applications, function(options, resourceName) {
    if (debug.enabled) { debug('chaining: ' + resourceName); }
    var resource = req.volos.resources[resourceName];
    if (!resource) { throw new Error('attempt to reference unknown resource: ' + resourceName); }
    var mwDef = resource.connectMiddleware();
    var mwFactory = mwDef.cache || mwDef.apply;  // quota is apply(), cache is cache()
    if (mwFactory) {
      if (_.isObject(options.key)) {
        options.key = helpers.getHelperFunction(resourceName + '.key', options.key);
      }
      var mw = mwFactory.apply(mwDef, [options || {}]);
      middlewares.push(mw);
    } else {
      throw new Error('unknown middleware: ' + resourceName);
    }
  });

  return helpers.chain(middlewares);
}

