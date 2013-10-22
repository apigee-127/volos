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

var request = require('supertest');
var querystring = require('querystring');
var server = require('../fixtures/expressserver.js');

// todo: make config dynamic
var config = require('../../common/testconfig-apigee.js');
var creator = config.fixtureCreator;

describe('Api', function() {

  this.timeout(5000);

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

  it('get with valid token', function(done) {
    request(server)
      .post('/accesstoken')
      .send(querystring.stringify(
        { client_id: key, client_secret: secret, grant_type: 'client_credentials' }))
      .expect(200)
      .expect(/access_token/)
      .end(function(err, res){
        if (err) { return done(err); }
        var access_token = res.body.access_token;

        request(server)
          .get('/dogs')
          .set('Authorization', 'Bearer ' + access_token)
          .expect(200, done);
      });
  });
});
