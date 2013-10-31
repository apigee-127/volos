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
var request = require('supertest');
var querystring = require('querystring');

var config = require('../../common/testconfig-apigee');
var creator = config.fixtureCreator;

exports.verifyOauth = function(server){

  function checkAccessToken(access_token, done) {
    request(server)
      .get('/dogs')
      .set('Authorization', 'Bearer ' + access_token)
      .expect(200, done);
  }

  describe('remote', function() {

    this.timeout(10000);

    var key;
    var secret;

    before(function(done) {
      creator.createFixtures(function(err, app) {
        if (err) {
          console.error('Error creating fixtures: %j', err);
        }
        key = app.credentials[0].key;
        secret = app.credentials[0].secret;
        done();
      });
    });

    it('get without token', function(done) {
      request(server)
        .get('/dogs')
        .expect(400, done);
    });

    it('invalid grant format', function(done) {
      request(server)
        .post('/accesstoken')
        .send(querystring.stringify({ hello: 'World'}))
        .expect(400, done);
    });

    it('invalid client credentials', function(done) {
      request(server)
        .post('/accesstoken')
        .send(querystring.stringify({ grant_type: 'client_credentials', client_id: "invalid", client_secret: "invalid" }))
        .expect(/invalid_client/)
        .expect(400, done);
    });

    it('client credentials: id, secret', function(done) {
      request(server)
        .post('/accesstoken')
        .send(querystring.stringify({ grant_type: 'client_credentials', client_id: key, client_secret: secret }))
        .expect(200)
        .expect(/access_token/)
        .end(function(err, res){
          if (err) { return done(err); }
          checkAccessToken(res.body.access_token, done);
        });
    });

    it('client credentials: basic auth', function(done) {
      request(server)
        .post('/accesstoken')
        .auth(key, secret)
        .send(querystring.stringify({ grant_type: 'client_credentials' }))
        .expect(200)
        .expect(/access_token/)
        .end(function(err, res){
          if (err) { return done(err); }
          checkAccessToken(res.body.access_token, done);
        });
    });

    it('password', function(done) {
      request(server)
        .post('/accesstoken')
        .auth(key, secret)
        .send(querystring.stringify({ grant_type: 'password', username: 'foo', password: 'bar' }))
        .expect(200)
        .expect(/access_token/)
        .end(function(err, res){
          if (err) { return done(err); }
          assert(res.body.access_token);
          checkAccessToken(res.body.access_token, done);
        });
    });

    it('authorization code', function(done) {
      var q = {
        client_id: key,
        redirect_uri: 'http://example.org',
        response_type: 'code'
      };
      var qs = querystring.stringify(q);
      request(server)
        .get('/authorize')
        .query(qs)
        .expect(301)
        .end(function(err, res){
          if (err) { return done(err); }
          assert(res.headers.location);
          var parsed = url.parse(res.headers.location, true);
          var code = parsed.query.code;
          assert(code);

          request(server)
            .post('/accesstoken')
            .auth(key, secret)
            .send(querystring.stringify(
              { grant_type: 'authorization_code', code: code, redirect_uri: 'http://example.org' }))
            .expect(200)
            .end(function(err, res){
              if (err) { return done(err); }
              var token = res.body.access_token;
              assert(token);
              var refreshToken = res.body.refresh_token;
              assert(refreshToken);
              checkAccessToken(token, done);
            });
        });
    });

    it('refresh token', function(done) {
      request(server)
        .post('/accesstoken')
        .auth(key, secret)
        .send(querystring.stringify({ grant_type: 'password', username: 'foo', password: 'bar' }))
        .expect(200)
        .end(function(err, res){
          if (err) { return done(err); }
          var refreshToken = res.body.refresh_token;
          assert(refreshToken);

          request(server)
            .post('/refresh')
            .auth(key, secret)
            .send(querystring.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }))
            .expect(200)
            .end(function(err, res){
              if (err) { return done(err); }
              var accessToken = res.body.access_token;
              assert(accessToken);
              checkAccessToken(accessToken, done);
            });
        });
    });
  });
};
