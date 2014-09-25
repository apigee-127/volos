# volos-quota-memory

This is a memory-backed implementation of Spike Arrest support for Volos.

Once initialized, the interface to the module is exactly what is in the "volos-spikearrest-common" module. See
that module for detailed docs.

## Initialization

To initialize a SpikeArrest, you call "create" on the exported module and pass a single "options" object.
It can contain the following parameters:

* timeUnit: How often the SpikeArrest resets - may be in seconds or minutes
* allow: The maximum number of requests to allow during the timeUnit.
* bufferSize: (optional, default = 0) if bufferSize > 0, SpikeArrest will attempt to smooth requests by returning only
  when the next appropriate execution window is available.  bufferSize is how many requests to "queue" before returning
  (immediately) with a isAllowed = false.

Once the quota has been initialized, the module that is returned has the programming interface defined
by the "volos-quota-common" module.

## Example

    var SpikeArrest = require('volos-spikearrest-memory');
    var spikeArrest = SpikeArrest.create({
      timeUnit: 'second',
      allow: 10,
      bufferSize: 10
    });

    spikeArrest.apply({ key: 'Foo', weight: 1 }, function(err, result) {
      if (err) { throw err; }
      console.log('Status: %s', result.isAllowed);
    });
