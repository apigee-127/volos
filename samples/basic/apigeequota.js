var quotaModule = require('volos-quota-apigee');
var quota = quotaModule.create({
  timeUnit: 'day',
  interval: 1,
  allow: 10,
  uri: process.env.APIGEEURI,
  key: process.env.APIGEEKEY
  });

quota.apply({ identifier: 'Foo', weight: 1 }, function(err, result) {
  if (err) {
    throw err;
  } else {
    console.log('Quota status: %s', result.isAllowed);
  }
 });
