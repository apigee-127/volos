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

var redisConfig = require('../../testconfig/testconfig-redis');
var oauth = redisConfig.oauth;

var swagger = require('./support/swagger.json');

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

    it('must hit cache', function(done) {
      request(server)
        .get('/cached')
        .end(function(err, res) {
          should.not.exist(err);
          res.status.should.eql(200);
          should.exist(res.header['cache-control']);
          res.body.count.should.equal(++count);
          var headers = res.headers;

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
    });

    it('must hit quota', function(done) {
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

              request(server)
                .get('/quota')
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
        .get('/secured')
        .end(function(err, res) {
          should.not.exist(err);
          res.status.should.eql(401);

          getToken(function(err, token) {
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

          getToken(function(err, token) {
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

  function getToken(cb) {

    var tokenRequest = {
      clientId: client_id,
      clientSecret: client_secret
    };

    oauth.spi.createTokenClientCredentials(tokenRequest, function(err, result) {
      if (err) { cb(err); }
      cb(null, result.access_token);
    });
  }
});

