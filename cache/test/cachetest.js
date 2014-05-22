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
var should = require('should');
var _ = require('underscore');

var CACHE_NAME = 'TestCache';

exports.testCache = function(config, Spi) {

  this.config = config;
  this.Spi = Spi;

  describe('String Cache', function() {
    var tc;

    before(function() {
      tc = Spi.create(CACHE_NAME);
      tc.setEncoding('utf8');
    });

    it('Empty cache', function(done) {
      tc.get('nope', function(err, val) {
        should.not.exist(err);
        should.not.exist(val);
        done();
      });
    });

    it('One element', function(done) {
      var ts = 'TestString1';
      tc.set('1', ts, function(err) {
        should.not.exist(err);
        tc.get('1', function(err, val) {
          should.not.exist(err);
          val.should.eql(ts);
          done();
        });
      });
    });

    it('Buffer', function(done) {
      var tb = 'TestString2';
      tc.set('1b', new Buffer(tb, 'utf8'), function(err) {
        should.not.exist(err);
        tc.get('1b', function(err, val) {
          should.not.exist(err);
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
        should.not.exist(err);
        tc.set('1r', tf, function(err) {
          should.not.exist(err);
          tc.get('1r', function(err, val) {
            should.not.exist(err);
            val.should.eql(tf);
            done();
          });
        });
      });
    });

    it('Delete', function(done) {
      var ts = 'TestDelete';
      tc.set('delete', ts, function(err) {
        should.not.exist(err);
        tc.get('delete', function(err, val) {
          should.not.exist(err);
          val.should.eql(ts);
          tc.delete('delete', function(err) {
            should.not.exist(err);
            tc.get('delete', function(err, val) {
              should.not.exist(err);
              should.not.exist(val);
              done();
            });
          });
        });
      });
    });

    it('Default Expiration', function(done) {
      var ts = 'TestString2';
      tc.set('2', ts, function(err) {
        should.not.exist(err);
        // Value should be gone from the cache 500 ms after insert (default is 300)
        setTimeout(function() {
          tc.get('2', function(err, val) {
            should.not.exist(err);
            should.not.exist(val);
            done();
          });
        }, 1500);
      });
    });

    it('Explicit Expiration', function(done) {
      var ts = 'TestString2';
      tc.set('2', ts, { ttl: 1000 }, function(err) {
        should.not.exist(err);
        // Value should still be in the cache 500 ms after insert
        setTimeout(function() {
          tc.get('2', function(err, val) {
            should.not.exist(err);
            val.should.eql(ts);
            // Value should have been removed because of ttl
            setTimeout(function() {
              tc.get('2', function(err, val) {
                should.not.exist(err);
                should.not.exist(val);
                done();
              });
            }, 500);
          });
        }, 501);
      });
    });

    it('Set Default Expiration', function(done) {
      var xc = Spi.create('xxx', { ttl: 1000, encoding: 'utf8'});
      var ts = 'TestString2';
      xc.set('2', ts, { ttl: 1000 }, function(err) {
        should.not.exist(err);
        // Value should still be in the cache 500 ms after insert
        setTimeout(function() {
          xc.get('2', function(err, val) {
            should.not.exist(err);
            val.should.eql(ts);
            // Value should have been removed because of ttl
            setTimeout(function() {
              xc.get('2', function(err, val) {
                should.not.exist(err);
                should.not.exist(val);
                done();
              });
            }, 500);
          });
        }, 501);
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
    it('Binary', function(done) {
      var tc = Spi.create(CACHE_NAME);
      var ts = new Buffer('TestString1');
      tc.set('B1', ts, function(err) {
        should.not.exist(err);
        tc.get('B1', function(err, val) {
          should.not.exist(err);
          assert.deepEqual(val, ts);
          done();
        });
      });
    });

    it('base64', function(done) {
      var tc = Spi.create(CACHE_NAME);
      tc.setEncoding('base64');
      var tb = new Buffer('TestInBase64Yay').toString('base64');
      tc.set('b641', tb, { encoding: 'base64' }, function(err) {
        should.not.exist(err);
        tc.get('b641', function(err, val) {
          should.not.exist(err);
          val.should.eql(tb);
          done();
        });
      });
    });
  });

  describe('Multiple Caches', function() {
    var tc1;
    var tc2;

    before(function() {
      tc1 = Spi.create(CACHE_NAME);
      tc1.setEncoding('utf8');
      tc2 = Spi.create(CACHE_NAME);
    });

    it('Two Buffers', function(done) {
      var tb = new Buffer('TestTwo1');
      tc1.set('21', tb, function(err) {
        should.not.exist(err);
        tc2.get('21', function(err, val) {
          should.not.exist(err);
          assert.deepEqual(val, tb);
          done();
        });
      });
    });

    it('Two Buffers Other Way', function(done) {
      var tc = 'TestTwo2';
      tc2.set('22', tc, { encoding: 'utf8'}, function(err) {
        should.not.exist(err);
        tc1.get('22', function(err, val) {
          should.not.exist(err);
          val.should.eql(tc);
          done();
        });
      });
    });
  });

  it('tames the thundering herd', function(done) {

    var tc = Spi.create(CACHE_NAME);
    tc.setEncoding('utf8');

    var populateCalled = 0;
    var populate = function(key, cb) {
      populateCalled++;
      cb(null, 'test ' + key);
    };

    var keys = ['1', '2', '1', '3', '1'];
    var expectedResults = _.map(keys, function(v) { return  'test ' + v; });
    var uniqKeys = _.uniq(keys).length;
    var replies = 0;

    var callback = function(err, reply) {
      should.not.exist(err);
      replies++;
      should(delete(expectedResults[_.indexOf(expectedResults, reply)])).ok;

      if (replies === keys.length) {

        // populate called once per key
        uniqKeys.should.equal(populateCalled);

        // all results accounted for (in any order)
        _.compact(expectedResults).length.should.equal(0);

        done();
      }
    };

    for (var i = 0; i < keys.length; i++) {
      tc.getSet(keys[i], populate, callback);
    }
  });
};
