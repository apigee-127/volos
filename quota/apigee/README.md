# volos-quota-apigee

This is an implementation of API quotas for the Volos family of modules. It uses Apigee as a backing store
to keep quotas synchronized across many nodes. Furthermore, this is the correct module to use if
deploying the Node.js application to Apigee, because it will result in quotas that work in the same way
as the quotas that are built in to the Apigee platform.

Once initialized, the interface to the module is exactly what is in the "volos-quota-common" module. See
that module for detailed docs.

## Installing the Adapter

This module depends on an "adapter," which is a special API that is deployed to Apigee for your specific
organization in the Apigee cloud. This proxy is hosted in the Volos GitHub repo, which is here:

[https://github.com/apigee/volos](https://github.com/apigee/volos)

The proxy is inside the "proxy" directory. Instructions for deploying it may be found here:

[https://github.com/apigee/volos/blob/master/samples/basic/README.md](https://github.com/apigee/volos/blob/master/samples/basic/README.md)

## Initialization

To initialize a quota, you call "create" on the exported module and pass a single "options" object.
It can contain the following parameters:

* timeUnit: How often the quota resets -- may be minute, hour, day, week, or month
* interval: Works with the timeUnit to determine how often the quota resets. For instance, every 5 days or 2 weeks.
* startTime: A time at which the quota calculations should begin. For instance, if there is no start time then a
quota set to reset in "one day" will reset 24 hours after the first message is receiver, but if the start time
is set to the top of the hour on some day, then the quota will always reset at the top of the hour. Start time
is not allowed for "month" timeUnit as it always uses Gregorian month boundaries.
* allow: The maximum number of requests to allow. This may be overridden on each "apply" call if desired.
* uri: The full URI of the Apigee adapter that you deployed in the last step. For instance, if the organization
name is "foo" then this might be "https://foo-test.apigee.net/apigee-remote-proxy". This parameter is
not used when the app is always deployed to Apigee Edge, or when "apigeeMode" is set to "local".
See below for more.
* key: An API consumer key for a valid "application" that is part of the same organization where the adapter
was installed.
* bufferSize: (Number) optional, create a local memory buffer to hold up to bufferSize for quota elements
* bufferTimeout: (Number) optional, flush the memory buffer (if exists) every Number ms (default: 300)

Once the quota has been initialized, the module that is returned has the programming interface defined
by the "volos-quota-common" module.

The following parameters are optional:

* apigeeMode (optional): By default, this module will use the OAuth service built in to Apigee Edge when it
is deployed there, and use an HTTP-based API to the "uri" specified above when it is not. This parameter
overrides that default.

"apigeeMode" supports two values:

* remote: When set to "remote," this module will use the "uri" specified in the options to communicate
with Apigee Edge, even if it is deployed to Apigee Edge. This allows you to use the OAuth services of
another organization, for instance.
* local: When set to "local," this module wil use the "apigee-access" module to access Apigee Edge
functionality that is built in to the runtime. If this is set and the module is running outside
Apigee Edge, then all calls will fail.

By default, the module will use Apigee Edge functionality when available, and fall back to API
calls when it is not.

## Example

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
