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

var agent = require('superagent');
var apigeetool = require('apigeetool');
var assert = require('assert');
var childProcess = require('child_process');
var path = require('path');

var testConfig = require('../../testconfig/testconfig-apigee');
var config = testConfig.config;

var TEST_ENVIRONMENT = 'test';
var PROXY_NAME = 'volostests';
var LONG_TIMEOUT = 120000;

describe('Apigee Server Tests', function() {
  var deployedRevision;

  before(function() {
    if (!config.testUriBase) {
      throw new Error('Configuration is missing the "testUriBase" parameter');
    }
  });

/* Doesn't seem to work at all
  describe('Cache via remote Express', function() {
    var test = require('../../cache/test/verifycache.js');
    test.verify(config.testUriBase + '/volostests-apigeecache');
  });
  */

  describe('Cache SPI from inside Apigee', function() {
    it('SPI test', function(done) {
      this.timeout(10000);
      remoteMochaTest(config.testUriBase + '/volostests-mocha/cache', done);
    });
  });

  describe('Quota via remote Express', function() {
    var test = require('../../quota/test/verifyquota.js');
    test.verify(config.testUriBase + '/volostests-apigeequota');
  });

  describe('Quota SPI from inside Apigee', function() {
    this.timeout(120000);
    it('SPI test', function(done) {
      remoteMochaTest(config.testUriBase + '/volostests-mocha/quota', done);
    });
  });

  describe('OAuth via remote Express and Argo', function() {
    var test = require('../../oauth/test/rfc6749_common.js');
    test.verifyOauth(testConfig, config.testUriBase + '/volostests-apigeeoauth');
  });

});
function remoteMochaTest(uri, done) {
  agent.post(uri).end(function(err, resp) {
    if (err) {
      console.error('Mocha test error: %j', err);
      done(err);
    } else {
      console.log('Mocha test result: %s', resp.text);
      try {
        assert.equal(resp.text, '0');
        done();
      } catch (e) {
        done(e);
      }
    }
  });
}
