/*
 * This little server runs the "expressserver" from the Quota tests using
 * the Apigee SPI.
 */

var _ = require('underscore');

var apigeeQuota = require('volos-quota-apigee');
var config = require('./volos/testconfig/testconfig-apigee');
var server = require('./volos/quota/test/expressserver');

// Make doubly sure that we are using apigee-access only
delete config.config.uri;
delete config.config.key;

var opts = {
  timeUnit: 'minute',
  interval: 1,
  allow: 2
};
_.extend(opts, config.config);

var quota = apigeeQuota.create(opts);

// Build an Express server using the code from the cache module
var app = server(quota);

app.listen(process.env.PORT || 9002);
