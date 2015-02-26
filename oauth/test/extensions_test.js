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

var should = require('should');
var _ = require('underscore');
var querystring = require('querystring');
var Url = require('url');
var MemCache = require('volos-cache-memory');

var REDIRECT_URL = 'http://example.org';

exports.verifyOauth = function(config) {

  var oauth = config.oauth;
  var creator = config.fixtureCreator;
  var validUserCreds = config.validUserCreds;

  describe('volos extensions', function() {

    var apps;
    var defaultScope;
    var scopes;
    var client_id;
    var client_secret;

    var options = {
      tokenLifetime: 10000,
      attributes: {
        foo: 'bar'
      }
    };

    before(function(done) {
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
      creator.destroyFixtures(done);
    });

    describe('token attributes', function() {

      it('password credentials', function(done) {
        var body = {
          grant_type: 'password',
          username: validUserCreds.username,
          password: validUserCreds.password,
          client_id: client_id,
          client_secret: client_secret
        };
        oauth.generateToken(body, options, function(err, token) {
          should.not.exist(err);
          should.exist(token.attributes.foo);
          token.attributes.foo.should.equal(options.attributes.foo);

          var header = 'Bearer ' + token.access_token;
          oauth.verifyToken(header, function(err, reply) {
            should.not.exist(err);
            should.exist(reply.attributes);
            reply.attributes.foo.should.equal(options.attributes.foo);
            done();
          });
        });
      });

      it('client credentials', function(done) {
        var body = {
          grant_type: 'client_credentials',
          client_id: client_id,
          client_secret: client_secret
        };
        oauth.generateToken(body, options, function(err, token) {
          should.not.exist(err);
          should.exist(token.attributes.foo);
          token.attributes.foo.should.equal(options.attributes.foo);

          var header = 'Bearer ' + token.access_token;
          oauth.verifyToken(header, function(err, reply) {
            should.not.exist(err);
            should.exist(reply.attributes);
            reply.attributes.foo.should.equal(options.attributes.foo);
            done();
          });
        });
      });

      it('authorization code', function(done) {
        var query = {
          grant_type: 'authorization_code',
          client_id: client_id,
          client_secret: client_secret,
          redirect_uri: REDIRECT_URL,
          response_type: 'code'
        };
        var qs = querystring.stringify(query);

        oauth.authorize(qs, function(err, reply) {
          var code = Url.parse(reply, true).query.code;

          var body = {
            grant_type: 'authorization_code',
            code: code,
            client_id: client_id,
            client_secret: client_secret,
            redirect_uri: REDIRECT_URL
          };

          oauth.generateToken(body, options, function(err, token) {
            should.not.exist(err);
            should.exist(token.attributes.foo);
            token.attributes.foo.should.equal(options.attributes.foo);

            var header = 'Bearer ' + token.access_token;
            oauth.verifyToken(header, function(err, reply) {
              should.not.exist(err);
              should.exist(reply.attributes);
              reply.attributes.foo.should.equal(options.attributes.foo);
              done();
            });
          });
        });
      });

      it('refresh token', function(done) {
        var body = {
          grant_type: 'password',
          username: validUserCreds.username,
          password: validUserCreds.password,
          client_id: client_id,
          client_secret: client_secret
        };
        oauth.generateToken(body, options, function(err, token) {
          should.not.exist(err);
          should.exist(token.attributes.foo);
          should.exist(token.refresh_token);
          token.attributes.foo.should.equal(options.attributes.foo);

          var body = {
            grant_type: 'refresh_token',
            client_id: client_id,
            client_secret: client_secret,
            refresh_token: token.refresh_token
          };
          oauth.refreshToken(querystring.stringify(body), {}, function(err, reply) {
            should.not.exist(err);
            should.exist(reply.attributes);
            reply.attributes.foo.should.equal(options.attributes.foo);
            done();
          });
        });
      });
    });

    describe('beforeCreateToken()', function() {

      var oldBeforeCreateToken;
      before(function(done) {
        oldBeforeCreateToken = oauth.beforeCreateToken;
        done();
      });

      afterEach(function(done) {
        oauth.beforeCreateToken = oldBeforeCreateToken;
        done();
      });

      it('hook is called', function(done) {
        var body = {
          grant_type: 'client_credentials',
          client_id: client_id,
          client_secret: client_secret
        };

        oauth.beforeCreateToken = function(parsedBody, options, next) {
          should.exist(parsedBody);
          should.exist(options);
          next();
        };

        oauth.generateToken(body, options, done);
      });
    });


    it('attempting to use a cache with encoding should fail', function(done) {
      var cache = MemCache.create('OAuth cache', { encoding: 'utf8' });
      (function() {
        config.oauth.useCache(cache);
      }
      ).should.throw();
      done();
    });

    it('verify should fail for bad scope', function(done) {
      var body = {
        grant_type: 'client_credentials',
        client_id: client_id,
        client_secret: client_secret,
        scope: 'scope1'
      };
      oauth.generateToken(body, options, function(err, token) {
        should.not.exist(err);
        token.scope.should.not.include('scope2');

        var header = 'Bearer ' + token.access_token;
        oauth.verifyToken(header, 'scope2', function(err, reply) {
          should.exist(err);
          done();
        });
      });
    });

    it('verify varying scopes', function(done) {
      var body = {
        grant_type: 'client_credentials',
        client_id: client_id,
        client_secret: client_secret,
        scope: 'scope1 scope2 scope3'
      };
      oauth.generateToken(body, options, function(err, token) {
        should.not.exist(err);
        should.exist(token);

        var header = 'Bearer ' + token.access_token;
        oauth.verifyToken(header, function(err) {
          should.not.exist(err);
          should.exist(token);

          // now, add a cache
          if (!config.oauth.isCached) {
            var addedCache = true;
            var cache = MemCache.create('OAuth cache');
            config.oauth.useCache(cache);
          }

          oauth.verifyToken(header, 'badscope', function(err) {
            should.exist(err);

            oauth.verifyToken(header, 'scope1', function(err) {
              should.not.exist(err);

              oauth.verifyToken(header, 'scope2', function(err) {
                should.not.exist(err);

                if (addedCache) { config.oauth.removeCache(); }

                done();
              });
            });
          });
        });
      });
    });

    it('verify valid apiKey', function(done) {
      var request = null;
      oauth.verifyApiKey(client_id, request, function(err, valid) {
        should.not.exist(err);
        should.exist(valid);
        valid.should.be.true;
        done();
      });
    });

    it('verify invalid apiKey', function(done) {
      var request = null;
      oauth.verifyApiKey('xxx', request, function(err, valid) {
        should.exist(err);
        should.not.exist(valid);
        err.code.should.eql('access_denied');
        err.message.should.eql('Invalid API Key');
        done();
      });
    });

  });
};
