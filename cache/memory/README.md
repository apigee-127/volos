# volos-cache-memory

This is a memory-backed implementation of cache support for Volos.

Once initialized, the interface to the module is exactly what is in the "volos-cache-common" module. See
that module for detailed docs.

## Initialization

To get a cache, you call "create" on the exported module and pass a name and "options" hash.
The options can contain the following parameters:

 ttl:        the default ttl (in ms) to use for cached values (optional, default: 300ms)
 encoding:   the default string encoding to use for cached values (optional, default: none)
 maxEntries: the maximum number of entries maintained before dropping the least recent entries (optional, default: 1000)

Note: The cache name represents a namespace. A created cache will share values (but not necessary options)
with other volos-cache-memory caches on this node you create using the same name.
