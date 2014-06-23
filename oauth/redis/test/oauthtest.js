/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2013 Apigee Corporation

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

var config = require('../../../testconfig/testconfig-redis');
var expressTest = require('../../test/rfc6749_express_test');
var argoTest = require('../../test/rfc6749_argo_test');
var extensionsTest = require('../../test/extensions_test');

describe('Redis', function() {

  describe('via Argo', function() {
    argoTest.verifyOauth(config);
    extensionsTest.verifyOauth(config);
  });

  describe('via Express', function() {
    expressTest.verifyOauth(config);
    extensionsTest.verifyOauth(config);

    describe('with cache', function() {
      before(function(done) {
        var Cache = require('volos-cache-memory');
        var cache = Cache.create('OAuth cache');
        config.oauth.useCache(cache);
        done();
      });
      expressTest.verifyOauth(config);
      extensionsTest.verifyOauth(config);
    });
  });
});
