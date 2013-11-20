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
"use strict";

var assert = require('assert');
var CACHE_NAME = 'TestCache';

exports.testCache = function(config, Spi) {

  this.config = config;
  this.Spi = Spi;

  describe('String Cache', function() {
    var tc;

    before(function() {
      tc = Spi.getCache(CACHE_NAME);
      tc.setEncoding('utf8');
    });

    it('Empty cache', function(done) {
      tc.get('nope', function(err, val) {
        assert.equal(err, undefined);
        assert.equal(val, undefined);
        done();
      });
    });

    it('One element', function(done) {
      var ts = 'TestString1';
      tc.set('1', ts, function(err) {
        assert.equal(err, undefined);
        tc.get('1', function(err, val) {
          assert.equal(err, undefined);
          assert.equal(val, ts);
          done();
        });
      });
    });

    it('Buffer', function(done) {
      var tb = 'TestString2';
      tc.set('1b', new Buffer(tb, 'utf8'), function(err) {
        assert.equal(err, undefined);
        tc.get('1b', function(err, val) {
          assert.equal(err, undefined);
          assert.equal(val, tb);
          done();
        });
      });
    });

    it('Blind Set', function() {
      tc.set('1c', 'Newdata');
    });

    it('Replace key', function(done) {
      var tf = 'Final Value';
      tc.set('1r', 'Initial value', function(err) {
        assert.equal(err, undefined);
        tc.set('1r', tf, function(err) {
          assert.equal(err, undefined);
          tc.get('1r', function(err, val) {
            assert.equal(err, undefined);
            assert.equal(val, tf);
            done();
          });
        });
      });
    });

    it('Delete', function(done) {
      var ts = 'TestDelete';
      tc.set('delete', ts, function(err) {
        assert.equal(err, undefined);
        tc.get('delete', function(err, val) {
          assert.equal(err, undefined);
          assert.equal(val, ts);
          tc.delete('delete', function(err) {
            assert.equal(err, undefined);
            tc.get('delete', function(err, val) {
              assert.equal(err, undefined);
              assert.equal(val, undefined);
              done();
            });
          });
        });
      });
    });

    it('Default Expiration', function(done) {
      this.timeout(2000);
      var ts = 'TestString2';
      tc.set('2', ts, function(err) {
        assert.equal(err, undefined);
        // Value should be gone from the cache 500 ms after insert (default is 300)
        var timeout = setTimeout(function() {
          tc.get('2', function(err, val) {
            assert.equal(err, undefined);
            assert.equal(val, undefined);
            done();
          });
        }, 500);
      });
    });

    it('Explicit Expiration', function(done) {
      this.timeout(2000);
      var ts = 'TestString2';
      tc.set('2', ts, { ttl: 1000 }, function(err) {
        assert.equal(err, undefined);
        // Value should still be in the cache 500 ms after insert
        var timeout = setTimeout(function() {
          tc.get('2', function(err, val) {
            assert.equal(err, undefined);
            assert.equal(val, ts);
            // Value should have been removed because of ttl
            var timeout = setTimeout(function() {
              tc.get('2', function(err, val) {
                assert.equal(err, undefined);
                assert.equal(val, undefined);
                done();
              });
            }, 500);
          });
        }, 500);
      });
    });

    it('Set Default Expiration', function(done) {
      this.timeout(2000);
      var xc = Spi.getCache('xxx', { ttl: 1000, encoding: 'utf8'});
      var ts = 'TestString2';
      xc.set('2', ts, { ttl: 1000 }, function(err) {
        assert.equal(err, undefined);
        // Value should still be in the cache 500 ms after insert
        var timeout = setTimeout(function() {
          xc.get('2', function(err, val) {
            assert.equal(err, undefined);
            assert.equal(val, ts);
            // Value should have been removed because of ttl
            var timeout = setTimeout(function() {
              xc.get('2', function(err, val) {
                assert.equal(err, undefined);
                assert.equal(val, undefined);
                done();
              });
            }, 500);
          });
        }, 500);
      });
    });

    it('Param checks', function() {
      assert.throws(function() {
        tc.set(1, 'one');
      });
      assert.throws(function() {
        tc.set('one', 1);
      });
      assert.throws(function() {
        tc.get(1, function(err, val) {});
      });
      assert.throws(function() {
        tc.get('one', 2);
      });
    });
  });

  describe('Cache encodings', function() {
    var tc;

    it('Binary', function(done) {
      var tc = Spi.getCache(CACHE_NAME);
      var ts = new Buffer('TestString1');
      tc.set('B1', ts, function(err) {
        assert.equal(err, undefined);
        tc.get('B1', function(err, val) {
          assert.equal(err, undefined);
          assert.deepEqual(val, ts);
          done();
        });
      });
    });

    it('base64', function(done) {
      var tc = Spi.getCache(CACHE_NAME);
      tc.setEncoding('base64');
      var tb = new Buffer('TestInBase64Yay').toString('base64');
      tc.set('b641', tb, { encoding: 'base64' }, function(err) {
        assert.equal(err, undefined);
        tc.get('b641', function(err, val) {
          assert.equal(err, undefined);
          assert.equal(tb, val);
          done();
        });
      });
    });
  });

  describe('Multiple Caches', function() {
    var tc1;
    var tc2;

    before(function() {
      tc1 = Spi.getCache(CACHE_NAME);
      tc1.setEncoding('utf8');
      tc2 = Spi.getCache(CACHE_NAME);
    });

    it('Two Buffers', function(done) {
      var tb = new Buffer('TestTwo1');
      tc1.set('21', tb, function(err) {
        assert.equal(err, undefined);
        tc2.get('21', function(err, val) {
          assert.equal(err, undefined);
          assert.deepEqual(val, tb);
          done();
        });
      });
    });

    it('Two Buffers Other Way', function(done) {
      var tc = 'TestTwo2';
      tc2.set('22', tc, { encoding: 'utf8'}, function(err) {
        assert.equal(err, undefined);
        tc1.get('22', function(err, val) {
          assert.equal(err, undefined);
          assert.equal(val, tc);
          done();
        });
      });
    });
  });
}