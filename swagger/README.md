# volos-swagger

This module adds support for driving Volos middleware functions entirely though configuration and the Apigee 127
 [Swagger Tools](https://www.npmjs.org/package/swagger-tools) swagger-metadata middleware.

All Volos modules including Cache, Quota, and OAuth may be configured and tied to Swagger operations using
 configuration similar to the code that you would use to programmatically drive the Volos middleware. 

Once you have set up your swagger-tools middleware as documented [here](https://github.com/apigee-127/swagger-tools)
(note: only the swagger-metadata middleware is necessary), just set up your configuration (see below) and simply add 
the Volos Swagger Middleware into your connect middleware chain after swagger-metadata.  
    
    var VolosSwagger = require('volos-swagger');
    var swaggerMiddleware = SwaggerMetadata(configuration); 
    app.use(swaggerMiddleware);

## Configuration

The Volos Swagger Configuration is a Javascript Object with 3 keys:
 
 * resources
 * global
 * operations
 
The following sections discuss the format using this [example](test/support/volos.json) json file.  

Important: Be sure to include any referenced Volos modules in your package.json!   

### Resources

The resources section defines how the modules that will be referenced in the other sections of this file (and the 
Swagger definition) will be instantiated and configured. The basic idea is that you simply define the array of 
parameters that would have been passed in to create the Volos module had you done it programmatically.
 
For example, [volos-cache-memory](../cache/memory/README.md) requires a name and a hash of options. If we want to create
and use a cache named "memCache" that has a time-to-live (ttl) of 1000ms, we'd do so like this: 

    {
      "resources": {
        "cache": {
          "provider": "volos-cache-memory",
          "options": [
            "memCache",
            {
              "ttl": 1000
            }
          ]
        },

Note: The key is "cache" for the definition. This is the name that will be used later to refer to this resource, not
"memCache".

Similarly, we create a [volos-quota-memory](../quota/memory/README.md) ("quota") and 
[volos-oauth-redis](../oauth/redis/README.md) ("oauth2") reference in this example: 

        "quota": {
          "provider": "volos-quota-memory",
          "options": [
            {
              "timeUnit": "minute",
              "interval": 1,
              "allow": 2
            }
          ]
        },
        "oauth2": {
          "provider": "volos-oauth-redis",
          "options": [
            {
              "encryptionKey": "This is the key to encrypt/decrypt stored credentials"
            }
          ]
        }
      },

Note: Unlike Cache and Quota, we will not reference the OAuth definition later in this file. Swagger 1.2 has direct 
support for declaring OAuth 2.0 authorizations, so we can rely on those annotations directly. On the other hand,
Swagger 1.2 doesn't support Cache or Quota, so we will have to map these to Swagger operations as described in the
Operations section below.
      
### Globals

The global section is where you would specify any of the Volos middleware you wish to apply across all your paths. For
example, if we wish to apply a quota and cache globally (as unlikely as that seems), we would list them in this section 
like so: 
      
      "global": [
        {
          "quota": [
            {
              "identifier": "*",
              "weight": 1
            }
          ]
        },
        {
          "cache": null
        }
      ],

Note that the Quota is being applied using a static identifier: "*". Thus, this would allow only 2 calls per minute
across all endpoints. (Probably not very useful.) Had we not specified an identifier, it would have used the request URI 
as the key for the quota.

'"cache": null' just means that we aren't passing any parameters in (and are thus using defaults) - so in this case,
 the cache will use the request URI as the cache key.

### Operations

The operations section is where you would specify any of the Volos middleware you wish to apply on a per-operation
basis. This section (as opposed to global) is where you would generally define your middleware insertion points. For
these definitions, you must reference the Swagger operation "nickname" you have in your Swagger definition as your
keys. 

In the example below, we have two Swagger operations, one with a nickname of "cached" and another nicknamed
"quota". You can see that the "cached" operation will apply the "cache" resource we created in the resources section
above, while the "quota" operation will likewise be subject to the resource named "quota". In both of these cases,
we've allowed the request URI to be the key by default.

      
      "operations": {
        "cached": [
          {
            "cache": null
          }
        ],
        "quota": [
          {
            "quota": null
          }
        ]
      }
    }
