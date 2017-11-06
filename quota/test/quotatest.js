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
var random = Math.random();
var _ = require('underscore');
var should = require('should');

// clone & extend hash
function extend(a, b) {
  return _.extend({}, a, b);
}

// avoid run to run conflicts
function id(_id) {
  return 'test:' + random + ":" + _id;
}

exports.testQuota = function(config, Spi) {

  this.config = config;
  this.Spi = Spi;

  describe('Quota', function() {
    var pm;

    before(function() {
      var options = extend(config, {
        timeUnit: 'minute',
        interval: 1,
        allow: 2
      });
      pm = Spi.create(options);
    });

    describe('options', function() {

      it('invalid timeUnit', function(done) {
        var options = extend(config, {
          timeUnit: 'seconds'
        });
        assert.throws(function() {
          Spi.create(options)
        });
        done();
      });

      it('interval must be a number', function(done) {
        var options = extend(config, {
          timeUnit: 'minute',
          interval: 'hey',
          allow: 2
        });
        assert.throws(function() {
          Spi.create(options)
        });
        done();
      });

      it('allow must be a number', function(done) {
        var options = extend(config, {
          timeUnit: 'minute',
          interval: 1,
          allow: 'hey'
        });
        assert.throws(function() {
          Spi.create(options)
        });
        done();
      });

      it('if a string, startTime must be a valid date', function(done) {
        var options = extend(config, {
          timeUnit: 'minute',
          interval: 1,
          allow: 2,
          startTime: 'xxx'
        });
        assert.throws(function() {
          Spi.create(options)
        });

        options.startTime = new Date();
        should.ok(Spi.create(options));
        done();
      });

      it('apply options must have an identifier', function(done) {
        pm.apply({
          weight: 1
        }, function(err) {
          should.exist(err);
          done();
        });
      });

      it('apply options must have a string identifier', function(done) {
        pm.apply({
          identifier: 1,
          weight: 1
        }, function(err) {
          should.exist(err);
          done();
        });
      });
    });

    it('Basic per-minute', function(done) {
      pm.apply({
        identifier: id('One'),
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);
        result.expiryTime.should.be.approximately(60000, 20);

        pm.apply({
          identifier: id('Two'),
          weight: 1
        }, function(err, result) {
          assert(!err);
          checkResult(result, 2, 1, true);

          pm.apply({
            identifier: id('One'),
            weight: 1
          }, function(err, result) {
            assert(!err);
            checkResult(result, 2, 2, true);

            pm.apply({
              identifier: id('One'),
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
        identifier: id('WeightOne'),
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);

        pm.apply({
          identifier: id('WeightOne'),
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
        identifier: id('DynOne'),
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);

        pm.apply({
          identifier: id('DynOne'),
          weight: 1,
          allow: 1
        }, function(err, result) {
          assert(!err);
          checkResult(result, 1, 2, false);
          done();
        });
      });
    });

    describe('Timeout', function() {

      if (process.env.ROLLING_TESTS) {
        console.log('Including rolling expiration test. This will take a couple minutes...');

        describe('Rolling', function() {

          it('Minute', function(done) {
            this.timeout(120000);
            var hit = { identifier: id('TimeOne'), weight: 1 };
            pm.apply(hit, function(err, result) {
              assert(!err);
              checkResult(result, 2, 1, true);
              result.expiryTime.should.be.approximately(60000, 20);

              setTimeout(function() {
                pm.apply(hit, function(err, result) {
                  assert(!err);
                  checkResult(result, 2, 2, true);
                  result.expiryTime.should.be.approximately(30000, 100);

                  // Ensure quota is reset within a minute
                  setTimeout(function() {
                    pm.apply(hit, function(err, result) {
                      assert(!err);
                      checkResult(result, 2, 1, true);
                      result.expiryTime.should.be.approximately(60000, 200);
                      done();
                    });
                  }, 30001);

                });
              }, 30001);
            });
          });

        });
      } else {
        console.log('Skipping longer rolling expiration test. To include, set env var ROLLING_TESTS=true.');
      }

      describe('Calendar', function() {

        it('Minute', function(done) {
          var startTime = Date.now() - 59750; // start almost a minute ago
          var options = extend(config, {
            timeUnit: 'minute',
            interval: 1,
            allow: 1,
            startTime: startTime
          });
          var pm = Spi.create(options);
          testBeforeAndAfter(id('cal_minute'), pm, done);
        });

          it('Minute, Interval: 2', function(done) {
              var startTime = Date.now() - (60000 * 2 - 250); // start almost 2 minutes ago
              var options = extend(config, {
                  timeUnit: 'minute',
                  interval: 2,
                  allow: 1,
                  startTime: startTime
              });
              var pm = Spi.create(options);
              testBeforeAndAfter(id('cal_minute_interval_2'), pm, done);
          });

          it('Hour', function(done) {
          var startTime = Date.now() - (60000 * 60 - 250); // start almost an hour ago
          var options = extend(config, {
            timeUnit: 'hour',
            interval: 1,
            allow: 1,
            startTime: startTime
          });
          var pm = Spi.create(options);
          testBeforeAndAfter(id('cal_hour'), pm, done);
        });

        it('Day', function(done) {
          var startTime = Date.now() - (60000 * 60 * 24 - 250); // start almost a day ago
          var options = extend(config, {
            timeUnit: 'day',
            interval: 1,
            allow: 1,
            startTime: startTime
          });
          var pm = Spi.create(options);
          testBeforeAndAfter(id('cal_day'), pm, done);
        });

        it('Week', function(done) {
          var startTime = Date.now() - (60000 * 60 * 24 * 7 - 250); // start almost a week ago
          var options = extend(config, {
            timeUnit: 'week',
            interval: 1,
            allow: 1,
            startTime: startTime
          });
          var pm = Spi.create(options);
          testBeforeAndAfter(id('cal_week'), pm, done);
        });

        it('Month', function(done) {
          var date = new Date();
          var startTime = new Date(date.getFullYear(), date.getMonth() + 1, 1) - 1; // start near end of this month
          var options = extend(config, {
            timeUnit: 'month',
            interval: 1,
            allow: 1,
            startTime: startTime
          });
          (function() { Spi.create(options); }).should.throw();
          delete(options.startTime);
          var pm = Spi.create(options);
          //testBeforeAndAfter(id('cal_month'), pm, done);
          done(); //todo:  I don't have a good way to actually test this right now
        });

        function testBeforeAndAfter(id, pm, cb) {

          var hit = { identifier: id, weight: 1 };
          pm.apply(hit, function(err, result) {
            assert(!err);
            checkResult(result, 1, 1, true);

            setTimeout(function() {
              pm.apply(hit, function(err, result) {
                assert(!err);
                checkResult(result, 1, 1, true);

                pm.apply(hit, function(err, result) {
                  assert(!err);
                  checkResult(result, 1, 2, false);

                  cb();
                });
              });
            }, 255);
          });
        }

      });
    });
  });

  function checkResult(result, allowed, used, isAllowed) {
    assert(result);
    assert.equal(result.allowed, allowed);
    assert.equal(result.used, used);
    assert.equal(result.isAllowed, isAllowed);
  }
};
