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
'use strict';

/*
See apigeetest.js for usage.
 */

var util = require('util');
var http = require('http');
var Mocha = require('mocha');
var fs = require('fs');
var path = require('path');

var mocha = new Mocha();
mocha.addFile('apigeetest.js');

function myReporter(runner) {
  var passes = 0;
  var failures = 0;

  runner.on('pass', function(test) {
    passes++;
    console.log('pass: %s', test.fullTitle());
  });

  runner.on('fail', function(test, err) {
    failures++;
    console.log('fail: %s -- error: %s', test.fullTitle(), err.message);
  });

  runner.on('end', function() {
    console.log('end: %d/%d', passes, passes + failures);
  });
}
mocha.reporter(myReporter);

function hook_stdout(callback) {
  var old_write = process.stdout.write;

  process.stdout.write = (function(write) {
    return function(string, encoding, fd) {
      write.apply(process.stdout, arguments);
      callback(string, encoding, fd);
    };
  })(process.stdout.write);

  return function() {
    process.stdout.write = old_write;
  };
}

var svr = http.createServer(function(req, resp) {

  var stdOutput = '';
  var unhook = hook_stdout(function(string, encoding, fd) {
    stdOutput += string;
  });
  mocha.run(function(failures) {
    resp.writeHead(200, { 'Content-Type': 'text/plain' });
    resp.end(stdOutput);
    unhook();
  });
});

svr.listen(process.env.PORT || 9000, function() {
  console.log('The server is running.');
});
