# volos-cache-common

This module adds support for caching to any API.

## Modules

This module does not do anything on its own -- it depends on an implementation which stores the cache in a particular
place. Current implementations are:

* volos-cache-memory: Stores the cache in memory on the node where the script is running.
* volos-cache-redis: Stores the cache in redis.

## Example

    var cm = require('volos-cache-memory');
    var cache = cm.create('name', { ttl: 1000 }); // specifies default ttl as 1000 ms
    cache.set('key', 'value');
    cache.get('key', callback);

Note: Avoid creating multiple caches with the same name, the results are not defined by the interface and
may vary by implementation.

## Reference

### Class: Cache

#### Cache.set(key, value, options, callback)

Sets a value into the cache.

* key (required): A String that identifies the key within the cache.
* value (required): A String or Buffer that is the value within the cache. If "value" is a string, then it will be
converted to a Buffer using the encoding field set in "options" or "utf8" otherwise.
* options (optional): May include a 'ttl' value that is the time for the value to live in the cache (in milliseconds)
* callback (optional): If specified, the result of the call is returned via callback. If there was an error, then the
first parameter will be an Error object.

#### Cache.get(key, callback)

Gets a value from the cache.

* key (required): A string that identifies the key within the cache.
* callback (required): If specified, the result of the call is returned via callback. If there was an error, then the
first parameter will be an Error object. Otherwise, the first parameter will be undefined and the second will be
the value stored at the passed key.

#### Cache.delete(delete, callback)

Deletes a value from the cache.

* key (required): A string that identifies the key within the cache.
* callback (optional): If specified, the result of the call is returned via callback. If there was an error, then the
first parameter will be an Error object.

#### Cache.clear(callback)

Clears all values from the cache.

* callback (optional): If specified, the result of the call is returned via callback. If there was an error, then the
first parameter will be an Error object.

#### Cache.setEncoding(encoding)

Set the text encoding for values retrieved from the cache. The value will be returned as a String
in the specified encoding. If this function is never called, then values will always be returned as Buffers.

### Middleware

#### Middleware.cache(id)

Caches "GET" requests and their headers.

Parameters:

* options is a hash
    * options.key: (optional) may be a string or a function that takes the request and generates a string key.
        If not specified, key will be set to the request originalUrl.
        If a function and the function returns null or undefined, request will not be cached.
    * options.id (optional) may be a string or a function that takes the request and generates a string id.
        If not specified, id will be set to the request url.


#### Middleware usage examples: 


##### Cache.connectMiddleware()

Returns middleware that may be used in a Connect server.

```
  server
    .use(cache.connectMiddleware().cache())
    .get('/',
      function(req, resp) {
        ...
```
 
##### Cache.expressMiddleware()

Returns middleware that may be used in a Express server. 

```
  server
    .use(cache.expressMiddleware().cache())
    .get('/',
      function(req, resp) {
        ...
```

##### Cache.argoMiddleware()

Returns middleware that may be used in an Argo server. 

```
  server
    .use(cache.argoMiddleware().cache())
    .get('/',
      function(handle) {
        handle('request', function(env, next) {
          ...
```
