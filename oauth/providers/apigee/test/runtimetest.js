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

var testOpts = require('../../../../common/testconfig-apigee');
var mgmt = testOpts.management;
var runtime = mgmt.runtime;
var assert = require('assert');
var url = require('url');

var TestDeveloperId = 'joe2@schmoe.io';
var TestAppName = 'APIDNA-Runtime-Test';

var DefaultTokenLifetime = 3600000;
var DefaultRedirectUri = 'http://example.org';

describe('Apigee Runtime SPI', function() {
  var developer;
  var app;
  var authCode;
  var refreshToken;
  var accessToken;

  before(function(done) {
    // Step 1 -- clean up
    mgmt.deleteDeveloper(TestDeveloperId, function(err) {
      if (err) {
        console.log('Error deleting test developer -- but this is OK');
      }

      // Step 2 -- re-create sample developer and app
      console.log('Creating developer %s', TestDeveloperId);
      mgmt.createDeveloper({
        firstName: 'Joe', lastName: 'Schmoe', email: TestDeveloperId, userName: 'jschmoe2'
      }, function(err, newDev) {
        if (err) {
          throw err;
        }
        developer = newDev;

        console.log('Creating application %s for developer %s', TestAppName, developer.id);
        mgmt.createApp({
          name: TestAppName, developerId: developer.id
        }, function(err, newApp) {
          if (err) {
            throw err;
          }
          console.log('Created app %s', newApp.id);
          app = newApp;
          done();
        });
      });
    });
  });

  it('Create Client Credentials Token', function(done) {
    var tr = {
      clientId: app.credentials[0].key,
      clientSecret: app.credentials[0].secret,
      tokenLifetime: DefaultTokenLifetime
    };
    console.log('Create client credentials: %j', tr);

    runtime.createTokenClientCredentials(tr, function(err, result) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      assert(result);
      console.log('New token: %j', result);
      assert(result.access_token);
      assert(!result.refresh_token);
      assert.equal(result.token_type, 'client_credentials');
      assert(result.expires_in <= (DefaultTokenLifetime / 1000));
      done();
    });
  });

  it('Create Password Credentials Token', function(done) {
    var tr = {
      clientId: app.credentials[0].key,
      clientSecret: app.credentials[0].secret,
      tokenLifetime: DefaultTokenLifetime,
      username: 'notchecking',
      password: 'likeisaid'
    };
    console.log('Create password: %j', tr);

    runtime.createTokenPasswordCredentials(tr, function(err, result) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      assert(result);
      console.log('New token: %j', result);
      assert(result.access_token);
      assert(result.refresh_token);
      assert.equal(result.token_type, 'password');
      assert(result.expires_in <= (DefaultTokenLifetime / 1000));
      refreshToken = result.refresh_token;
      done();
    });
  });

  it('Refresh token', function(done) {
    var tr = {
      clientId: app.credentials[0].key,
      clientSecret: app.credentials[0].secret,
      tokenLifetime: DefaultTokenLifetime,
      refreshToken: refreshToken
    };
    console.log('Refresh token: %j', tr);

    runtime.refreshToken(tr, function(err, result) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      assert(result);
      console.log('Refreshed token: %j', result);
      assert(result.expires_in <= (DefaultTokenLifetime / 1000));
      assert(result.access_token);
      accessToken = result.access_token;
      done();
    });
  });

  it('Verify token', function(done) {
    runtime.verifyToken(accessToken, function(err, result) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      console.log('Verified token: %j', result);
      done();
    });
  });

  it('Invalidate token', function(done) {
    var tr = {
      clientId: app.credentials[0].key,
      clientSecret: app.credentials[0].secret,
      accessToken: accessToken
    };
    console.log('InvalidateToken token: %j', tr);

    runtime.invalidateToken(tr, function(err, result) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      done();
    });
  });

  it('Create authorization code', function(done) {
    var tr = {
      clientId: app.credentials[0].key,
      redirectUri: DefaultRedirectUri
    };
    console.log('Create authorization code: %j', tr);

    runtime.generateAuthorizationCode(tr, function(err, result) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      assert(result);
      var pr = url.parse(result, true);
      console.log('Result: %s', result);
      authCode = pr.query.code;
      done();
    });
  });

  it('Create Authorization Code Token', function(done) {
    var tr = {
      clientId: app.credentials[0].key,
      clientSecret: app.credentials[0].secret,
      code: authCode,
      redirectUri: DefaultRedirectUri,
      tokenLifetime: DefaultTokenLifetime
    };
    console.log('Create client credentials: %j', tr);

    runtime.createTokenAuthorizationCode(tr, function(err, result) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      assert(result);
      console.log('New token: %j', result);
      assert(result.access_token);
      assert(result.refresh_token);
      assert.equal(result.token_type, 'authorization_code');
      assert(result.expires_in <= (DefaultTokenLifetime / 1000));
      done();
    });
  });

  it('Create Implicit Token', function(done) {
    var tr = {
      clientId: app.credentials[0].key,
      clientSecret: app.credentials[0].secret,
      tokenLifetime: DefaultTokenLifetime,
      redirectUri: DefaultRedirectUri
    };
    console.log('Create implicit: %j', tr);

    runtime.createTokenImplicitGrant(tr, function(err, result) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      assert(result);
      var pr = url.parse(result, true);
      console.log('New token: %j', pr);
      done();
    });
  });

  after(function(done) {
    console.log('Cleanup -- deleting app %s', app.id);
    mgmt.deleteApp(app.id, function(err) {
      if (err) {
        console.error('Error deleting app: %j', err);
      }
      console.log('Deleting developer %s', developer.id);
      mgmt.deleteDeveloper(developer.id, function(err) {
        if (err) {
          console.error('Error deleting developer: %j', err);
        }
        done();
      });
    });
  });
});

