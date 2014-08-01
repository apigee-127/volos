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

var apigeetool = require('apigeetool');
var assert = require('assert');
var childProcess = require('child_process');
var path = require('path');

var testConfig = require('../../testconfig/testconfig-apigee');
var config = testConfig.config;

var TEST_ENVIRONMENT = 'test';
var PROXY_NAME = 'volostests';
var LONG_TIMEOUT = 60000;

describe('Apigee Server Tests', function() {
  var deployedRevision;

  before(function() {
    if (!config.testUriBase) {
      throw new Error('Configuration is missing the "testUriBase" parameter');
    }
  });

  before(function(done) {
    this.timeout(LONG_TIMEOUT);
    childProcess.exec(path.join(__dirname, '../pkgapigee.sh'),
      function(err) {
        if (err) {
          console.error('Error packaging test directory: %j', err);
        }
        done(err);
      });
  });

  before(function(done) {
    this.timeout(LONG_TIMEOUT);
    var o = {
      username: config.user,
      password: config.password,
      organization: config.organization,
      environment: TEST_ENVIRONMENT,
      api: PROXY_NAME,
      directory: path.join(__dirname, '../apigee'),
      verbose: true
    };
    if (config.managementUri) {
      o.baseuri = config.managementUri;
    }

    apigeetool.deployProxy(o, function(err, result) {
      if (err) {
        console.error('Error deploying proxy: %j', err);
        done(err);
      } else {
        console.log('Deployment result: %j', result);
        deployedRevision = result.revision;
        done();
      }
    });
  });

  after(function(done) {
    this.timeout(LONG_TIMEOUT);
    var o = {
      username: config.user,
      password: config.password,
      organization: config.organization,
      environment: TEST_ENVIRONMENT,
      api: PROXY_NAME,
      directory: path.join(__dirname, '../apigee'),
      revision: deployedRevision
    };
    if (config.managementUri) {
      o.baseuri = config.managementUri;
    }

    apigeetool.undeploy(o, function(err) {
      if (err) {
        console.error('Error undeploying proxy: %j', err);
      } else {
        console.log('Undeployed revision %d', deployedRevision);
      }
      done(err);
    });
  });

  describe('Cache', function() {
    var test = require('../../cache/test/verifycache.js');
    test.verify(config.testUriBase + '/volostests-apigeecache');
  });

  describe('Quota', function() {
    var test = require('../../quota/test/verifyquota.js');
    test.verify(config.testUriBase + '/volostests-apigeequota');
  });

  describe('OAuth', function() {
    var test = require('../../oauth/test/rfc6749_common.js');
    test.verifyOauth(testConfig, config.testUriBase + '/volostests-apigeeoauth');
  });
});
