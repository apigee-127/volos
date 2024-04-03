/*
 * Test the mock backend that we have implemented in testserver.js
 */

const assert = require('assert'),
      childProcess = require('child_process'),
      path = require('path'),
      requestModule = require('postman-request'),
      request = requestModule.defaults({
        json: true
      }),
      BASE = 'http://localhost:9000/v1';


describe('Test mock backend', function() {
  var server;

  beforeAll(function(done) {
    server = childProcess.fork(path.join(__dirname, 'fixtures/testserver.js'));
    setTimeout(function() {
      done();
    }, 1000);
  });
  afterAll(function() {
    server.kill();
  });

  it('Get org list', function(done) {
    request.get(BASE + '/o', function(err, resp, body) {
      assert(!err);
      done();
    });
  });

  it('Get good org', function(done) {
    request.get(BASE + '/o/org1', function(err, resp, body) {
      assert(!err);
      assert.equal(body.name, 'org1');
      done();
    });
  });
  it('Get bad org', function(done) {
    request.get(BASE + '/o/nonexistant', function(err, resp, body) {
      assert(!err);
      assert.equal(resp.statusCode, 404);
      done();
    });
  });

  it('Get test environment', function(done) {
    request.get(BASE + '/o/org1/e/test', function(err, resp, body) {
      assert(!err);
      assert.equal(body.name, 'test');
      done();
    });
  });
  it('Get prod environment', function(done) {
    request.get(BASE + '/o/org1/e/prod', function(err, resp, body) {
      assert(!err);
      assert.equal(body.name, 'prod');
      done();
    });
  });
  it('Get bad environment', function(done) {
    request.get(BASE + '/o/org1/e/BAD', function(err, resp, body) {
      assert(!err);
      assert.equal(resp.statusCode, 404);
      done();
    });
  });

  it('Get default virtual host', function(done) {
    request.get(BASE + '/o/org1/e/test/virtualhosts/default', function(err, resp, body) {
      assert(!err);
      assert.equal(body.name, 'default');
      assert.equal(body.port, 80);
      done();
    });
  });
  it('Get secure virtual host', function(done) {
    request.get(BASE + '/o/org1/e/test/virtualhosts/secure', function(err, resp, body) {
      assert(!err);
      assert.equal(body.name, 'secure');
      assert.equal(body.port, 443);
      done();
    });
  });
  it('Get bad virtual host', function(done) {
    request.get(BASE + '/o/org1/e/test/virtualhosts/BAD', function(err, resp, body) {
      assert(!err);
      assert.equal(resp.statusCode, 404);
      done();
    });
  });

  it('Get no APIs', function(done) {
    request.get(BASE + '/o/org1/apis', function(err, resp, body) {
      assert(!err);
      assert.equal(resp.statusCode, 200);
      assert.equal(body.length, 0);
      done();
    });
  });
  it('Add API', function(done) {
    var api = { name: 'api1'};
    request.post(BASE + '/o/org1/apis', { body: api }, function(err, resp, body) {
      assert(!err);
      assert.equal(resp.statusCode, 201);
      done();
    });
  });
  it('Check API', function(done) {
    request.get(BASE + '/o/org1/apis/api1', function(err, resp, body) {
      assert(!err);
      assert.equal(resp.statusCode, 200);
      done();
    });
  });

  it('Add Revision', function(done) {
    done();
  });
});
