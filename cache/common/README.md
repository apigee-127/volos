# volos-quota-common

This module adds support for caching to any API.

## Modules

This module does not do anything on its own -- it depends on an implementation which stores the cache in a particular
place. Current implementations are:

* volos-cache-memory: Stores the cache in memory on the node where the script is running.
* volos-cache-redis: Stores the cache in redis.

## Example

    var cm = require('volos-cache-memory');
    var cache = cm.getCache('name');
    cache.set('key', 'value', { ttl: 1000 });
    cache.get('key', callback);

## Reference

### Class: Cache

### Cache.set(key, value, options, callback)

Sets a value into the cache.

* key (required): A String that identifies the key within the cache.
* value (required): A String or Buffer that is the value within the cache. If "value" is a string, then it will be
converted to a Buffer using the encoding field set in "options" or "utf8" otherwise.
* options (optional): May include a 'ttl' value that is the time for the value to live in the cache (in milliseconds)
* callback (optional): If specified, the result of the call is returned via callback. If there was an error, then the
first parameter will be an Error object.

### Cache.get(key, callback)

Gets a value from the cache.

* key (required): A string that identifies the key within the cache.
* callback (required): If specified, the result of the call is returned via callback. If there was an error, then the
first parameter will be an Error object. Otherwise, the first parameter will be undefined and the second will be
the value stored at the passed key.

### Cache.delete(delete, callback)

Deletes a value from the cache.

* key (required): A string that identifies the key within the cache.
* callback (optional): If specified, the result of the call is returned via callback. If there was an error, then the
first parameter will be an Error object.

### Cache.clear(callback)

Clears all values from the cache.

* callback (optional): If specified, the result of the call is returned via callback. If there was an error, then the
first parameter will be an Error object.

### Cache.setEncoding(encoding)

Set the text encoding for values retrieved from the cache. The value will be returned as a String
in the specified encoding. If this function is never called, then values will always be returned as Buffers.
