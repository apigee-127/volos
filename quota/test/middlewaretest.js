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

var memoryQuota = require('../memory');
var expressServer = require('./expressserver');
var argoServer = require('./argoserver');
var verifyQuota = require('./verifyquota');

describe('Quota Middleware', function() {

  describe('Express', function() {
    var options = {
      timeUnit: 'minute',
      interval: 1,
      allow: 2
    };
    var quota = memoryQuota.create(options);
    var server = expressServer(quota);
    verifyQuota.verify(server);
  });

  describe('Argo', function() {
    var options = {
      timeUnit: 'minute',
      interval: 1,
      allow: 2
    };
    var quota = memoryQuota.create(options);
    var server = argoServer(10011, quota);
    verifyQuota.verify(server);
  });

});
