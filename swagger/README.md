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

### Services

The "x-a127-services" vendors extension section defines how the modules that will be referenced in the other sections 
of this file will be instantiated and configured. The basic idea is that you simply define the array of 
parameters that would have been passed in to create the Volos module had you done it programmatically.
 
For example, [volos-cache-memory](../cache/memory/README.md) requires a name and a hash of options. If we want to create
and use a cache named "memCache" that has a time-to-live (ttl) of 1000ms, we'd do so like this: 

    x-a127-services:
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

Volos modules are applied in a Swagger path or operation with the "x-a127-apply" extension. In the example below, we 
have examples of applying a cache ("cache") and a quota ("quota"). In each case, we're applying with the Volos defaults.

    paths:
      /cached:
        x-a127-apply:
          cache: {}
      /quota:
        x-a127-apply: 
          quota: {}

#### OAuth authorization

Once you've defined a Volos OAuth provider in x-a127-services, you may use standard Swagger 2.0 authorization constructs
to delegate to it. This is done by creating a SecurityDefinition like so:
 
    securityDefinitions:
      oauth2:
        type: oauth2
        scopes: []
        flow: accessCode
        authorizationUrl: ignored
        tokenUrl: ignored

SecurityDefinition Notes:
 
  - The SecurityDefinition name (in this case, "oauth2") MUST match the name of the x-a127-service name.
  - "type" MUST be "oauth2"
  - The remainder of the fields do not affect operation and are for documentation only. 

Once you've defined the SecurityDefinition, you can apply it to your operations. The following will require 
a valid OAuth token for the scope "scope1" on the "GET /secured" operation using the provider called "oauth2":  
 
    /secured:
      get:
      security:
        -
          oauth2:
            - scope1


Deprecated: Volos authorization may also applied in a Swagger path or operation with the "x-a127-authorizations" 
extension. The example below performs the same function as above: It requires that the request is using an OAuth 
Token validated by the "oauth2" resource requiring the "scope1" scope. (Additional scopes could be required  
by space-delimiting them or using an array.)

    /secured:
      x-a127-authorizations: 
        oauth2: 
          scope: "scope1"
