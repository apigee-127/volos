var assert = require('assert');
var spi = require('..');

describe('Expiration time test', function() {
  it('Minute rolling', function() {
    var q = new spi({
      timeInterval: 60000,
      allow: 5
    });

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
    var q = new spi({
      timeInterval: 60000,
      allow: 5,
      startTime: new Date('March 7, 2013 12:00:00').getTime()
    });

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

  it('Hour calendar', function() {
    var q = new spi({
      timeInterval: 60000 * 60,
      allow: 5,
      startTime: new Date('March 7, 2013 12:00:00').getTime()
    });

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
    var q = new spi({
      timeInterval: 60000 * 60 * 24,
      allow: 5,
      startTime: new Date('March 7, 2013 12:00:00').getTime()
    });

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