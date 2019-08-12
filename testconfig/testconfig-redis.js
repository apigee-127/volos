'use strict';

var VALID_USER_CREDS = { username: 'foo', password: 'bar' };

var config = {
  host: '127.0.0.1',
  port: 6379,
  options: {
//    auth_pass: 'password'
  },
  encryptionKey: 'This is the key to encrypt/decrypt stored credentials',

  validGrantTypes: [ 'client_credentials', 'authorization_code', 'implicit_grant', 'password' ],
  tokenLifetime: 1000, // expiration tests will wait this long
  refreshTokenLifetime: 1000,
  passwordCheck: checkPassword
};

function checkPassword(username, password, cb) {
  cb(null, username === VALID_USER_CREDS.username && password === VALID_USER_CREDS.password);
}

var Management = require('volos-management-redis');
var management = Management.create(config);

var OAuth = require('volos-oauth-redis');
var oauth = OAuth.create(config);

var CreateFixtures = require('./createfixtures');
var fixtureCreator = new CreateFixtures(management);

module.exports = {
  management: management,
  oauth: oauth,
  fixtureCreator: fixtureCreator,
  config: config,
  validUserCreds: VALID_USER_CREDS
};
