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

/** copy this file to testconfig-apigee.js and replace the config attributes */

var VALID_USER_CREDS = { username: 'foo', password: 'bar' };

var config = {
  // Your Apigee "organization" name
  organization: 'ORG',
  // Your Apigee user name -- used to create resources via the management API
  user: 'USER',
  // Your Apigee password
  password: 'PASS',
  // The URI where the "volos proxy" (in the "proxy") directory is deployed.
  // Necessary when running remote tests against Apigee.
  uri: 'URI',
  // The API key that protects access to the "volos proxy"
  key: 'KEY',
  // When deploying tests from the "serversidetests" directory, the URI where/
  // they will run.
  testUriBase: 'TESTURIBASE',

  // These will generally not change when configuring Apigee
  validGrantTypes: [ 'client_credentials', 'authorization_code', 'implicit_grant', 'password' ],
  tokenLifetime: 4000, // expiration tests will wait this long
  passwordCheck: checkPassword
};

// The rest of this file does not need to be changed for a particular installation

function checkPassword(username, password, cb) {
  cb(null, username === VALID_USER_CREDS.username && password === VALID_USER_CREDS.password);
}

var Management = require('volos-management-apigee');
var management = Management.create(config);

var CreateFixtures = require('./createfixtures');
var fixtureCreator = new CreateFixtures(management);

var OAuth = require('volos-oauth-apigee');
var oauth = OAuth.create(config);

module.exports = {
  management: management,
  oauth: oauth,
  fixtureCreator: fixtureCreator,
  config: config,
  validUserCreds: VALID_USER_CREDS
};
