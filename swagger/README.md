# volos-swagger

This module adds support for driving Volos middleware functions entirely though configuration and the Apigee 127
 [Swagger Tools](https://www.npmjs.org/package/swagger-tools) swagger-metadata middleware.

All Volos modules including Cache, Quota, and OAuth may be configured and tied to Swagger operations using
 configuration similar to the code that you would use to programmatically drive the Volos middleware. 

This can be included in an Apigee-127 project as simply as this:
    
    var a127 = require('a127-magic');
    app.use(a127.middleware());

## Configuration

The Volos Swagger Configuration is done directly in the Swagger 2.x document:
 
The following sections discuss examples from [this](test/support/swagger.yaml) swagger yaml file.  

Important: Be sure to include any referenced Volos modules in your package.json and run `npm install`.   

### Resources

The "x-volos-resources" vendors extension section defines how the modules that will be referenced in the other sections 
of this file will be instantiated and configured. The basic idea is that you simply define the array of 
parameters that would have been passed in to create the Volos module had you done it programmatically.
 
For example, [volos-cache-memory](../cache/memory/README.md) requires a name and a hash of options. If we want to create
and use a cache named "memCache" that has a time-to-live (ttl) of 1000ms, we'd do so like this: 

    x-volos-resources:
      cache:
        provider: "volos-cache-memory"
        options:
          name: "memCache"
          ttl: 10000

Note: The key (name) for this resource is "cache". This is the name that will be used later to refer to this cache, not
"memCache" - which the provider's name for the cache.

Similarly, we create a [volos-quota-memory](../quota/memory/README.md) ("quota") and 
[volos-oauth-redis](../oauth/redis/README.md) ("oauth2") reference in this example: 

    quota:
      provider: "volos-quota-memory"
      options:
        timeUnit: "minute"
        interval: 1
        allow: 2
    oauth2:
      provider: "volos-oauth-apigee"
      options:
        encryptionKey: "This is the key to encrypt/decrypt stored credentials"
      
### Paths & Operations

#### Cache & Quota middleware

Volos modules are applied in a Swagger path or operation with the "x-volos-apply" extension. In the example below, we 
have examples of applying a cache ("cache") and a quota ("quota"). In each case, we're applying with the Volos defaults.

    paths:
      /cached:
        x-volos-apply:
          cache: {}
      /quota:
        x-volos-apply: 
          quota: {}

#### OAuth authorization

Volos authorization is applied in a Swagger path or operation with the "x-volos-authorizations" extension. In the 
example below, we are requiring that the request is using an OAuth Token validated by the "oauth2" resource requiring 
the "scope1" scope. (Note: Additional scopes could also be required by space-delimiting them or using an array.)

    /secured:
      x-volos-authorizations: 
        oauth2: 
          scope: "scope1"
