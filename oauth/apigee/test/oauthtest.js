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

var config = require('../../../testconfig/testconfig-apigee');
var expressTest = require('../../test/rfc6749_express_test');
var argoTest = require('../../test/rfc6749_argo_test');
var extensionsTest = require('../../test/extensions_test');
var should = require('should');

describe('Apigee', function() {
  this.timeout(30000);

  describe('exclusive', function() {

    var oauth = config.oauth;
    var creator = config.fixtureCreator;

    describe('volos extensions', function() {

      var client_id, client_secret;

      before(function(done) {
        creator.createFixtures(function(err, apps) {
          if (err) { return done(err); }
          client_id = apps[0].credentials[0].key;
          client_secret = apps[0].credentials[0].secret;
          done();
        });
      });

      after(function(done) {
        creator.destroyFixtures(done);
      });

      it('verify valid apiKey', function(done) {
        var request = null;
        oauth.spi.getAPIKeyAttributes(client_id, request, function(err, response) {
          should.not.exist(err);
          should.exist(response);
          response.should.have.property('client_id', client_id);
          response.should.have.property('status', 'approved');
          response.should.have.keys('client_id', 'status', 'apiproduct_name', 'attributes', 'developer_app_id',
                                    'developer_app_name', 'developer_email', 'developer_id', 'expires_in', 'issued_at', 'developer', 'app');
          done();
        });
      });

      it('should allow specification of refresh token lifetime', function(done) {
        var options = {
          clientId: client_id,
          clientSecret: client_secret,
          username: config.validUserCreds.username,
          password: config.validUserCreds.password,
          refreshTokenLifetime: 60000
        };
        oauth.spi.createTokenPasswordCredentials(options, function(err, token) {
          should.not.exist(err);
          token.should.have.property('refresh_token');
          token.should.have.property('refresh_token_expires_in');
          token.refresh_token_expires_in.should.be.approximately(55, 5);

          done();
        });
      });

    });
  });

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
