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
var expressServer = require('./support/expressserver');
var async = require('async');
var _ = require('underscore');
var querystring = require('querystring');

var redisConfig = require('../../testconfig/testconfig-redis');
var oauth = redisConfig.oauth;

describe('Swagger Middleware', function() {

  var client_id, client_secret, defaultScope, scopes;
  var creator = redisConfig.fixtureCreator;
  var server = expressServer();
  var count = 0;

  before(function(done) {
    creator.createFixtures(function(err, apps) {
      if (err) { return done(err); }
      client_id = apps[0].credentials[0].key;
      client_secret = apps[0].credentials[0].secret;
      defaultScope = apps[0].defaultScope;
      scopes = apps[0].scopes;
      done();
    });
  });

  after(function(done) {
    creator.destroyFixtures(done);
  });

  describe('Operations', function() {


    it('must access clean', function(done) {
      request(server)
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
        request(server)
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
        request(server)
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
        request(server)
          .get('/cachedWithKey')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);
            res.body.count.should.equal(count);

            done();
          });
      });

      it('must accept function key', function(done) {
        request(server)
          .get('/cachedWithFunctionKey')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);
            res.body.count.should.equal(count);

            done();
          });
      });

      it('must accept ttl override', function(done) {
        request(server)
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
            }, 10);
          });
      });
    });

    describe('Quota', function() {

      before(function(done) {
        request(server)
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

        request(server)
          .get('/quota')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(403);

            done();
          });
      });

      it('must hit with key', function(done) {

        request(server)
          .get('/quotaWithKey')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(403);

            done();
          });
      });

      it('must hit with weight', function(done) {

        request(server)
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

        request(server)
          .get('/quotaWithFunctionKey')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(403);

            done();
          });
      });

    });

    describe('Oauth', function() {

      it('must handle auth', function(done) {

        request(server)
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

      it('must allow passwordCheck', function(done) {
        var q = {
          grant_type: 'password',
          username: 'jimmy',
          password: 'jimmy'
        };
        var qs = querystring.stringify(q);
        request(server)
          .post('/accesstoken')
          .auth(client_id, client_secret)
          .send(qs)
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);
            should.exist(res.body.access_token);

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
    });

    describe('Analytics', function() {

      it('must apply and flush', function(done) {

        var makeRecordCalled = false;
        server.volos.resources['analytics'].spi.once('makeRecord', function(event) {
          makeRecordCalled = true;
        });

        server.volos.resources['analytics'].spi.once('flush', function(records) {
          records.length.should.equal(1);
          makeRecordCalled.should.ok;
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

      request(server)
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

      request(server)
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
});

