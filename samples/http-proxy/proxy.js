/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2014 Apigee Corporation

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
'use strict';

/* A simple proxy using Volos cache and quota middleware */

var util = require('util');
var http = require('http');
var connect = require('connect');
var httpProxy = require('http-proxy');
var memoryQuota = require('volos-quota-memory');
var memoryCache = require('volos-cache-memory');

// create Volos cache
var cache = memoryCache.create('cache', {
  ttl: 1000
});

// create Volos quota
var quota = memoryQuota.create({
  timeUnit: 'minute',
  interval: 1,
  allow: 2
});

// create http proxy middleware
var proxy = httpProxy.createProxyServer({
  target: 'http://localhost:9012'
});

// Create proxy server
connect.createServer(

  // apply Volos cache
  // improves performance and ability to respond before hitting quota
  cache.expressMiddleware().cache(),

  // apply Volos quota
  // protects the backend from excess requests
  quota.expressMiddleware().apply('quota'),

  // proxy requests through http-proxy
  function (req, res) {
    util.log('proxy sending to http server');
    proxy.web(req, res);
  }
).listen(8012);


// Create Example Http Server Target
http.createServer(function (req, res) {
  util.log('http server returning data');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request received. url: ' + req.url + '\n headers: ' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9012);

console.log('http server started on port 9012');
console.log('proxy server started on port 8012');
console.log('test proxy:');
console.log(' curl localhost:8012');
