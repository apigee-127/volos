var assert = require('assert');
var cache = require('..');

var CacheName = 'TestCache';

describe('String Cache', function() {
  this.timeout(10000);
  var tc;

  before(function() {
    tc = cache.getCache(CacheName);
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

  it('Expiration', function(done) {
    var ts = 'TestString2';
    tc.set('2', ts, { ttl: 2 }, function(err) {
      assert.equal(err, undefined);
      // Value should still be in the cache right after insert
      tc.get('2', function(err, val) {
        assert.equal(err, undefined);
        assert.equal(val, ts);
        // Value should have been removed three seconds after the insert because of 2-second ttl
        var timeout = setTimeout(function() {
          tc.get('2', function(err, val) {
            assert.equal(err, undefined);
            assert.equal(val, undefined);
            done();
          });
        }, 3000);
      });
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
  this.timeout(10000);
  var tc;

  it('Binary', function(done) {
    var tc = cache.getCache(CacheName);
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
    var tc = cache.getCache(CacheName);
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
  this.timeout(10000);
  var tc1;
  var tc2;

  before(function() {
    tc1 = cache.getCache(CacheName);
    tc1.setEncoding('utf8');
    tc2 = cache.getCache(CacheName);
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