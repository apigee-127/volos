/*
 * This little server runs the "expressserver.js" from the cache test suite
 * using Apigee middleware.
 */

 var apigeeCache = require('volos-cache-apigee');
 var server = require('./volos/cache/test/expressserver');

 // Construct a Volos cache
 var cache = apigeeCache.create('Cache Test', {
   ttl: 50
 });

 // Build an Express server using the code from the cache module
 var app = server(cache);

 app.listen(process.env.PORT || 9001);
