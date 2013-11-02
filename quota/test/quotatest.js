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

var assert = require('assert');
var extend = require('util')._extend;

exports.testQuota = function(config, Spi) {

  this.config = config;
  this.Spi = Spi;

  describe('Quota SPI', function() {
    var pm;
    var ph;

    before(function() {
      var options = extend(config, {
        timeUnit: 'minute',
        timeInterval: 2000,
        interval: 1,
        allow: 2
      });
      pm = Spi.create(options);

      options = extend(config, {
        timeUnit: 'minute',
        timeInterval: 10000,
        interval: 1,
        allow: 2
      });
      ph = Spi.create(options);
    });

    it('Basic per-minute', function(done) {
      pm.apply({
        identifier: 'One',
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);

        pm.apply({
          identifier: 'Two',
          weight: 1
        }, function(err, result) {
          assert(!err);
          checkResult(result, 2, 1, true);

          pm.apply({
            identifier: 'One',
            weight: 1
          }, function(err, result) {
            assert(!err);
            checkResult(result, 2, 2, true);

            pm.apply({
              identifier: 'One',
              weight: 1
            }, function(err, result) {
              assert(!err);
              checkResult(result, 2, 3, false);
              done();
            });
          });
        });

      });
    });

    it('Quota weight', function(done) {
      pm.apply({
        identifier: 'WeightOne',
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);

        pm.apply({
          identifier: 'WeightOne',
          weight: 3
        }, function(err, result) {
          assert(!err);
          checkResult(result, 2, 4, false);
          done();
        });
      });
    });

    it('Dynamic', function(done) {
      pm.apply({
        identifier: 'DynOne',
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);

        pm.apply({
          identifier: 'DynOne',
          weight: 1,
          allow: 1
        }, function(err, result) {
          assert(!err);
          checkResult(result, 1, 2, false);
          done();
        });
      });
    });

    it('Timeout', function(done) {
      this.timeout(30000);
      pm.apply({
        identifier: 'TimeOne',
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);

        // Ensure quota is reset within a minute
        setTimeout(function() {
          pm.apply({
            identifier: 'TimeOne',
            weight: 1
          }, function(err, result) {
            assert(!err);
            checkResult(result, 2, 1, true);
            done();
          });
        }, 2001);
      });
    });

    it('Timeout Cleanup', function(done) {
      this.timeout(30000);
      pm.apply({
        identifier: 'TimeTwo',
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);

        // Just let timeout thread run and actually do something
        setTimeout(function() {
          done();
        }, 4001);
      });
    });

    it('Hour', function(done) {
      this.timeout(30000);
      ph.apply({
        identifier: 'HourOne',
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);

        // Ensure quota is not reset within an hour
        setTimeout(function() {
          ph.apply({
            identifier: 'HourOne',
            weight: 1
          }, function(err, result) {
            assert(!err);
            checkResult(result, 2, 2, true);
            done();
          });
        }, 5002);
      });
    });
  });

  function checkResult(result, allowed, used, isAllowed) {
    assert(result);
    assert.equal(result.used, used);
    assert.equal(result.allowed, allowed);
    assert.equal(result.isAllowed, isAllowed);
  }
};
