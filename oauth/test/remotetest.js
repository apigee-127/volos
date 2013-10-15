var assert = require('assert');
var fixtures = require('../../common/createfixtures');
var http = require('http');
var helper = require('../../common/httphelper');
var path = require('path');
var config = require('../../common/testconfig');
var querystring = require('querystring');
var url = require('url');

module.exports.runTests = function(base, shutdown) {
  describe('Remote tests', function() {
    var app;
    var key;
    var secret;
    var authHeader;
    var token;
    var refreshToken;
    var code;

    this.timeout(10000);

    before(function(done) {
      var creator = new fixtures();
      creator.createFixtures(function(err, newApp) {
        if (err) {
          console.error('Error creating fixtures: %j', err);
        }
        assert(!err);
        app = newApp;
        key = app.credentials[0].key;
        secret = app.credentials[0].secret;
        authHeader = 'Basic ' + (new Buffer(key + ':' + secret).toString('base64'));
        done();
      });
    });

    function checkToken(token, done) {
      var req = http.request(base + '/dogs', function(resp) {
        try {
          assert.equal(200, resp.statusCode);
        } finally {
          done();
        }
      });
      req.setHeader('Authorization', 'Bearer ' + token);
      req.end();
    }
/*
    it('Unauthorized', function(done) {
      http.get(base + '/dogs', function(resp) {
        try {
          assert.equal(401, resp.statusCode);
        } finally {
          done();
        }
      });
    });

    it('Bad client credentials grant', function(done) {
      helper.postFormGetJson(
        base + '/accesstoken',
        undefined,
        { grant_type: 'client_credentials' },
        function(resp, body) {
          try {
            assert.equal(401, resp.statusCode);
          } finally {
            done();
          }
        }
      );
    });
*/
    it('Client credentials grant', function(done) {
      helper.postFormGetJson(
        base + '/accesstoken',
        authHeader,
        { grant_type: 'client_credentials' },
        function(resp, body) {
          assert.equal(200, resp.statusCode);
          assert(body.access_token);
          token = body.access_token;
          checkToken(token, done);
        }
      );
    });

    it('Client credentials grant with form params', function(done) {
      helper.postFormGetJson(
        base + '/accesstoken',
        undefined,
        { grant_type: 'client_credentials',
          client_id: key,
          client_secret: secret },
        function(resp, body) {
          assert.equal(200, resp.statusCode);
          assert(body.access_token);
          token = body.access_token;
          checkToken(token, done);
        }
      );
    });

    it('Password credentials grant', function(done) {
      helper.postFormGetJson(
        base + '/accesstoken',
        authHeader,
        { grant_type: 'password',
          username: 'foo', password: 'bar' },
        function(resp, body) {
          assert.equal(200, resp.statusCode);
          assert(body.access_token);
          token = body.access_token;
          checkToken(token, done);
        }
      );
    });

    it('Authorization code', function(done) {
      var q = {
        client_id: key,
        redirect_uri: 'http://example.org',
        response_type: 'code'
      };
      var qs = querystring.stringify(q);
      http.get(base + '/authorize?' + qs, function(resp) {
        assert.equal(301, resp.statusCode);
        assert(resp.headers.location);
        var parsed = url.parse(resp.headers.location, true);
        assert(parsed.query.code);
        code = parsed.query.code;

        helper.postFormGetJson(
          base + '/accesstoken',
          authHeader,
          { grant_type: 'authorization_code',
            code: code,
            redirect_uri: 'http://example.org' },
          function(resp, body) {
            assert.equal(200, resp.statusCode);
            assert(body.access_token);
            token = body.access_token;
            assert(body.refresh_token);
            refreshToken = body.refresh_token;
            checkToken(token, done);
          }
        );
      });
    });

    /*
    it('Refresh token', function(done) {
      helper.postFormGetJson(
        base + '/refresh',
        authHeader,
        { grant_type: 'refresh_token',
          refresh_token: refreshToken },
        function(resp, body) {
          try {
            assert.equal(200, resp.statusCode);
            assert(body.access_token);
            token = body.access_token;
          } finally {
            setTimeout(done, 1000);
          }
        }
      );
    });

    it('Refreshed token', function(done) {
      var req = http.request(base + '/dogs', function(resp) {
        try {
          assert.equal(200, resp.statusCode);
        } finally {
          done();
        }
      });
      req.setHeader('Authorization', 'Bearer ' + token);
      req.end();
    });
    */

    after(function() {
      // This tells the caller to stop the client - necessary because we don't want to do that
      // until all the tests have run, and only this module knows that.
      shutdown();
    });
  });
}

