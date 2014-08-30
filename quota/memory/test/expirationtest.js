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

var Spi = require('..');
var config = require('../../../testconfig/testconfig').config;
var assert = require('assert');
var _ = require('underscore');

// clone & extend hash
function extend(a, b) {
  var reply = _.extend({}, a, b);
  disableBuffer(reply); // need to bypass buffer for these tests
  return reply;
}

function disableBuffer(options) {
  delete(options.bufferSize);
  delete(options.bufferTimeout);
}

describe('Quota', function() {

  describe('Expiration time', function() {

    it('Minute rolling', function() {
      var options = extend(config, {
        timeUnit: 'minute',
        interval: 1,
        allow: 5
      });
      var q = Spi.create(options).quota;

      var start = new Date('March 7, 2013 12:00:00');
      var end =   new Date('March 7, 2013 12:01:00');
      var expires = new Date(q.calculateExpiration(start.getTime()));
      assert.deepEqual(end, expires);

      start = new Date('March 7, 2013 12:00:27');
      end =   new Date('March 7, 2013 12:01:27');
      expires = new Date(q.calculateExpiration(start.getTime()));
      assert.deepEqual(end, expires);

      q.destroy();
    });

    it('Minute calendar', function() {
      var options = extend(config, {
        timeUnit: 'minute',
        interval: 1,
        allow: 5,
        startTime: new Date('March 7, 2013 12:00:00').getTime()
      });
      var q = Spi.create(options).quota;

      // Easy
      var now = new Date('March 7, 2013 12:00:00');
      var end =   new Date('March 7, 2013 12:01:00');
      var expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      // Bucket is up in a minute
      now = new Date('March 7, 2013 12:00:27');
      end =   new Date('March 7, 2013 12:01:00');
      expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      // Some time after the start
      now = new Date('October 28, 2013 13:23:00');
      end =   new Date('October 28, 2013 13:24:00');
      expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      now = new Date('October 28, 2013 13:23:13');
      end =   new Date('October 28, 2013 13:24:00');
      expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      q.destroy();
    });

    it('Hour rolling', function() {
      var options = extend(config, {
        timeUnit: 'hour',
        interval: 1,
        allow: 5
      });
      var q = Spi.create(options).quota;

      var start = new Date('March 7, 2013 12:00:00');
      var end =   new Date('March 7, 2013 13:00:00');
      var expires = new Date(q.calculateExpiration(start.getTime()));
      assert.deepEqual(end, expires);

      start = new Date('March 7, 2013 12:00:27');
      end =   new Date('March 7, 2013 13:00:27');
      expires = new Date(q.calculateExpiration(start.getTime()));
      assert.deepEqual(end, expires);

      q.destroy();
    });

    it('Hour calendar', function() {
      var options = extend(config, {
        timeUnit: 'hour',
        interval: 1,
        allow: 5,
        startTime: new Date('March 7, 2013 12:00:00').getTime()
      });
      var q = Spi.create(options).quota;

      // Easy
      var now = new Date('March 7, 2013 12:00:00');
      var end =   new Date('March 7, 2013 13:00:00');
      var expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      now = new Date('March 7, 2013 12:15:42');
      end =   new Date('March 7, 2013 13:00:00');
      expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      // Some time after the start
      now = new Date('October 28, 2013 13:00:00');
      end =   new Date('October 28, 2013 14:00:00');
      expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      now = new Date('October 28, 2013 13:23:13');
      end =   new Date('October 28, 2013 14:00:00');
      expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      q.destroy();
    });

    it('Day calendar', function() {
      var options = extend(config, {
        timeUnit: 'day',
        interval: 1,
        allow: 5,
        startTime: new Date('March 7, 2013 12:00:00').getTime()
      });
      var q = Spi.create(options).quota;

      // Easy
      var now = new Date('March 7, 2013 12:00:00');
      var end =   new Date('March 8, 2013 12:00:00');
      var expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      now = new Date('March 7, 2013 22:23:24');
      end =   new Date('March 8, 2013 12:00:00');
      expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      // Some time after the start
      now = new Date('March 8, 2013 12:00:00');
      end =   new Date('March 9, 2013 12:00:00');
      expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      now = new Date('March 9, 2013 09:10:11');
      end =   new Date('March 9, 2013 12:00:00');
      expires = new Date(q.calculateExpiration(now.getTime()));
      assert.deepEqual(end, expires);

      q.destroy();
    });
  });
});