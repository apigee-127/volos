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
Note: To actually run this test this on Apigee Edge, you'll need to do the following (from the cache/apigee module dir):
  > npm install
  > cp ../../test/cachetest.js ./cachetest.js
  > apigeetool deploynodeapp -n cachetest -d . -m apigee_app.js -o ORG -e test -b cachetest -u USER -p PASSWORD
  > curl http://ORG-test.apigee.net/cachetest
 */

var Spi = require('..');
var commonTest;
try {
  commonTest = require('./cachetest'); // if we've copied it here for running on Apigee (see above)
} catch (err) {
  commonTest = require('../../test/cachetest');
}
var apigee = require('apigee-access');

describe('Apigee', function() {

  this.timeout(15000);
  var spi = Spi;

  it('should allow a fallback module', function() {

    if (apigee.getMode() === apigee.APIGEE_MODE) { return; }

    var options = {
      fallback : require('volos-cache-memory')
    };
    Spi.create('fallback', options);
  });

  it('should allow a fallback string', function() {

    if (apigee.getMode() === apigee.APIGEE_MODE) { return; }

    var options = {
      fallback : 'volos-cache-memory'
    };
    Spi.create('fallback', options);
  });

  it('should still pass tests', function() {

    if (apigee.getMode() !== apigee.APIGEE_MODE) { // if we're not in Apigee, fallback to memory (if available)
      try {
        var memoryCache = require('volos-cache-memory');
        spi = {
          create: function (name, options) {
            options = options || {};
            options.fallback = memoryCache;
            return Spi.create(name, options);
          }
        };
      } catch (err) {
        spi = null;
      }
    }

    if (spi) { commonTest.testCache({}, spi); }
  });

});
