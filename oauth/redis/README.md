# volos-oauth-redis

This is an OAuth 2.0 implementation for the Volos family of modules that uses Redis as its source
of data. That is, information about valid application IDs and secrets, and the access tokens themselves,
are stored in Redis.

This module actually exports the same programming interface as "volos-oauth-common" -- see that module
for detailed documentation.

## Installing Redis

This module depends on having installed the Redis data store or having network access to such. All data
is stored in database 0 and uses a 'volos:' prefix for all keys. By default, it assumes Redis is local
and running using the default ports. Alternate configuration may be passed in - see options below.

Redis server:

<http://redis.io>

### oauth.create(options)

The module exports one function, called "create". It takes an argument called "options" with the following
parameters:

* host: The host name or IP address of the Redis server.
* port: The port number the Redis server is configured to use for client requests.
* db:   Redis [DB](http://redis.io/commands/SELECT) to use - defaults to `0`.
* options: A hash of Redis options (see [this](https://github.com/mranney/node_redis#rediscreateclientport-host-options) for list).

The result of this call will be an "OAuth" object, which may be used according to the interface defined
by the "volos-oauth-common" module.
