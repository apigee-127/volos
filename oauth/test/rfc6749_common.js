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

var should = require('should');
var Url = require('url');
var request = require('supertest');
var querystring = require('querystring');
var _ = require('underscore');

var apps;
var defaultScope;
var scopes;
var client_id;
var client_secret;

var REDIRECT_URL = 'http://example.org';
var STATE = 'xyz';
var DOGS_SCOPE = 'scope2';
var TEST_TIMEOUT = 10000;
var LONG_TIMEOUT = 60000;

exports.verifyOauth = function(config, server) {

  var creator = config.fixtureCreator;
  var validUserCreds = config.validUserCreds;

  function verifyAccessToken(access_token, done) {
    request(server)
      .get('/dogs')
      .set('Authorization', 'Bearer ' + access_token)
      .end(function(err, res) {
        if (err) { return done ? done(err) : err; }
        res.status.should.eql(200);
        if (done) { done(); }
      });
  }

  function verifyAccessTokenExpires(access_token, exp, done) {
    setTimeout(function() {
      request(server)
        .get('/dogs')
        .set('Authorization', 'Bearer ' + access_token)
        .end(function(err, res) {
          if (err) { return done ? done(err) : err; }
          res.status.should.eql(401);
          if (done) { done(); }
        });
    }, exp);
  }

  describe('OAuth 2.0 rfc6749', function() {

    // Sometimes these are run remotely and take longer
    this.timeout(TEST_TIMEOUT);

    before(function(done) {
      this.timeout(LONG_TIMEOUT);
      creator.createFixtures(function(err, reply) {
        if (err) { return done(err); }
        apps = reply;
        client_id = apps[0].credentials[0].key;
        client_secret = apps[0].credentials[0].secret;
        defaultScope = apps[0].defaultScope;
        scopes = apps[0].scopes;
        done();
      });
    });

    after(function(done) {
      this.timeout(LONG_TIMEOUT);
      creator.destroyFixtures(function(err) {
        done(err);
      });
    });

    // just ensure the checkAccessToken() method is valid
    it('access should fail without token', function(done) {
      request(server)
        .get('/dogs')
        .end(function(err, res) {
          if (err) { return done ? done(err) : err; }
          res.status.should.eql(401);
          if (done) { done(); }
        });
    });

    it('invalid grant format', function(done) {
      request(server)
        .post('/accesstoken')
        .send(querystring.stringify({ hello: 'World'}))
        .end(function(err, res) {
          if (err) { return done(err); }
          res.status.should.eql(400);
          done();
        });
    });

    describe('3.1.2 Redirection Endpoint', function() {

      it('must be an absolute uri', function(done) {
        creator.createAppURLWithFragmentError(function(err) {
          should.exist(err);
          done();
        });
      });

      it('uri must not include a fragment', function(done) {
        creator.createAppURLRelativeError(function(err) {
          should.exist(err);
          done();
        });
      });

    });

    describe('4.1. Authorization Code Grant', function() {

      describe('Error Response (no redirect)', function() {

        it('must have client_id', function(done) {
          var q = {
            response_type: 'code',
            state: 'xyx'
          };
          var qs = querystring.stringify(q);

          request(server)
            .get('/authorize')
            .query(qs)
            .end(function(err, res) {
              verify52ErrorResponse(err, res, done);
          });
        });

        it('must be valid redirect_uri if present', function(done) {
          var q = {
            response_type: 'code',
            state: 'xyx',
            redirect_uri: 'http://some.com/wrong_url'
          };
          var qs = querystring.stringify(q);

          request(server)
            .get('/authorize')
            .query(qs)
            .end(function(err, res) {
              verify52ErrorResponse(err, res, done);
          });
        });

      });

      describe('Error Response (redirect)', function() {

//        it('unauthorized_client'); // todo

        it('unsupported_response_type', function(done) {
          var q = {
            client_id: client_id,
            response_type: 'not-code'
          };
          var qs = querystring.stringify(q);

          request(server)
            .get('/authorize')
            .query(qs)
            .redirects(0)
            .end(function(err, res) {
              if (err) { return done(err); }
              res.headers.should.have.property('location');
              var location = Url.parse(res.headers.location, true);
              var hash = location.query;
              verifyRedirectErrorResponse(err, res, q, hash, done, 'unsupported_response_type');
            });
        });

//        it('server_error'); // todo
//        it('temporarily_unavailable'); // todo

        it('invalid_scope', function(done) {
          var q = {
            client_id: client_id,
            redirect_uri: REDIRECT_URL,
            response_type: 'code',
            state: 'xyz',
            scope: 'abc'
          };
          var qs = querystring.stringify(q);

          request(server)
            .get('/authorize')
            .query(qs)
            .redirects(0)
            .end(function(err, res) {
              if (err) { return done(err); }
              res.headers.should.have.property('location');
              var location = Url.parse(res.headers.location, true);
              var hash = location.query;

              // spec gives the option of invalid_token or returning some other scope...
              if (hash.error) {  // invalid_scope
                verifyRedirectErrorResponse(err, res, q, hash, done);
              } else { // server-chosen scope
                hash.should.have.property('scope');
                verifyRedirectSuccessResponse(err, res, q, hash, done);
              }
            });
        });

      });

      describe('4.1.3 Access Token Request', function() {

        var code;

        beforeEach(function(done) {
          var q = {
            client_id: client_id,
            redirect_uri: REDIRECT_URL,
            response_type: 'code',
            state: STATE,
            scope: DOGS_SCOPE
          };
          var qs = querystring.stringify(q);
          request(server)
            .get('/authorize')
            .query(qs)
            .redirects(0)
            .end(function(err, res) {
              verifyQueryRedirectSuccessResponse(err, res, q);
              code = Url.parse(res.headers.location, true).query.code;
              done();
            });
        });

        it('can exchange code for a valid token', function(done) {
          var q = {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URL,
            state: STATE
          };
          var qs = querystring.stringify(q);
          request(server)
            .post('/accesstoken')
            .auth(client_id, client_secret)
            .send(qs)
            .end(function(err, res) {
              verify51SuccessfulResponse(err, res, done);
            });
        });

        it('issued token must fail after expiration', function(done) {
          var q = {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URL,
            state: STATE
          };
          var qs = querystring.stringify(q);
          request(server)
            .post('/accesstoken')
            .auth(client_id, client_secret)
            .send(qs)
            .end(function(err, res) {
              verify51SuccessfulResponse(err, res);
              verifyAccessTokenExpires(res.body.access_token, config.config.tokenLifetime, done);
            });
        });

        it('cannot use a bad code', function(done) {
          var q = {
            grant_type: 'authorization_code',
            code: 'badCode',
            redirect_uri: REDIRECT_URL,
            state: STATE
          };
          var qs = querystring.stringify(q);
          request(server)
            .post('/accesstoken')
            .auth(client_id, client_secret)
            .send(qs)
            .end(function(err, res) {
              verify52ErrorResponse(err, res, done, 'invalid_grant');
            });
        });

        it('cannot use the Authorization Code more than once', function(done) {
          var q = {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URL,
            state: STATE
          };
          var qs = querystring.stringify(q);
          request(server)
            .post('/accesstoken')
            .auth(client_id, client_secret)
            .send(qs)
            .end(function(err, res) {
              verify51SuccessfulResponse(err, res);

              request(server)
                .post('/accesstoken')
                .auth(client_id, client_secret)
                .send(qs)
                .end(function(err, res) {
                  verify52ErrorResponse(err, res, done, 'invalid_grant');
                });
            });
        });

        describe('authorization code is bound to redirection URI', function() {

          it('has no redirect uri', function(done) {
            var q = {
              grant_type: 'authorization_code',
              code: code,
              state: STATE
            };
            var qs = querystring.stringify(q);
            request(server)
              .post('/accesstoken')
              .auth(client_id, client_secret)
              .send(qs)
              .end(function(err, res) {
                verify52ErrorResponse(err, res, done, 'invalid_grant');
              });
          });

          it('has different redirect uri', function(done) {
            var q = {
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: 'badurl',
              state: STATE
            };
            var qs = querystring.stringify(q);
            request(server)
              .post('/accesstoken')
              .auth(client_id, client_secret)
              .send(qs)
              .end(function(err, res) {
                verify52ErrorResponse(err, res, done, 'invalid_grant');
              });
          });
        });

        it('authorization code is bound to the client identifier', function(done) {
          var app2_client_id = apps[1].credentials[0].key;
          var app2_secret = apps[1].credentials[0].secret;
          var q = {
            grant_type: 'authorization_code',
            code: code,
            state: STATE
          };
          var qs = querystring.stringify(q);
          request(server)
            .post('/accesstoken')
            .auth(app2_client_id, app2_secret)
            .send(qs)
            .end(function(err, res) {
              verify52ErrorResponse(err, res, done, "invalid_grant");
            });
        });

        describe('requires authentication', function() {

          it('missing auth', function(done) {
            var q = {
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: REDIRECT_URL,
              state: STATE
            };
            var qs = querystring.stringify(q);
            request(server)
              .post('/accesstoken')
              .auth(client_id, 'badsecret')
              .send(qs)
              .end(function(err, res) {
                verify52ErrorResponse(err, res, done, 'invalid_client', true);
              });
          });

          it('invalid auth', function(done) {
            var q = {
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: REDIRECT_URL,
              state: STATE
            };
            var qs = querystring.stringify(q);
            request(server)
              .post('/accesstoken')
              .auth(client_id, 'badsecret')
              .send(qs)
              .end(function(err, res) {
                verify52ErrorResponse(err, res, done, 'invalid_client', true);
              });
          });

          it('can use client_id', function(done) {
            var q = {
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: REDIRECT_URL,
              state: STATE,
              client_id: client_id,
              client_secret: client_secret
            };
            var qs = querystring.stringify(q);
            request(server)
              .post('/accesstoken')
              .send(qs)
              .end(function(err, res) {
                verify51SuccessfulResponse(err, res, done);
              });
          });

        });
      });
    }); // 4.1


    describe('4.2. Implicit Grant', function() {

      it('can obtain a valid token', function(done) {
        var q = {
          response_type: 'token',
          client_id: client_id,
          client_secret: client_secret,
          redirect_uri: REDIRECT_URL,
          state: STATE,
          scope: DOGS_SCOPE
        };
        var qs = querystring.stringify(q);
        request(server)
          .get('/authorize')
          .query(qs)
          .redirects(0)
          .end(function(err, res) {
            verifyHashRedirectSuccessResponse(err, res, q, done);
          });
      });

      it('must fail after expiration', function(done) {
        var q = {
          response_type: 'token',
          client_id: client_id,
          client_secret: client_secret,
          redirect_uri: REDIRECT_URL,
          state: STATE,
          scope: DOGS_SCOPE
        };
        var qs = querystring.stringify(q);
        request(server)
          .get('/authorize')
          .query(qs)
          .redirects(0)
          .end(function(err, res) {
            verifyHashRedirectSuccessResponse(err, res, q);
            verifyAccessTokenExpires(res.body.access_token, config.config.tokenLifetime, done);
          });
      });

      describe('Error Response (no redirect)', function() {

        it('must have client_id', function(done) {
          var q = {
            response_type: 'token',
            state: 'xyx'
          };
          var qs = querystring.stringify(q);

          request(server)
            .get('/authorize')
            .query(qs)
            .end(function(err, res) {
              verify52ErrorResponse(err, res, done);
            });
        });

        it('must be valid redirect_uri if present', function(done) {
          var q = {
            response_type: 'token',
            state: 'xyx',
            redirect_uri: 'http://some.com/wrong_url'
          };
          var qs = querystring.stringify(q);

          request(server)
            .get('/authorize')
            .query(qs)
            .end(function(err, res) {
              verify52ErrorResponse(err, res, done);
            });
        });

      });

      describe('Error Response (redirect)', function() {

        it('unknown scope (invalid_scope)', function(done) {
          var q = {
            response_type: 'token',
            client_id: client_id,
            client_secret: client_secret,
            redirect_uri: REDIRECT_URL,
            state: 'xyz',
            scope: 'invalidScope'
          };
          var qs = querystring.stringify(q);

          request(server)
            .get('/authorize')
            .query(qs)
            .redirects(0)
            .end(function(err, res) {
              var location = Url.parse(res.headers.location);
              var hash = querystring.parse(location.hash.substring(1));

              // spec gives the option of invalid_token or returning some other scope...
              if (hash.error) {  // invalid_scope
                verifyRedirectErrorResponse(err, res, q, hash, done);
              } else { // server-chosen scope
                hash.should.have.property('scope');
                verifyRedirectSuccessResponse(err, res, q, hash, done);
              }
            });
        });

      });
    }); // 4.2


    describe('4.3. Resource Owner Password Credentials Grant', function() {

      it('may use basic authentication', function(done) {
        var q = {
          grant_type: 'password',
          username: validUserCreds.username,
          password: validUserCreds.password,
          scope: DOGS_SCOPE
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .auth(client_id, client_secret)
          .send(qs)
          .end(function(err, res) {
            verify51SuccessfulResponse(err, res, done);
          });
      });

      it('must fail after expiration', function(done) {
        var q = {
          grant_type: 'password',
          username: validUserCreds.username,
          password: validUserCreds.password,
          scope: DOGS_SCOPE
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .auth(client_id, client_secret)
          .send(qs)
          .end(function(err, res) {
            verify51SuccessfulResponse(err, res);
            verifyAccessTokenExpires(res.body.access_token, config.config.tokenLifetime, done);
          });
      });

      it('must include username', function(done) {
        var q = {
          grant_type: 'password',
          password: validUserCreds.password
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .auth(client_id, client_secret)
          .send(qs)
          .end(function(err, res) {
            verify52ErrorResponse(err, res, done);
          });
      });

      it('must include password', function(done) {
        var q = {
          grant_type: 'password',
          username: validUserCreds.username
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .auth(client_id, client_secret)
          .send(qs)
          .end(function(err, res) {
            verify52ErrorResponse(err, res, done);
          });
      });

      it('must be valid username/password', function(done) {
        var q = {
          grant_type: 'password',
          username: validUserCreds.username,
          password: 'bad password'
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .auth(client_id, client_secret)
          .send(qs)
          .end(function(err, res) {
            verify52ErrorResponse(err, res, done, 'invalid_client');
          });
      });

      it('must have basic auth or client_id', function(done) {
        var q = {
          grant_type: 'password',
          username: validUserCreds.username,
          password: validUserCreds.password
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .send(qs)
          .end(function(err, res) {
            verify52ErrorResponse(err, res, done, 'invalid_client');
          });
      });

      // also proves we can use client_id instead of basic authentication
      perform41and51CommonTests('/accesstoken', function() {
        return {
          grant_type: 'password',
          username: validUserCreds.username,
          password: validUserCreds.password,
          client_id: client_id,
          client_secret: client_secret,
          scope: DOGS_SCOPE
        };
      });

    }); // 4.3


    describe('4.4. Client Credentials Grant', function() {

      it('can obtain a valid token using basic authentication', function(done) {
        var q = {
          grant_type: 'client_credentials',
          scope: DOGS_SCOPE
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .auth(client_id, client_secret)
          .send(qs)
          .end(function(err, res) {
            verify51SuccessfulResponse(err, res, done);
          });
      });

      it('can obtain a valid token from unscoped app', function(done) {
        var q = {
          grant_type: 'client_credentials'
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .auth(apps[2].credentials[0].key, apps[2].credentials[0].secret)
          .send(qs)
          .end(function(err, res) {
            verify51SuccessfulResponse(err, res, done);
          });
      });

      it('must fail after expiration', function(done) {
        var q = {
          grant_type: 'client_credentials',
          scope: DOGS_SCOPE
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .auth(client_id, client_secret)
          .send(qs)
          .end(function(err, res) {
            verify51SuccessfulResponse(err, res);
            verifyAccessTokenExpires(res.body.access_token, config.config.tokenLifetime, done);
          });
      });

      it('must authenticate client', function(done) {
        var q = {
          grant_type: 'client_credentials',
          client_id: client_id,
          client_secret: 'invalid'
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .send(qs)
          .end(function(err, res) {
            verify52ErrorResponse(err, res, done, 'invalid_client');
          });
      });

      // also proves we can use client_id/client_secret in body instead of header
      perform41and51CommonTests('/accesstoken', function() {
        return {
          grant_type: 'client_credentials',
          client_id: client_id,
          client_secret: client_secret,
          scope: DOGS_SCOPE
        };
      });

    }); // 4.4


    describe('6. Refreshing an Access Token', function() {

      var refreshToken, resp, selectedScope, originalScope;

      beforeEach(function(done) {

        selectedScope = _.find(scopes, function(ea) { return ea !== defaultScope; });
        var q = {
          grant_type: 'password',
          username: validUserCreds.username,
          password: validUserCreds.password,
          client_id: client_id,
          client_secret: client_secret,
          scope: selectedScope
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .send(qs)
          .end(function(err, res) {
            if (err) { return done(err); }
            res.status.should.eql(200);
            res.body.should.have.property('refresh_token');
            refreshToken = res.body.refresh_token;
            resp = res;
            done();
          });
      });

      it('must not include any scope not originally granted by the resource owner', function(done) {
        if (!selectedScope) { console.log('cannot determine a non-default scope to test'); return done(); }
        originalScope = resp.body.scope;
        if (!originalScope) {
          // technically, the server could opt to not include the scope if granted as requested
          console.log('an explicit scope is not included, cannot test');
          return done();
        }

        var originalScopes = originalScope.split(' ');
        originalScopes.should.include(selectedScope);

        request(server)
          .post('/refresh')
          .auth(client_id, client_secret)
          .send(querystring.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }))
          .end(function(err, res) {
            if (err) { return done(err); }

            res.body.should.have.property('scope');
            var refreshScopes = res.body.scope.split(' ');

            _.difference(refreshScopes, originalScopes).should.be.empty;
            done();
          });
      });

      it('refresh token is bound to the client to which it was issued', function(done) {
        var app2_client_id = apps[1].credentials[0].key;
        var app2_secret = apps[1].credentials[0].secret;
        request(server)
          .post('/refresh')
          .auth(app2_client_id, app2_secret)
          .send(querystring.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }))
          .end(function(err, res) {
            verify52ErrorResponse(err, res, done);
          });
      });

      it('must authenticate client', function(done) {
        request(server)
          .post('/refresh')
          .send(querystring.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }))
          .end(function(err, res) {
            verify52ErrorResponse(err, res, done, 'invalid_client');
          });
      });

      it('must validate the refresh token', function(done) {
        request(server)
          .post('/refresh')
          .auth(client_id, client_secret)
          .send(querystring.stringify({ grant_type: 'refresh_token', refresh_token: 'invalid token' }))
          .end(function(err, res) {
            verify52ErrorResponse(err, res, done);
          });
      });

      // also proves we can use client_id/client_secret in body instead of header
      perform41and51CommonTests('/refresh', function() {
        return {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: client_id,
          client_secret: client_secret,
          scope: originalScope
        };
      });

    }); // 6


    describe('Invalidate', function() {

      var accessToken, refreshToken;

      beforeEach(function(done) {

        var q = {
          grant_type: 'password',
          username: validUserCreds.username,
          password: validUserCreds.password,
          client_id: client_id,
          client_secret: client_secret,
          scope: DOGS_SCOPE
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .send(qs)
          .end(function(err, res) {
            if (err) { return done(err); }
            res.status.should.eql(200);
            res.body.should.have.properties('access_token', 'refresh_token');
            accessToken = res.body.access_token;
            refreshToken = res.body.refresh_token;
            done();
          });
      });

      it('access token', function(done) {
        var q = {
          client_id: client_id,
          client_secret: client_secret,
          token: accessToken
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/invalidate')
          .send(qs)
          .end(function(err, res) {
            if (err) { return done(err); }
            res.status.should.eql(200);

            request(server)
              .get('/dogs')
              .set('Authorization', 'Bearer ' + accessToken)
              .end(function(err, res) {
                if (err) { return done ? done(err) : err; }
                res.status.should.eql(401);
                done();
              });
          });
      });

      it('refresh token', function(done) {
          var q = {
            client_id: client_id,
            client_secret: client_secret,
            token: refreshToken
          };
          var qs = querystring.stringify(q);
          request(server)
            .post('/invalidate')
            .send(qs)
            .end(function(err, res) {
              if (err) { return done(err); }
              res.status.should.eql(200);

              request(server)
                .post('/refresh')
                .auth(client_id, client_secret)
                .send(querystring.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }))
                .end(function(err, res) {
                  verify52ErrorResponse(err, res, done);
                });
            });
        });

    }); // invalidate


    // common testing for 4.3 & 4.4
    function perform41and51CommonTests(endpoint, getBaseBody) {

      it('can obtain a valid token', function(done) {
        var baseBody = getBaseBody();
        var qs = querystring.stringify(baseBody);
        request(server)
          .post(endpoint)
          .send(qs)
          .end(function(err, res) {
            verify51SuccessfulResponse(err, res, done);
          });
      });

      describe('Error Type', function() {

        it('invalid_request', function(done) {
          var baseBody = getBaseBody();
          delete baseBody.grant_type;
          var qs = querystring.stringify(baseBody);
          request(server)
            .post(endpoint)
            .send(qs)
            .end(function(err, res) {
              verify52ErrorResponse(err, res, done, 'invalid_request');
            });
        });

//        it('unauthorized_client'); // todo

        it('unsupported_grant_type', function(done) {
          var baseBody = getBaseBody();
          baseBody.grant_type = 'not-a-good-type';
          var qs = querystring.stringify(baseBody);
          request(server)
            .post(endpoint)
            .send(qs)
            .end(function(err, res) {
              verify52ErrorResponse(err, res, done, 'unsupported_grant_type');
            });
        });

//        it('server_error'); // todo
//        it('temporarily_unavailable'); // todo

        it('invalid_scope / default scope', function(done) {
          var baseBody = getBaseBody();
          var body =  _.extend(baseBody, {
            scope: 'invalidScope'
          });
          var bodyString = querystring.stringify(body);

          request(server)
            .post(endpoint)
            .send(bodyString)
            .end(function(err, res) {
              // spec gives the option of invalid_token or returning some other scope...
              if (res.status === 200) { // server-chosen scope
                res.body.should.have.property('scope');
                done(); // note: can't verify the wrong scope
//                verify51SuccessfulResponse(err, res, done);
              } else { // invalid_scope
                verify52ErrorResponse(err, res, done, 'invalid_scope');
              }
            });
        });

      });
    }


    // 5.1 Successful Response
    function verify51SuccessfulResponse(err, res, done) {

      if (err) { return done(err); }
      res.status.should.eql(200);
      res.should.be.json;
      res.headers.should.have.properties('cache-control', 'pragma');
      res.headers['cache-control'].should.eql('no-store');
      res.headers.pragma.should.eql('no-cache');

      res.body.should.have.properties('access_token', 'token_type');
      if (res.body.scope && res.body.scope.indexOf(DOGS_SCOPE) > 0) { // can only verify if appropriate scope
        verifyAccessToken(res.body.access_token);
      }

      // expires_in is optional (though recommended)
      if (res.body.expires_in) { res.body.expires_in.should.be.a.number; }

      // verify refresh token if present (it's optional)
      var refreshToken = res.body.refresh_token;
      if (!refreshToken) { return (done) ? done() : null; }

      request(server)
        .post('/refresh')
        .auth(client_id, client_secret)
        .send(querystring.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }))
        .end(function(err, res) {
          if (err) { return done(err); }
          res.status.should.eql(200);
          res.body.should.have.property('access_token');
          var accessToken = res.body.access_token;
          if (res.body.scope.indexOf(DOGS_SCOPE) > 0) { // can only verify if appropriate scope
            verifyAccessToken(accessToken, done);
          } else {
            if (done) { done(); }
          }
        });
    }

    // 5.2 Error Response
    function verify52ErrorResponse(err, res, done, errorType, usingAuthHeader) {

      if (err) { return done(err); }

      if (errorType === 'access_denied') {
        res.status.should.eql(403);
      } else if (errorType === 'invalid_client') {
        [400, 401].should.include(res.status);
        if (usingAuthHeader) {  // p. 45
          res.status.should.eql(401);
          res.headers.should.have.property('www-authenticate');
        }
      } else {
        res.status.should.eql(400);
      }

      verifyErrorHash(res.body, errorType, done);
    }

    function verifyQueryRedirectSuccessResponse(err, res, reqHash, done) {
      if (err) { return done(err); }

      res.headers.should.have.property('location');
      var location = Url.parse(res.headers.location, true);
      var resHash = location.query;
      verifyRedirectSuccessResponse(err, res, reqHash, resHash, done);
    }

    function verifyHashRedirectSuccessResponse(err, res, reqHash, done) {
      if (err) { return done(err); }

      res.headers.should.have.property('location');
      var location = Url.parse(res.headers.location, true);
      var resHash = querystring.parse(location.hash.substring(1));
      verifyRedirectSuccessResponse(err, res, reqHash, resHash, done);
    }

    // verify a 302 success response
    function verifyRedirectSuccessResponse(err, res, reqHash, resHash, done) {
      if (err) { return done(err); }

      res.status.should.be.within(300, 399);

      validateRedirectBase(reqHash.redirect_uri, res.headers.location);

      // 3.1.2. URI MAY include query component which MUST be retained
      // todo: avoiding this check for Apigee until it works properly
      if (!config.management.management.getApiProduct) {
        resHash.should.have.property('query');
        resHash.query.should.equal('true');
      }

      if (reqHash.state) {
        resHash.should.have.property('state');
        resHash.state.should.eql(reqHash.state);
      }

      if (reqHash.response_type === 'code') {
        resHash.should.have.property('code');
      } else {
        resHash.should.have.property('access_token');
        if (resHash && resHash.scope === DOGS_SCOPE) { // only check when appropriate scope for token
          verifyAccessToken(resHash.access_token);
        }
      }

      if (done) { done(); }
    }

    // verify a 302 error response
    function verifyRedirectErrorResponse(err, res, reqHash, resHash, done, errorType) {
      if (err) { return done(err); }

      res.status.should.be.within(300, 399);

      validateRedirectBase(reqHash.redirect_uri, res.headers.location);

      // it('URI MAY include query component which MUST be retained');
      /* We don't appear to set a query component on any of the redirect uris
       * in this test so this property would not be present.
      resHash.should.have.property('query');
      resHash.query.should.equal('true');
      */

      if (reqHash.state) {
        resHash.should.have.property('state');
        resHash.state.should.eql(reqHash.state);
      }

      verifyErrorHash(resHash, errorType, done);
    }

    function validateRedirectBase(requestedUri, returnedUri) {
      if (requestedUri) {
        var requestedRedirectUrl = Url.parse(requestedUri);
        var returnedRedirectUri = Url.parse(returnedUri);
        returnedRedirectUri.hostname.should.eql(requestedRedirectUrl.hostname);
        returnedRedirectUri.pathname.should.eql(requestedRedirectUrl.pathname);
      }
    }

    function verifyErrorHash(resHash, errorType, done) {
      resHash.should.be.ok;
      resHash.should.not.have.properties('access_token', 'refresh_token', 'code');

      resHash.should.have.property('error');
      if (errorType !== 'access_denied') {
        errorType = errorType || 'invalid_request';
        ['invalid_request', 'invalid_client', 'invalid_grant',
          'unauthorized_client', 'unsupported_grant_type', 'invalid_scope', 'unsupported_response_type'].should.include(errorType);
        resHash.error.should.eql(errorType);
      }

      if (done) { done(); }
    }

  });
};
