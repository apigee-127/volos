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

var assert = require('assert');
var url = require('url');

var TEST_DEVELOPER_NAME = 'joe2@schmoe.io';
var TEST_APP_NAME = 'APIDNA-Runtime-Test';
var TEST_SCOPED_APP_NAME = 'APIDNA-Runtime-Test-Scoped';
var DEFAULT_SCOPE = 'default';
var OTHER_SCOPE = 'other';
var VALID_SCOPES = [DEFAULT_SCOPE, OTHER_SCOPE];

var DEFAULT_TOKEN_LIFETIME = 3600000;
var DEFAULT_REDIRECT_URL = 'http://example.org';

exports.testOauth = function(config) {

  var mgmt = config.management;
  var runtime = mgmt.runtime;

  describe('OAuth SPI', function() {
    var developer;
    var app;
    var scopedApp;
    var authCode;
    var refreshToken;
    var accessToken;

    before(function(done) {
      // Step 1 -- clean up
      mgmt.deleteDeveloper(TEST_DEVELOPER_NAME, function(err) {
        if (err) { console.log('Error deleting test developer -- but this is OK'); }

        // Step 2 -- re-create sample developer and app
        console.log('Creating developer %s', TEST_DEVELOPER_NAME);
        mgmt.createDeveloper({
          firstName: 'Joe', lastName: 'Schmoe', email: TEST_DEVELOPER_NAME, userName: 'jschmoe2'
        }, function(err, newDev) {
          if (err) { throw err; }
          developer = newDev;

          console.log('Creating application %s for developer %s', TEST_APP_NAME, developer.id);
          mgmt.createApp({
            name: TEST_APP_NAME, developerId: developer.id
          }, function(err, newApp) {
            if (err) { throw err; }
            console.log('Created app %s', newApp.id);
            app = newApp;

            mgmt.createApp({
              name: TEST_SCOPED_APP_NAME, developerId: developer.id, defaultScope: DEFAULT_SCOPE, validScopes: VALID_SCOPES
            }, function(err, newApp) {
              if (err) { throw err; }
              console.log('Created app %s', newApp.id);
              scopedApp = newApp;
            });

            var tr = {
              clientId: app.credentials[0].key,
              clientSecret: app.credentials[0].secret,
              username: 'notchecking',
              password: 'likeisaid'
            };
            runtime.createTokenPasswordCredentials(tr, function(err, result) {
              assert(!err);
              assert(result.access_token);
              assert(result.refresh_token);
              accessToken = result.access_token;
              refreshToken = result.refresh_token;

              done();
            });
          });
        });
      });
    });

    after(function(done) {
      console.log('Cleanup -- deleting app %s', app.id);
      mgmt.deleteApp(app.id, function(err) {
        if (err) { console.error('Error deleting app: %j', err); }
        console.log('Deleting developer %s', developer.id);
        mgmt.deleteDeveloper(developer.id, function(err) {
          if (err) { console.error('Error deleting developer: %j', err); }
          done();
        });
      });
    });


    describe('Create Client Credentials Token', function() {

      it('Successfully', function(done) {
        var tr = {
          clientId: app.credentials[0].key,
          clientSecret: app.credentials[0].secret,
          tokenLifetime: DEFAULT_TOKEN_LIFETIME
        };
        console.log('Create client credentials: %j', tr);

        runtime.createTokenClientCredentials(tr, function(err, result) {
          if (err) { console.error('%j', err); }
          assert(!err);
          assert(result);
          console.log('New token: %j', result);
          assert(result.access_token);
          assert(!result.refresh_token);
          assert(!result.scope);
          assert.equal(result.token_type, 'client_credentials');
          assert(result.expires_in <= (DEFAULT_TOKEN_LIFETIME / 1000));

          // verify token
          runtime.verifyToken(result.access_token, null, null, function(err, result) {
            if (err) { console.error('%j', err); }
            assert(!err);

            // invalidate token
            tr.accessToken = result.accessToken;
            runtime.invalidateToken(tr, function(err, result) {
              if (err) { console.error('%j', err); }
              assert(!err);

              // verify token again - should fail now
              runtime.verifyToken(result.access_token, null, null, function(err, result) {
                assert(err);
              });
            });
          });

          done();
        });
      });

      it('Invalid Scope', function(done) {
        var tr = {
          clientId: scopedApp.credentials[0].key,
          clientSecret: scopedApp.credentials[0].secret,
          tokenLifetime: DEFAULT_TOKEN_LIFETIME,
          scope: 'foo'
        };
        console.log('Create client credentials: %j', tr);

        runtime.createTokenClientCredentials(tr, function(err, result) {
          assert(err);
          assert(err.message === 'invalid_scope');
          done();
        });
      });

      it('Default Scope', function(done) {
        var tr = {
          clientId: scopedApp.credentials[0].key,
          clientSecret: scopedApp.credentials[0].secret,
          tokenLifetime: DEFAULT_TOKEN_LIFETIME
        };
        console.log('Create client credentials: %j', tr);

        runtime.createTokenClientCredentials(tr, function(err, result) {
          assert(!err);
          assert(result);
          console.log('New token: %j', result);
          assert(result.access_token);
          assert(!result.refresh_token);
          assert.equal(result.token_type, 'client_credentials');
          assert(result.expires_in <= (DEFAULT_TOKEN_LIFETIME / 1000));
          assert(result.scope === DEFAULT_SCOPE);
          done();
        });
      });
    });

    describe('Create Password Credentials Token', function() {

      it('Successfully', function(done) {
        var tr = {
          clientId: app.credentials[0].key,
          clientSecret: app.credentials[0].secret,
          tokenLifetime: DEFAULT_TOKEN_LIFETIME,
          username: 'notchecking',
          password: 'likeisaid'
        };
        console.log('Create password: %j', tr);

        runtime.createTokenPasswordCredentials(tr, function(err, result) {
          if (err) { console.error('%j', err); }
          assert(!err);
          assert(result);
          console.log('New token: %j', result);
          assert(result.access_token);
          assert(result.refresh_token);
          assert.equal(result.token_type, 'password');
          assert(result.expires_in <= (DEFAULT_TOKEN_LIFETIME / 1000));

          // verify token
          runtime.verifyToken(result.access_token, null, null, function(err, result) {
            if (err) { console.error('%j', err); }
            assert(!err);
          });

          done();
        });
      });

      it('Invalid scope', function(done) {
        var tr = {
          clientId: scopedApp.credentials[0].key,
          clientSecret: scopedApp.credentials[0].secret,
          tokenLifetime: DEFAULT_TOKEN_LIFETIME,
          username: 'notchecking',
          password: 'likeisaid',
          scope: 'foo'
        };
        console.log('Create password: %j', tr);

        runtime.createTokenPasswordCredentials(tr, function(err, result) {
          assert(err);
          assert(err.message === 'invalid_scope');
          done();
        });
      });

      it('Default Scope', function(done) {
        var tr = {
          clientId: scopedApp.credentials[0].key,
          clientSecret: scopedApp.credentials[0].secret,
          tokenLifetime: DEFAULT_TOKEN_LIFETIME,
          username: 'notchecking',
          password: 'likeisaid'
        };
        console.log('Create password: %j', tr);

        runtime.createTokenPasswordCredentials(tr, function(err, result) {
          if (err) { console.error('%j', err); }
          assert(!err);
          assert(result);
          console.log('New token: %j', result);
          assert(result.access_token);
          assert(result.refresh_token);
          assert.equal(result.token_type, 'password');
          assert(result.expires_in <= (DEFAULT_TOKEN_LIFETIME / 1000));
          assert(result.scope === DEFAULT_SCOPE);
          done();
        });
      });
    });

    it('Refresh token', function(done) {
      var tr = {
        clientId: app.credentials[0].key,
        clientSecret: app.credentials[0].secret,
        tokenLifetime: DEFAULT_TOKEN_LIFETIME,
        refreshToken: refreshToken
      };
      console.log('Refresh token: %j', tr);

      runtime.refreshToken(tr, function(err, result) {
        if (err) { console.error('%j', err); }
        assert(!err);
        assert(result);
        console.log('Refreshed token: %j', result);
        assert(result.expires_in <= (DEFAULT_TOKEN_LIFETIME / 1000));
        assert(result.access_token);
        done();
      });
    });

    describe('Authorization code', function() {

      it('Create code & token', function(done) {
        var tr = {
          clientId: app.credentials[0].key,
          redirectUri: DEFAULT_REDIRECT_URL,
          state: 'mystate'
        };
        console.log('Create authorization code: %j', tr);

        runtime.generateAuthorizationCode(tr, function(err, result) {
          if (err) { console.error('%j', err); }
          assert(!err);
          assert(result);
          var pr = url.parse(result, true);
          console.log('Result: %s', result);
          assert(pr.query.state === 'mystate');
          var authCode = pr.query.code;
          assert(authCode);

          // create token
          tr = {
            clientId: app.credentials[0].key,
            clientSecret: app.credentials[0].secret,
            code: authCode,
            redirectUri: DEFAULT_REDIRECT_URL,
            tokenLifetime: DEFAULT_TOKEN_LIFETIME,
          };
          console.log('Create client credentials: %j', tr);

          runtime.createTokenAuthorizationCode(tr, function(err, result) {
            if (err) { console.error('%j', err); }
            assert(!err);
            assert(result);
            console.log('New token: %j', result);
            assert(result.access_token);
            assert(result.refresh_token);
            assert.equal(result.token_type, 'authorization_code');
            assert(result.expires_in <= (DEFAULT_TOKEN_LIFETIME / 1000));

            // verify token
            runtime.verifyToken(result.access_token, null, null, function(err, result) {
              if (err) { console.error('%j', err); }
              assert(!err);
            });

            done();
          });
        });
      });

      it ('Invalid scope', function(done) {
        var tr = {
          clientId: app.credentials[0].key,
          redirectUri: DEFAULT_REDIRECT_URL,
          scope: 'foo'
        };
        console.log('Create authorization code: %j', tr);

        runtime.generateAuthorizationCode(tr, function(err, result) {
          assert(err);
          assert(err.message === 'invalid_scope');
          done();
        });
      });

      it ('Valid scope', function(done) {
        var tr = {
          clientId: scopedApp.credentials[0].key,
          redirectUri: DEFAULT_REDIRECT_URL,
          scope: OTHER_SCOPE
        };
        console.log('Create authorization code: %j', tr);

        runtime.generateAuthorizationCode(tr, function(err, result) {
          if (err) { console.error('%j', err); }
          assert(!err);
          assert(result);
          var pr = url.parse(result, true);
          assert(pr.query.scope === OTHER_SCOPE);
          var authCode = pr.query.code;

          // create token
          tr = {
            clientId: scopedApp.credentials[0].key,
            clientSecret: scopedApp.credentials[0].secret,
            code: authCode,
            redirectUri: DEFAULT_REDIRECT_URL,
            tokenLifetime: DEFAULT_TOKEN_LIFETIME
          };
          console.log('Create client credentials: %j', tr);

          runtime.createTokenAuthorizationCode(tr, function(err, result) {
            if (err) { console.error('%j', err); }
            assert(!err);
            assert(result);
            console.log('New token: %j', result);
            assert(result.access_token);
            assert(result.refresh_token);
            assert.equal(result.token_type, 'authorization_code');
            assert(result.expires_in <= (DEFAULT_TOKEN_LIFETIME / 1000));
            assert(result.scope === OTHER_SCOPE);

            // verify token
            runtime.verifyToken(result.access_token, null, null, function(err, result) {
              if (err) { console.error('%j', err); }
              assert(!err);
            });

            done();
          });
        });
      });
    });

    describe('Implicit Token', function() {

      it('Create and Validate', function(done) {
        var tr = {
          clientId: app.credentials[0].key,
          clientSecret: app.credentials[0].secret,
          tokenLifetime: DEFAULT_TOKEN_LIFETIME,
          redirectUri: DEFAULT_REDIRECT_URL,
          state: 'mystate'
        };
        console.log('Create implicit: %j', tr);

        runtime.createTokenImplicitGrant(tr, function(err, result) {
          if (err) { console.error('%j', err); }
          assert(!err);
          assert(result);

          result = result.replace('#', '?');
          var pr = url.parse(result, true);
          assert(pr.query.state === 'mystate');
          console.log('New token: %j', pr);

          // verify token
          runtime.verifyToken(pr.query.access_token, null, null, function(err, result) {
            if (err) { console.error('%j', err); }
            assert(!err);
          });

          done();
        });
      });

      it('Invalid Scope', function(done) {
        var tr = {
          clientId: app.credentials[0].key,
          clientSecret: app.credentials[0].secret,
          tokenLifetime: DEFAULT_TOKEN_LIFETIME,
          redirectUri: DEFAULT_REDIRECT_URL,
          scope: 'foo'
        };
        console.log('Create implicit: %j', tr);

        runtime.createTokenImplicitGrant(tr, function(err, result) {
          if (err) { console.error('%j', err); }
          assert(err);
          assert(err.message === 'invalid_scope');

          done();
        });
      });

      it('Valid Scope', function(done) {
        var tr = {
          clientId: scopedApp.credentials[0].key,
          clientSecret: scopedApp.credentials[0].secret,
          tokenLifetime: DEFAULT_TOKEN_LIFETIME,
          redirectUri: DEFAULT_REDIRECT_URL,
          scope: OTHER_SCOPE
        };
        console.log('Create implicit: %j', tr);

        runtime.createTokenImplicitGrant(tr, function(err, result) {
          if (err) { console.error('%j', err); }
          assert(!err);
          assert(result);

          result = result.replace('#', '?');
          var pr = url.parse(result, true);
          assert(pr.query.scope === OTHER_SCOPE);
          console.log('New token: %j', pr);

          // verify token
          runtime.verifyToken(pr.query.access_token, null, null, function(err, result) {
            if (err) { console.error('%j', err); }
            assert(!err);
          });

          done();
        });
      });

    });
  });
};
