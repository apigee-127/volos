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
var config = require('../../../testconfig/testconfig-apigee').config;
var assert = require('assert');
var random = Math.random();
var _ = require('underscore');
var should = require('should');

// clone & extend hash
function extend(a, b) {
  return _.extend({}, a, b);
}

function id(_id) {
  return 'test:' + random + ":" + _id;
}

function checkResult(result, allowed, used, isAllowed) {
  assert(result);
  assert.equal(result.allowed, allowed);
  assert.equal(result.used, used);
  assert.equal(result.isAllowed, isAllowed);
}

describe('Apigee Quota', function() {

  var implementationName;

  this.timeout(10000);

  var pm;

  before(function(done) {
    var options = extend(config, {
      timeUnit: 'minute',
      interval: 1,
      allow: 2
    });
    pm = Spi.create(options);

    pm.quota.getImplementationName(function(err, implName) {
      implementationName = implName;
      done(err);
    });
  });

  describe('Rolling', function() {

    // Verify that quota is reset within the expiration time,
    // plus a fudge factor for distributed quota sync
    it('Minute', function(done) {
      this.timeout(120000);
      var hit = { identifier: id('TimeOne'), weight: 1 };
      pm.apply(hit, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);
        result.expiryTime.should.be.approximately(60000, 10000);

        setTimeout(function() {
          pm.apply(hit, function(err, result) {
            assert(!err);
            checkResult(result, 2, 2, true);

            // Ensure quota is reset within a minute
            setTimeout(function() {
              pm.apply(hit, function(err, result) {
                assert(!err);
                checkResult(result, 2, 1, true);
                done();
              });
            }, 40001);

          });
        }, 40001);
      });
    });
  });

  describe('Basic', function() {
    // Just do some basic counting
    it('Minute', function(done) {
      pm.apply({
        identifier: id('One'),
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);
        result.expiryTime.should.be.approximately(60000, 10000);

        pm.apply({
          identifier: id('One'),
          weight: 1
        }, function(err, result) {
          assert(!err);
          checkResult(result, 2, 2, true);

          pm.apply({
            identifier: id('Two'),
            weight: 1
          }, function(err, result) {
            assert(!err);
            checkResult(result, 2, 1, true);
            done();
          });
        });
      });
    });

    it('Quota weight', function(done) {
      // Ensure that weighting works
      // Apigee won't keep counting once the quota is exceeded, so set a
      // larger "allow" value for this
      pm.apply({
        identifier: id('WeightOne'),
        weight: 1,
        allow: 10
      }, function(err, result) {
        assert(!err);
        checkResult(result, 10, 1, true);

        pm.apply({
          identifier: id('WeightOne'),
          weight: 3,
          allow: 10
        }, function(err, result) {
          assert(!err);
          checkResult(result, 10, 4, true);
          done();
        });
      });
    });
  });

  describe('Calendar', function() {

    // For each of these, verify that the parameters work and that we can
    // calculate the right expiration time. Do not wait for expiration
    // as we can't seem to get consistent results there yet.
    it('Minute', function(done) {
      if (implementationName === 'OldRemote') {
        console.log('Skipping calendar tests because old implementation doesn\'t support them');
        return done();
      }
      var startTime = Date.now() - 59000; // start almost a minute ago
      var options = extend(config, {
        timeUnit: 'minute',
        interval: 1,
        allow: 1,
        startTime: startTime
      });
      var pm = Spi.create(options);

      var hit = { identifier: id('TimeTwo'), weight: 1 };
      pm.apply(hit, function(err, result) {
        assert(!err);
        checkResult(result, 1, 1, true);
        result.expiryTime.should.be.approximately(250, 500);
        done();
      });
    });

    it('Hour', function(done) {
      if (implementationName === 'OldRemote') {
        return done();
      }
      var startTime = Date.now() - (60000 * 60 - 1000); // start almost an hour ago
      var options = extend(config, {
        timeUnit: 'hour',
        interval: 1,
        allow: 1,
        startTime: startTime
      });
      var pm = Spi.create(options);

      var hit = { identifier: id('TimeThree'), weight: 1 };
      pm.apply(hit, function(err, result) {
        assert(!err);
        checkResult(result, 1, 1, true);
        result.expiryTime.should.be.approximately(250, 500);
        done();
      });
    });

    it('Day', function(done) {
      if (implementationName === 'OldRemote') {
        return done();
      }
      var startTime = Date.now() - (60000 * 60 * 24 - 1000); // start almost a day ago
      var options = extend(config, {
        timeUnit: 'day',
        interval: 1,
        allow: 1,
        startTime: startTime
      });
      var pm = Spi.create(options);

      var hit = { identifier: id('TimeFour'), weight: 1 };
      pm.apply(hit, function(err, result) {
        assert(!err);
        checkResult(result, 1, 1, true);
        result.expiryTime.should.be.approximately(250, 500);
        done();
      });
    });

    it('Week', function(done) {
      if (implementationName === 'OldRemote') {
        return done();
      }
      var startTime = Date.now() - (60000 * 60 * 24 * 7 - 1000); // start almost a week ago
      var options = extend(config, {
        timeUnit: 'week',
        interval: 1,
        allow: 1,
        startTime: startTime
      });
      var pm = Spi.create(options);

      var hit = { identifier: id('TimeFive'), weight: 1 };
      pm.apply(hit, function(err, result) {
        assert(!err);
        checkResult(result, 1, 1, true);
        result.expiryTime.should.be.approximately(250, 500);
        done();
      });
    });
  });

  describe('via proxy using request options', function() {

    var http = require('http');
    var Proxy = require('proxy');

    var implementationName;
    var pm;
    var proxy;
    var proxyCalled;

    before(function(done) {

      var server = http.createServer();
      server.authenticate = function(req, cb) {
        proxyCalled = true;
        cb(null, true);
      };

      proxy = Proxy(server);
      proxy.listen(0, function() {
        var options = extend(config, {
          timeUnit: 'minute',
          interval: 1,
          allow: 2,
          request: {
            proxy: 'http://localhost:' + proxy.address().port
          }
        });
        pm = Spi.create(options);

        pm.quota.getImplementationName(function(err, implName) {
          implementationName = implName;
          done(err);
        });
      });
    });

    after(function() {
      proxy.close();
    });

    it('works', function(done) {
      if (implementationName === 'OldRemote') {
        return done();
      }
      pm.apply({
        identifier: id('Proxy'),
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);
        assert(proxyCalled);
        done();
      });
    });
  });
});
