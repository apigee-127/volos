'use strict';

var assert = require('assert');
var http = require('http');
var util = require('util');
var path = require('path');
var urlp = require('url');
var qs = require('querystring');

var mocha = require('mocha');

var PORT = process.env.PORT || 9010;

var svr = http.createServer(handle);
svr.listen(PORT, function() {
    console.log('Listening on %d', PORT);
});

function handle(req, resp) {
  // Put stuff in globals so that mocha scripts can access it.
  // Obviously this solution is only useful for unit tests
  var url = urlp.parse(req.url, true);
  GlobalRequest = req;

  var testScript;

  console.log('Access test: %s %s', req.method, url.pathname);

  if (req.method !== 'POST') {
    resp.writeHead(405, {
      allow: 'POST'
    });
    resp.end();
    return;
  } else if (url.pathname === '/cache') {
    testScript = './volos/cache/apigee/test/apigeetest.js';
  } else if (url.pathname === '/quota') {
    testScript = './volos/quota/apigee/test/apigeetest.js';
  } else if (url.pathname === '/restart') {
    // Mocha doesn't seem to be able to run the same test over and over again.
    // But if we restart then we can.
    process.exit(0);
    return;
  } else {
    sendError(resp, 404, 'Not found');
    return;
  }

  req.setEncoding('utf8');
  var body = '';

  req.on('data', function(chunk) {
    body += chunk;
  });

  req.on('end', function() {
    TestOptions = qs.parse(body);
    mochaTest(testScript, resp);
  });
}

function sendError(resp, code, msg) {
  resp.writeHead(code, msg);
  resp.end();
}

function mochaTest(fn, resp) {
  var m = new mocha();
  m.reporter('list');
  m.addFile(path.join(__dirname, fn));
  m.run(function (count) {
    var code = (count === 0 ? 200 : 500);
    resp.writeHead(code, {
      'content-type': 'text/plain'
    });
    resp.end(util.format('%d', count));
  });
}
