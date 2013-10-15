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
