var quotaModule = require('volos-quota-memory');
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
