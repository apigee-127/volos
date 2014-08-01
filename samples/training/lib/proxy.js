'use strict';

var util = require('util');
var http = require('http');
var connect = require('connect');
var httpProxy = require('http-proxy');
var PORT = 8012;

// create http proxy middleware
var hitNum = 0;

function createProxy(middlewares) {

  // start the target server
  var targetServer = require('./target');

  var proxy = httpProxy.createProxyServer({
    target: 'http://localhost:' + targetServer.port
  });

  var server = connect();

  if (!Array.isArray(middlewares)) {
    middlewares = [ middlewares ] || [];
  }

  middlewares.unshift(function(req, res, next) {
    util.log(util.format('proxy: %d request: %s', ++hitNum, req.url));
    next();
  });

  middlewares.push(function(req, res) {
    util.log(util.format('proxy: forwarding: %s', req.url));
    proxy.web(req, res);
  });

  for (var i = 0; i < middlewares.length; i++) {
    server.use(middlewares[i]);
  }

  server.listen(PORT);

  util.log('proxy: started on port ' + PORT);

  console.log('\nAccess via web browser or curl: ' + 'curl http://localhost:8012/test');

  return proxy;
}

module.exports.createProxy = createProxy;
