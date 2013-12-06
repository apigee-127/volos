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

//var config = require('../../common/testconfig-apigee');
var config = require('../../common/testconfig-redis');

var should = require('should');
var Url = require('url');
var request = require('supertest');
var querystring = require('querystring');
var _ = require('underscore');

var creator = config.fixtureCreator;
var validUserCreds = config.validUserCreds;
var defaultScope;
var scopes;

var REDIRECT_URL = 'http://example.org';
var STATE = 'xyz';

exports.verifyOauth = function(server) {

  function verifyAccessToken(access_token, done) {
    request(server)
      .get('/dogs')
      .set('Authorization', 'Bearer ' + access_token)
      .expect(200, done);
  }

  // just ensure the checkAccessToken() method is valid
  it('access should fail without token', function(done) {
    request(server)
      .get('/dogs')
      .expect(400, done);
  });

  describe('OAuth 2.0 rfc6749', function() {

    this.timeout(10000);
    var app;
    var client_id;
    var client_secret;

    before(function(done) {
      creator.createFixtures(function(err, application) {
        if (err) { console.error('Error creating fixtures: %j', err); }
        app = application;
        client_id = app.credentials[0].key;
        client_secret = app.credentials[0].secret;
        defaultScope = app.defaultScope;
        scopes = app.scopes;
        done();
      });
    });

    it('invalid grant format', function(done) {
      request(server)
        .post('/accesstoken')
        .send(querystring.stringify({ hello: 'World'}))
        .expect(400, done);
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

        it('unauthorized_client');
        it('unsupported_response_type');
        it('server_error');
        it('temporarily_unavailable');

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
            state: STATE
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
              verify52ErrorResponse(err, res, done);
            });
        });

        it('cannot use a token from a different client_id'); // todo

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
                  verify52ErrorResponse(err, res, done);
                });
            });
        });

        describe('requires identical redirect_uri as Auth Code request', function() {

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
                verify52ErrorResponse(err, res, done);
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
                verify52ErrorResponse(err, res, done);
              });
          });
        });

        describe('requires authentication', function(done) {

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
              .auth(client_id, 'bad secret')
              .send(qs)
              .end(function(err, res) {
                verify52ErrorResponse(err, res, done, 'access_denied');
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
              .auth(client_id, 'bad secret')
              .send(qs)
              .end(function(err, res) {
                verify52ErrorResponse(err, res, done, 'access_denied');
              });
          });

          it('can use client_id', function(done) {
            var q = {
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: REDIRECT_URL,
              state: STATE,
              client_id: client_id
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
          redirect_uri: REDIRECT_URL,
          state: STATE
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

        // todo...?
        it('invalid_request');
        it('unauthorized_client');
        it('unsupported_response_type');
        it('server_error');
        it('temporarily_unavailable');

        it('unknown scope (invalid_scope)', function(done) {
          var q = {
            response_type: 'token',
            client_id: client_id,
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
          password: validUserCreds.password
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
      perform41and51CommonTests({
        grant_type: 'password',
        username: validUserCreds.username,
        password: validUserCreds.password,
        client_id: client_id,
        state: 'xyz'
      });

    }); // 4.3


    describe('4.4. Client Credentials Grant', function() {

      it('can obtain a valid token using basic authentication', function(done) {
        var q = {
          grant_type: 'client_credentials',
          state: 'xyz'
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
      perform41and51CommonTests({
        grant_type: 'client_credentials',
        client_id: client_id,
        client_secret: client_secret,
        state: 'xyz'
      });

    }); // 4.4


    // common testing for 4.3 & 4.4
    function perform41and51CommonTests(baseBody) {

      it('can obtain a valid token', function(done) {
        var qs = querystring.stringify(baseBody);
        request(server)
          .post('/accesstoken')
          .auth(client_id, client_secret)
          .send(qs)
          .end(function(err, res) {
            verify51SuccessfulResponse(err, res, done);
          });
      });

      describe('Error Type', function() {

        it('invalid_request');
        it('unauthorized_client');
        it('unsupported_response_type');
        it('server_error');
        it('temporarily_unavailable');

        it('invalid_scope / default scope', function(done) {
          var body =  _.extend(baseBody, {
            scope: 'invalidScope'
          });
          var bodyString = querystring.stringify(body);

          request(server)
            .post('/accesstoken')
            .auth(client_id, client_secret)
            .send(bodyString)
            .end(function(err, res) {
              // spec gives the option of invalid_token or returning some other scope...
              if (res.status === 200) { // server-chosen scope
                res.body.should.have.property('scope');
                verify51SuccessfulResponse(err, res, done);
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
      verifyAccessToken(res.body.access_token);

      // expires_in is optional (though recommended)
      if (res.body.expires_in) { res.body.expires_in.should.be.a.number; }

      // verify refresh token if present (it's optional)
      var refreshToken = res.body.refresh_token;
      if (!refreshToken) { return done(); }

      request(server)
        .post('/refresh')
        .auth(client_id, client_secret)
        .send(querystring.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }))
        .end(function(err, res) {
          if (err) { return done(err); }
          res.status.should.eql(200);
          res.body.should.have.property('access_token');
          var accessToken = res.body.access_token;
          verifyAccessToken(accessToken, done);
        });
    }

    // 5.2 Error Response
    function verify52ErrorResponse(err, res, done, errorType) {

      if (err) { return done(err); }

      if (errorType === 'access_denied') {
        res.status.should.eql(403);
      } else if (errorType === 'unauthorized_client') {
        [400, 401].should.include(res.status);
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

      if (reqHash.state) {
        resHash.should.have.property('state');
        resHash.state.should.eql(reqHash.state);
      }

      if (reqHash.response_type === 'code') {
        resHash.should.have.property('code');
      } else {
        resHash.should.have.property('access_token');
        verifyAccessToken(resHash.access_token);
      }

      if (done) { done(); }
    }

    // verify a 302 error response
    function verifyRedirectErrorResponse(err, res, reqHash, resHash, done, errorType) {
      if (err) { return done(err); }

      res.status.should.be.within(300, 399);

      validateRedirectBase(reqHash.redirect_uri, res.headers.location);

      resHash.should.have.property('state');
      resHash.state.should.eql(reqHash.state);

      verifyErrorHash(resHash, errorType, done);
    }

    function validateRedirectBase(requestedUri, returnedUri) {
      var requestedRedirectUrl = Url.parse(requestedUri);
      var returnedRedirectUri = Url.parse(returnedUri);
      returnedRedirectUri.hostname.should.eql(requestedRedirectUrl.hostname);
      returnedRedirectUri.pathname.should.eql(requestedRedirectUrl.pathname);
    }

    function verifyErrorHash(resHash, errorType, done) {
      resHash.should.be.ok;
      resHash.should.not.have.properties('access_token', 'refresh_token');

      resHash.should.have.property('error');
      if (errorType !== 'access_denied') {
        errorType = errorType || 'invalid_request';
        ['invalid_request', 'invalid_client', 'invalid_grant',
          'unauthorized_client', 'unsupported_grant_type', 'invalid_scope'].should.include(errorType);
        resHash.error.should.eql(errorType);
      }

      if (done) { done(); }
    }

  });
};
