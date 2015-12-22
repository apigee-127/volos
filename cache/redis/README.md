# volos-cache-redis

This is a redis-backed implementation of cache support for Volos.

Once initialized, the interface to the module is exactly what is in the "volos-cache-common" module. See
that module for detailed docs.

## Initialization

To get a cache, you call "create" on the exported module and pass a name and "options" hash.
The options can contain the following parameters:

* ttl:      the default ttl (in ms) to use for cached values (otherwise, 300ms)
* encoding: the default string encoding to use for cached values (optional)
* host:     redis host (optional, default = 127.0.0.1)
* port:     redis port (optional, default = 6379)
* db:       redis [DB](http://redis.io/commands/SELECT) to use - defaults to `0`.
* options:  redis options (hash, optional) - note: return_buffers will be forced to true

Note: The cache name represents a namespace. A created cache will share values (but not necessary options)
with other volos-cache-redis caches on this node you create using the same name.
