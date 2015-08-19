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
"use strict";

var commonTest = require('../../test/mgmttest');
var config = require('../../../testconfig/testconfig-apigee');
var should = require('should');

var API_PROD_NAME = 'APIDNA-Unit-Test-ApiProduct';
var mgmt = config.management.getSpi();

describe('Apigee', function() {

  this.timeout(10000);

  before(function() {
    // Clean up old test data
    mgmt.deleteApiProduct(API_PROD_NAME, function(err) {
      if (err) {
        console.log('ApiProduct %s doesn\'t exist. Good', API_PROD_NAME);
      } else {
        console.log('Delete ApiProduct %s', API_PROD_NAME);
      }
    });
  });

  it('Create API Product', function(done) {
    var api = {
      name: API_PROD_NAME,
      environments : [ "test" ],
      scopes: ['scope1', 'scope2']
    };
    mgmt.createApiProduct(api, function(err, apiProd) {
      if (err) { console.error('%j', err); }
      should.not.exist(err);
      api.name.should.equal(apiProd.name);
      api.scopes.should.equal(api.scopes);

      done();
    });
  });

  it('Delete API Product', function(done) {
    setTimeout(function() { // give the create a little time to settle
      mgmt.deleteApiProduct(API_PROD_NAME, function(err) {
        if (err) { console.error('%j', err); }
        should.not.exist(err);

        done();
      });
    }, 1000);
  });

  commonTest.testManagement(config);

});
