# volos-quota-redis

This is a Redis-backed implementation of quota support for Volos.

Once initialized, the interface to the module is exactly what is in the "volos-quota-common" module. See
that module for detailed docs.

## Initialization

To initialize a quota, you call "create" on the exported module and pass a single "options" object.
It can contain the following parameters:

* `timeUnit`: How often the quota resets -- may be minute, hour, day, week, or month
* `interval`: Works with the timeUnit to determine how often the quota resets. For instance, every 5 days or 2 weeks.
* `startTime`: A time at which the quota calculations should begin. For instance, if there is no start time then a
quota set to reset in "one day" will reset 24 hours after the first message is receiver, but if the start time
is set to the top of the hour on some day, then the quota will always reset at the top of the hour. Start time
is not allowed for "month" timeUnit as it always uses Gregorian month boundaries.
* `allow`: The maximum number of requests to allow. This may be overridden on each "apply" call if desired.
* `host`: Host where your Redis instance is running - defaults to `127.0.0.1`
* `port`: Port of the Redis instance - defaults to `6379`.
* `db`: Redis [DB](http://redis.io/commands/SELECT) to use - defaults to `0`.


Once the quota has been initialized, the module that is returned has the programming interface defined
by the "volos-quota-common" module.

## Example

```javascript
var quotaModule = require('volos-quota-redis');
var quota = quotaModule.create({
  timeUnit: 'day',
  interval: 1,
  allow: 10
  });

quota.apply({ identifier: 'Foo', weight: 1 }, function(err, result) {
  if (err) {
    throw err;
  } else {
    console.log('Quota status: %s', result.isAllowed);
  }
});
```