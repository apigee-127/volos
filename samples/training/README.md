Running the examples on Redis
=============================

Setup Redis
-----------
1. Install Redis (see: [http://redis.io]())
2. Start Redis:  

        redis-server

Cached Proxy
------------
1. Execute:

        npm run cache        

2. Try it:

        curl http://localhost:8012/test

3. Try it several times fast. Note some requests will be answered from the proxy's cache.
 
Quota on Proxy
--------------
1. Execute:

        npm run quota
        
2. Try it:

        curl http://localhost:8012/test
        
3. Try it several times. Note the proxy will only allow 2 requests per minute to each URL.

OAuth with Token Endpoints
--------------------------
1. Execute:

        npm run oauth-endpoints
        
2. Try some of the commands printed on the console.

3. Try this (it should fail):

        curl -H "Authorization: Bearer TOKEN" http://localhost:8012/protected        
 
4. Try replacing TOKEN with a token you've created. It should work now. 

OAuth-secured Proxy
-------------------  
1. Execute:

        npm run oauth
        
2. Try this (it should fail):

        curl -H "Authorization: Bearer TOKEN" http://localhost:8012/protected
         
3. Try replacing TOKEN with a token you created above. The proxy should forward the request now.


Running the examples on Apigee
==============================

Setup Apigee
------------
1. Create an Apigee Edge account and deploy the Volos proxy. 
2. Copy config/apigee-example.js to config/apigee.js
3. Put your correct configuration values into config/apigee.js.

Switch Examples to Apigee Provider
----------------------------------
1. Change the bottom section of config/volos.js to replace "default: redis" with "default: apigee" like so: 
        
        module.exports = {
          memory: memory,
          redis: redis,
          apigee: apigee,
          default: apigee
        };
    

Try it
------
Try the same tests as described for Redis above.


Continuing Education
====================

1. Try tweaking the examples
2. Try putting cache, quota, or oauth authentication on a specific endpoint
3. Try combining cache, quota, and oauth on endpoints
