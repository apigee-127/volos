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
var apieasy = require('api-easy');
var querystring = require('querystring');
var config = require('../../common/testconfig.js');
var fixtures = require('../../common/createfixtures');

var suite = apieasy.describe('OAuth API');

var app;
var key;
var secret;
var authHeader;

var creator = new fixtures();
      creator.createFixtures(function(err, newApp) {
        if (err) {
          console.error('Error creating fixtures: %j', err);
        }
        app = newApp;
        key = app.credentials[0].key;
        secret = app.credentials[0].secret;
        authHeader = 'Basic ' + (new Buffer(key + ':' + secret).toString('base64'));
      });

function runTests(host, port, shutdown) {
  suite.use(host, port)
    .get('/dogs')
    .expect(401)
    .post('/accesstoken', querystring.stringify({ hello: 'World'}))
    .expect(401)
    .post('/accesstoken', querystring.stringify(
      { client_id: key, client_secret: secret,
        grant_type: 'client_credentials' }))
    .expect(200)
    .expect('Access token set', function(err, res, body) {
      console.log('TOken set: %j', body);
    })
    .export(module);
}

runTests('localhost', 10010, function() {
  console.log('done');
});
