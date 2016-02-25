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

var assert = require('assert');
var should = require('should');
var request = require('supertest');
var connectServer = require('./support/connectserver');
var async = require('async');
var _ = require('underscore');
var querystring = require('querystring');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');

var redisConfig = require('../../testconfig/testconfig-redis');
var oauth = redisConfig.oauth;

describe('Swagger Middleware', function() {

  describe('a127', function() {

    var file = path.resolve(__dirname, './support/swagger.yaml');
    var swaggerObject = yaml.safeLoad(fs.readFileSync(file, 'utf8'));

    var count = 0;
    var client_id, client_secret, defaultScope, scopes;

    before(function(done) {
      var self = this;
      connectServer(swaggerObject, function(server) {
        self.server = server;
        redisConfig.fixtureCreator.createFixtures(function(err, result) {
          should.not.exist(err);
          var app = result[0];
          client_id = app.credentials[0].key;
          client_secret = app.credentials[0].secret;
          defaultScope = app.defaultScope;
          scopes = app.scopes;
          done();
        });
      });
    });

    after(function(done) {
      redisConfig.fixtureCreator.destroyFixtures(done);
    });

    function getToken(scope, cb) {
      var tokenRequest = {
        clientId: client_id,
        clientSecret: client_secret
      };

      if (scope) { tokenRequest.scope = scope; }

      oauth.spi.createTokenClientCredentials(tokenRequest, function(err, result) {
        if (err) { cb(err); }
        cb(null, result.access_token);
      });
    }

    describe('Operations', function() {

      it('must access clean', function(done) {
        request(this.server)
          .get('/clean')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);
            res.body.count.should.equal(++count);

            done();
          });
      });

      describe('Cache', function() {

        var headers;
        before(function(done) {
          request(this.server)
            .get('/cached')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              should.exist(res.header['cache-control']);
              res.body.count.should.equal(++count);
              headers = res.headers;
              done();
            });
        });

        it('must hit with default', function(done) {
          request(this.server)
            .get('/cached')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              res.body.count.should.equal(count);
              _.keys(headers).length.should.equal(_.keys(res.headers).length);

              done();
            });
        });

        it('must accept key', function(done) {
          request(this.server)
            .get('/cachedWithKey')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              res.body.count.should.equal(count);

              done();
            });
        });

        it('must accept function key', function(done) {
          request(this.server)
            .get('/cachedWithFunctionKey')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              res.body.count.should.equal(count);

              done();
            });
        });

        it('must accept ttl override', function(done) {
          var server = this.server;
          request(this.server)
            .get('/cachedWithLowTtl')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              should.exist(res.header['cache-control']);
              res.body.count.should.equal(++count);

              setTimeout(function() {
                request(server)
                  .get('/cachedWithLowTtl')
                  .end(function(err, res) {
                    should.not.exist(err);
                    res.status.should.eql(200);
                    should.exist(res.header['cache-control']);
                    res.body.count.should.equal(++count);

                    done();
                  });
              }, 20);
            });
        });
      });

      describe('Quota', function() {

        before(function(done) {
          var server = this.server;
          request(this.server)
            .get('/quota')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              res.body.count.should.equal(++count);

              request(server)
                .get('/quota')
                .end(function(err, res) {
                  should.not.exist(err);
                  res.status.should.eql(200);
                  res.body.count.should.equal(++count);

                  done();
                });
            });
        });

        it('must hit with default', function(done) {

          request(this.server)
            .get('/quota')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(403);

              done();
            });
        });

        it('must hit with key', function(done) {

          request(this.server)
            .get('/quotaWithKey')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(403);

              done();
            });
        });

        it('must hit with weight', function(done) {

          var server = this.server;
          request(this.server)
            .get('/quotaWithWeight')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              res.body.count.should.equal(++count);

              request(server)
                .get('/quotaWithWeight')
                .end(function(err, res) {
                  should.not.exist(err);
                  res.status.should.eql(403);

                  done();
                });
            });
        });

        it('must hit with function key', function(done) {

          request(this.server)
            .get('/quotaWithFunctionKey')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(403);

              done();
            });
        });

      });

      describe('SpikeArrest', function() {

        before(function(done) {
          request(this.server)
            .get('/spikeArrestWithKey')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              res.body.count.should.equal(++count);

              done();
            });
        });

        it('must hit with default', function(done) {

          var server = this.server;
          request(this.server)
            .get('/spikeArrest')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              res.body.count.should.equal(++count);

              request(server)
                .get('/spikeArrest')
                .end(function(err, res) {
                  should.not.exist(err);
                  res.status.should.eql(503);

                  done();
                });
            });
        });

        it('must hit with key', function(done) {

          request(this.server)
            .get('/spikeArrestWithKey')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(503);

              done();
            });
        });

        it('must hit with weight', function(done) {

          request(this.server)
            .get('/spikeArrestWithWeight')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(503);

              done();
            });
        });

        it('must hit with function key', function(done) {

          request(this.server)
            .get('/spikeArrestWithFunctionKey')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(503);

              done();
            });
        });

      });

      describe('A127 Oauth', function() {

        it('must handle auth', function(done) {

          var server = this.server;
          request(this.server)
            .get('/secured')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(401);

              getToken(null, function(err, token) {
                if (err) { return done(err); }

                request(server)
                  .get('/secured')
                  .set('Authorization', 'Bearer ' + token)
                  .end(function(err, res) {
                    should.not.exist(err);
                    res.status.should.eql(200);
                    res.body.count.should.equal(++count);

                    done();
                  });

              });
            });
        });

        it('must handle scopes', function(done) {

          var server = this.server;
          getToken(null, function(err, token) {
            if (err) { return done(err); }

            request(server)
              .get('/securedScope2')
              .set('Authorization', 'Bearer ' + token)
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(400);

                getToken('scope2', function(err, token) {
                  if (err) { return done(err); }

                  request(server)
                    .get('/securedScope2')
                    .set('Authorization', 'Bearer ' + token)
                    .end(function(err, res) {
                      should.not.exist(err);
                      res.status.should.eql(200);
                      res.body.count.should.equal(++count);

                      done();
                    });

                });
              });
          });
        });

        it('must work with cache', function(done) {

          var server = this.server;
          getToken(null, function(err, token) {
            if (err) { return done(err); }

            request(server)
              .get('/securedCache')
              .set('Authorization', 'Bearer ' + token)
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(400);

                getToken('scope2', function(err, token) {
                  if (err) { return done(err); }

                  request(server)
                    .get('/securedCache')
                    .set('Authorization', 'Bearer ' + token)
                    .end(function(err, res) {
                      should.not.exist(err);
                      res.status.should.eql(200);
                      res.body.count.should.equal(++count);

                      var cache = server.volos.resources.cache;
                      cache.get(token, function(err, reply) {
                        should.not.exist(err);
                        should.exist(reply);

                        var cachedToken = JSON.parse(reply.toString());
                        cachedToken.access_token.should.eql(token);

                        done();
                      });
                    });
                });
              });
          });
        });

        it('must allow passwordCheck', function(done) {
          var q = {
            grant_type: 'password',
            username: 'jimmy',
            password: 'jimmy'
          };
          var qs = querystring.stringify(q);
          var server = this.server;
          request(this.server)
            .post('/accesstoken')
            .auth(client_id, client_secret)
            .send(qs)
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              should.exist(res.body.access_token);
              should.exist(res.body.refresh_token);
              should.exist(res.body.refresh_token_expires_in);
              res.body.refresh_token_expires_in.should.be.approximately(7, 3);

              q.password = 'somethingelse';
              var qs = querystring.stringify(q);
              request(server)
                .post('/accesstoken')
                .auth(client_id, client_secret)
                .send(qs)
                .end(function(err, res) {
                  should.not.exist(err);
                  res.status.should.eql(401);
                  should.not.exist(res.body.access_token);

                  done();
                });
            });
        });

        it('must allow beforeCreateToken', function(done) {
          var q = {
            grant_type: 'password',
            username: 'jimmy',
            password: 'jimmy'
          };
          var qs = querystring.stringify(q);
          request(this.server)
            .post('/accesstoken')
            .auth(client_id, client_secret)
            .send(qs)
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              should.exist(res.body.access_token);

              should.exist(res.body.attributes);
              res.body.attributes['beforeCreateTokenCalled'].should.eql(true);

              done();
            });
        });

        it('must allow invalidate', function(done) {

          var server = this.server;
          getToken(null, function(err, token) {
            if (err) { return done(err); }

            var q = { token: token };
            var qs = querystring.stringify(q);
            request(server)
              .post('/invalidate')
              .auth(client_id, client_secret)
              .send(qs)
              .end(function(err, res) {
                should.not.exist(err);

                res.status.should.eql(200);
                should.not.exist(res.body.access_token);

                done();
              });
          });
        });

        it('must allow refresh', function(done) {
          var q = {
            grant_type: 'password',
            username: 'jimmy',
            password: 'jimmy'
          };
          var qs = querystring.stringify(q);
          var server = this.server;
          request(this.server)
            .post('/accesstoken')
            .auth(client_id, client_secret)
            .send(qs)
            .end(function(err, res) {
              should.not.exist(err);

              res.status.should.eql(200);
              should.exist(res.body.access_token);
              should.exist(res.body.refresh_token);

              q = { refresh_token: res.body.refresh_token, grant_type: 'refresh_token' };
              var qs = querystring.stringify(q);
              request(server)
                .post('/refresh')
                .auth(client_id, client_secret)
                .send(qs)
                .end(function(err, res) {
                  should.not.exist(err);
                  res.status.should.eql(200);
                  should.exist(res.body.access_token);

                  done();
                });
            });
        });
      });

      describe('Analytics', function() {

        it('must apply and flush', function(done) {

          var server = this.server;

          var makeRecordCalled = false;
          server.volos.resources['analytics'].spi.once('makeRecord', function(event) {
            makeRecordCalled = true;
          });

          server.volos.resources['analytics'].spi.once('flush', function(records) {
            records.length.should.equal(1);
            makeRecordCalled.should.be.true;
            should(records[0].finalized).be.true;
            done();
          });

          request(server)
            .get('/analyzedPath')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              res.body.count.should.equal(++count);
            });
        });
      });

    });

    describe('Path', function() {

      it('must hit cache', function(done) {

        var server = this.server;
        request(this.server)
          .get('/cachedPath')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);
            should.exist(res.header['cache-control']);
            res.body.count.should.equal(++count);
            var headers = res.headers;

            request(server)
              .get('/cachedPath')
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(200);
                res.body.count.should.equal(count);
                _.keys(headers).length.should.equal(_.keys(res.headers).length);

                done();
              });
          });
      });

      it('must hit quota', function(done) {

        var server = this.server;
        request(this.server)
          .get('/quotaPath')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);
            res.body.count.should.equal(++count);

            request(server)
              .get('/quotaPath')
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(200);
                res.body.count.should.equal(++count);

                request(server)
                  .get('/quotaPath')
                  .end(function(err, res) {
                    should.not.exist(err);
                    res.status.should.eql(403);

                    done();
                  });
              });
          });
      });

      it('must handle auth', function(done) {

        var server = this.server;
        request(this.server)
          .get('/securedPath')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(401);

            getToken(null, function(err, token) {
              if (err) { return done(err); }

              request(server)
                .get('/securedPath')
                .set('Authorization', 'Bearer ' + token)
                .end(function(err, res) {
                  should.not.exist(err);
                  res.status.should.eql(200);
                  res.body.count.should.equal(++count);

                  done();
                });

            });
          });
      });

    });

    describe('Swagger Oauth', function() {

      it('must handle auth', function(done) {

        var server = this.server;
        request(this.server)
          .get('/swaggerSecured')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(401);

            getToken(null, function(err, token) {
              if (err) { return done(err); }

              request(server)
                .get('/swaggerSecured')
                .set('Authorization', 'Bearer ' + token)
                .end(function(err, res) {
                  should.not.exist(err);
                  res.status.should.eql(200);
                  res.body.count.should.equal(++count);

                  done();
                });
            });
          });
      });

      it('must handle scopes', function(done) {

        var server = this.server;
        getToken(null, function(err, token) {
          if (err) { return done(err); }

          request(server)
            .get('/swaggerSecuredScope2')
            .set('Authorization', 'Bearer ' + token)
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(400);

              getToken('scope2', function(err, token) {
                if (err) { return done(err); }

                request(server)
                  .get('/swaggerSecuredScope2')
                  .set('Authorization', 'Bearer ' + token)
                  .end(function(err, res) {
                    should.not.exist(err);
                    res.status.should.eql(200);
                    res.body.count.should.equal(++count);

                    done();
                  });
              });
            });
        });
      });
    });

    describe('Swagger ApiKey', function() {

      it('must handle auth in header', function(done) {

        var server = this.server;
        request(this.server)
          .get('/swaggerApiKeySecuredHeader')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(401);

            request(server)
              .get('/swaggerApiKeySecuredHeader')
              .set({ 'X-API-KEY': client_id })
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(200);
                res.body.count.should.equal(++count);

                done();
              });
          });
      });

      it('must handle auth in query', function(done) {

        var server = this.server;
        request(this.server)
          .get('/swaggerApiKeySecuredQuery')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(401);

            request(server)
              .get('/swaggerApiKeySecuredQuery')
              .query({ apiKey: client_id })
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(200);
                res.body.count.should.equal(++count);

                done();
              });
          });
      });
    });

    describe('Swagger Basic Auth', function() {

      it('must handle', function(done) {

        var server = this.server;
        request(this.server)
          .get('/swaggerBasicAuth')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(401);

            request(server)
              .get('/swaggerBasicAuth')
              .auth('wrong', 'password')
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(401);

                request(server)
                  .get('/swaggerBasicAuth')
                  .auth('scott', 'scott')
                  .end(function(err, res) {
                    should.not.exist(err);
                    res.status.should.eql(200);
                    res.body.count.should.equal(++count);

                    done();
                  });
              });
          });
      });
    });
  });
});
