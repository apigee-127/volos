# volos-analytics-apigee

This is an implementation of API Analytics for the Volos family of modules. It streams analytics gathered from
servicing API requests to the Apigee remote proxy (see below).

Once initialized, the interface to the module is exactly what is in the "volos-analytics-common" module. See
that module for detailed docs.

## Installing the Remote Proxy

This module depends on an "remote proxy," which is a special API that is deployed to Apigee for your specific
organization in the Apigee cloud. This proxy is hosted in a GitHub repo here: 
[https://github.com/apigee-127/apigee-remote-proxy](). Instructions for deployment are provided in the project's README. 


## Initialization

To initialize analytics, you call "create" on the exported module and pass a single "options" object.
It can contain the following parameters:

* bufferSize: (optional, default: 10000) The maximum number of records the buffer can hold before beginning to drop 
      the oldest records. 
* batchSize: (optional, default: 500) The maximum size of a batch of records sent to Apigee.
* flushInterval: (optional, default: 5000) Number of ms between each flush of a batch of records to Apigee.

* uri: (required) The full URI of the Apigee Remote Proxy that you deployed. For instance, if the organization name is 
      "foo" then this might be "https://foo-test.apigee.net/remote-proxy".
* key: (required) An API consumer key for a valid "application" that is part of the same organization where the adapter
      was installed.
* proxy: (required) The name of the proxy to assign the analytics records to. 

* finalizeRecord: (optional) A function that is called prior to adding an analytics record. This allows an analytics
      client final edit over what is included in the record. This function must accept the following parameters:
      (request, response, record, callback) - where callback is a function that takes the parameters: (error, record) 
      and must be called with the final record to include. (See example.)

Once the analytics has been initialized, the module that is returned has the programming interface defined
by the "volos-analytics-common" module.

## Example

    var options = {
      bufferSize: 60000,
      batchSize: 500,
      flushInterval: 5000,
      uri: 'http://some-test.apigee.net/remote-proxy',
      key: '42ec99c1f569bf386d4b1195e1de81f00ba2c22d054735123843a41',
      proxy: 'my proxy'
    }

    // as a (silly) example, we're reassigning the apiproxy field (was defaulted to "proxy" field from options)
    options.finalizeRecord = function finalizeRecord(req, res, record, cb) {
      record.apiproxy = 'other proxy';
      cb(null, record);
    };

    var analytics = require('volos-analytics-apigee').create(options);
    app.use(analytics.expressMiddleWare().apply());
    