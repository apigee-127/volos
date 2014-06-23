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
        oauth.verifyToken(header, 'scope2', function(err) {
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
            var Cache = require('volos-cache-memory');
            var cache = Cache.create('OAuth cache');
            config.oauth.useCache(cache);
          }

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
};
