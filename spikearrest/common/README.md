# volos-spikearrest-common

This module adds support for Spike Arrest to any API.

A Spike Arrest protects against traffic spikes. It throttles the number of requests processed by an API 
and sent to a backend, protecting against performance lags and downtime. Think of Spike Arrest as a way to generally 
protect against traffic spikes rather than as a way to limit traffic to a specific number of requests. Your APIs 
and backend can handle a certain amount of traffic, and the Spike Arrest policy helps you smooth traffic to the 
general amounts you want.

To prevent spike-like behavior, Spike Arrest calculates the allowed traffic into windows by dividing your settings into 
appropriate intervals:

* Per-minute rates get smoothed into requests allowed intervals of seconds:

    For example, 30 per minute gets smoothed like this:
    60 seconds (1 minute) / 30pm = 2-second intervals, or about 1 request allowed every 2 seconds. A second request 
    inside of 2 seconds will fail if there is no buffer. Also, a 31st request within a minute will fail.

* Per-second rates get smoothed into requests allowed in intervals of milliseconds.

    For example, 10 per second gets smoothed like this:
    1000 milliseconds (1 second) / 10ps = 100-millisecond intervals, or about 1 request allowed every 100 milliseconds. 
    A second request inside of 100ms will fail if there is no buffer. Also, an 11th request within a second will fail.

If the Spike Arrest is set up with a buffer (bufferSize > 0), however, it will not fail immediately when too many
requests are made concurrently. Instead, SpikeArrest will attempt to smooth requests by returning success to the caller
once the next appropriate execution window is available. Once the buffer is full, it will fail all further requests
until a new execution window becomes available. 

Using a buffer can be a great way to continue to fulfill requests during an quick, odd spike. However, be aware that 
when requests exceed the SpikeArrest window, this will delay responses up to: bufferSize * (timeUnit / allow).
     
    For example, 10 per second with a buffer of 10 means requests caught in the queue could be delayed up to 1 second!     

You create a Spike Arrest object with the following attributes:

* timeUnit: How often the SpikeArrest resets - may be in seconds or minutes
* allow: The maximum number of requests to allow during the timeUnit.
* bufferSize: (optional, default = 0) if bufferSize > 0, SpikeArrest will attempt to smooth requests by returning only
  when the next appropriate execution window is available.  bufferSize is how many requests to "queue" before returning
  (immediately) with a isAllowed = false.

Once a Spike Arrest has been created, you "apply" the Spike Arrest by passing the following values:

* weight: (optional, default = 1) How much to add to the Spike Arrest -- in some advanced cases, API providers may 
  want to assign different weights to different API calls.
* key: (optional, default = '_default') Identifies the Spike Arrest bucket. This is a string that may be set to any value.
  Each key locates a single bucket, which maintains separate windows from other buckets.

## Modules

This module does not do anything on its own -- it depends on an implementation which stores the Spike Arrest in a 
particular place. Currently the options are:

* volos-spikearrest-memory: Stores Spike Arrest data in memory on the node where the script is running.

## Example

    var SpikeArrest = require('volos-spikearrest-memory');
    var spikeArrest = SpikeArrest.create({
      timeUnit: 'second',
      allow: 10,
      bufferSize: 10
    });

    spikeArrest.apply({ key: 'Foo', weight: 1 }, function(err, result) {
      if (err) { return cb(err); }
      console.log('Status: %s', result.isAllowed);
    });

## Reference

### Class: SpikeArrest

#### SpikeArrest.apply(options, callback)

Apply the SpikeArrest and invoke "callback" with a result. Options can have the following parameters:

* weight: (optional, default = 1) How much to add to the Spike Arrest -- in some advanced cases, API providers may 
  want to assign different weights to different API calls.
* key: (optional, default = '_default') Identifies the Spike Arrest bucket. This is a string that may be set to any value.
  Each key locates a single bucket, which maintains separate windows from other buckets.

The result of this call is delivered by calling "callback." If there was an error, then the first parameter
will be an Error object. Otherwise, the first parameter will be "undefined" and the second will be
an object that contains the following fields:

* allowed: (number) How much is allowed in the SpikeArrest bucket. Essentially the same as the "allow" parameter that is
passed to the "apply" method, or the default that came from the overall object.
* used: (number) How much of the SpikeArrest bucket is used up.
* isAllowed: (boolean) Whether the SpikeArrest bucket has been used up. Basically the same as checking whether
"used > allowed".
* expiryTime: (number) The number of milliseconds until the SpikeArrest bucket "used" amount is reset to zero.

### Middleware

#### Middleware.apply(options)

Applies SpikeArrest and returns (403) error on exceeded.

Options (optional) may contain:

* key (optional) may be a string or a function that takes the request and generates a string id.
* weight (optional) may be a number or a function that takes the request and generates a number


#### Middleware usage examples: 

##### SpikeArrest.connectMiddleware()

Returns middleware that may be used in a Connect server.

```
   server.get('/',
     spikeArrest.connectMiddleware().apply(),
     ...
```
 
##### SpikeArrest.expressMiddleware()

Returns middleware that may be used in a Express server. 

```
   server.get('/',
     spikeArrest.expressMiddleware().apply(),
     ...
```
