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

// clone & extend hash
var _extend = require('util')._extend;
function extend(a, b) {
  var options = _extend({}, a);
  options = _extend(options, b);
  return options;
}

// avoid run to run conflicts
function id(id) {
  return 'test:' + random + ":" + id;
}

exports.testQuota = function(config, Spi) {

  this.config = config;
  this.Spi = Spi;

  describe('Quota SPI', function() {
    var pm;
    var ph;

    before(function() {
      var options = extend(config, {
        timeUnit: 'minute',
        interval: 1,
        allow: 2
      });
      pm = Spi.create(options);
    });

    it('Basic per-minute', function(done) {
      pm.apply({
        identifier: id('One'),
        weight: 1
      }, function(err, result) {
        assert(!err);
        checkResult(result, 2, 1, true);

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
                  }, 60001);

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
          this.timeout(2000);
          var startTime = Date.now() - 59750; // start almost a minute ago
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

            setTimeout(function() {
              pm.apply(hit, function(err, result) {
                assert(!err);
                checkResult(result, 1, 1, true);

                pm.apply(hit, function(err, result) {
                  assert(!err);
                  checkResult(result, 1, 2, false);

                  done();
                });
              });
            }, 251);
          });
        });

        it('Hour', function(done) {
          this.timeout(2000);
          var startTime = Date.now() - (60000 * 60 - 250); // start almost an hour ago
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

            setTimeout(function() {
              pm.apply(hit, function(err, result) {
                assert(!err);
                checkResult(result, 1, 1, true);

                pm.apply(hit, function(err, result) {
                  assert(!err);
                  checkResult(result, 1, 2, false);

                  done();
                });
              });
            }, 251);
          });
        });

        it('Day', function(done) {
          this.timeout(2000);
          var startTime = Date.now() - (60000 * 60 * 24 - 250); // start almost a day ago
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

            setTimeout(function() {
              pm.apply(hit, function(err, result) {
                assert(!err);
                checkResult(result, 1, 1, true);

                pm.apply(hit, function(err, result) {
                  assert(!err);
                  checkResult(result, 1, 2, false);

                  done();
                });
              });
            }, 251);
          });
        });

        it('Week', function(done) {
          this.timeout(2000);
          var startTime = Date.now() - (60000 * 60 * 24 * 7 - 250); // start almost a week ago
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

            setTimeout(function() {
              pm.apply(hit, function(err, result) {
                assert(!err);
                checkResult(result, 1, 1, true);

                pm.apply(hit, function(err, result) {
                  assert(!err);
                  checkResult(result, 1, 2, false);

                  done();
                });
              });
            }, 251);
          });
        });

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
