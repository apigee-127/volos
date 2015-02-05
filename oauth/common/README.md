# volos-oauth-common

This module supports the OAuth 2.0 Authorization Framework. It supports the four standard OAuth 2.0 grant types,
plus validation of "API keys," based on a set of pluggable service providers.

Please note that this module doesn't actually do anything on its own, as it needs a service provider that it
can use to store access tokens and information about applications. Volos currently supports two service providers:

* volos-oauth-apigee: This makes API calls to Apigee to generate, update, and validate tokens. It is the best
service provider to use when building an API that will be deployed to Apigee for production, as you can test
locally with the same data that will run inside Apigee.
* volos-oauth-redis: This stores all the data that it needs in Redis.

## Features

This module supports the following features:

* Support for all four OAuth 2.0 grant types as defined by [RFC 6749](http://tools.ietf.org/html/rfc6749)
* Support for bearer tokens as defined by [RFC 6750](http://tools.ietf.org/html/rfc6750)
* Support for token revocation as defined by [RFC 7009](http://tools.ietf.org/html/rfc7009)
* Support for "API key" validation, using the same data supported by the OAuth implementation
* Optionally accepts a Volos Cache to improve token validation performance.

## Examples

### Prerequisite: Create a Developer and Organization

    var ManagementProvider = require('volos-management-redis');
    var config = {
      encryptionKey : "abcdefgh12345",
    };
    var management = ManagementProvider.create(config);
    
    function createDev(cb) {
      var devRequest =  {
        firstName: 'Scott',
        lastName: 'Ganyo',
        email: 'sganyo@apigee.com',
        userName: 'sganyo'
      };
    
      management.createDeveloper(devRequest, cb);
    }
    
    function createApp(developer, cb) {
      var appRequest = {
        developerId : developer.id,
        name: 'MyApplication',
        scopes: 'scope1 scope2'
      };
      management.createApp(appRequest, cb);
    }
    
    createDev(function(e, developer) {
      console.log(JSON.stringify(developer));
      createApp(developer, function(e, result) {
        console.log(JSON.stringify(result));
      });
    });

### Initialize your oauth

    var OauthProvider = require('volos-oauth-redis');
    var oauthConfig = {
        validGrantTypes: [ 'client_credentials', 'authorization_code', 'implicit_grant', 'password' ];
        passwordCheck: function (user, pw, cb) { return true; }
    };
    var oauth = OauthProvider.create(oauthConfig);

### Set up Express using Middleware

    var app = require('express')();
    app.get('/authorize', oauth.expressMiddleware().handleAuthorize());
    app.post('/accesstoken', oauth.expressMiddleware().handleAccessToken());
    app.post('/invalidate', oauth.expressMiddleware().invalidateToken());
    app.post('/refresh', oauth.expressMiddleware().refreshToken());
    app.get('/',
        oauth.expressMiddleware().authenticate('scope2'),
        function(req, resp) {
          resp.json(['hello', 'world']);
        }
    );
    app.listen(9999);
    
### Generate a Token using password

    var request = {
        grant_type: 'password',
        client_id: 'key',
        client_secret: 'secret',
        username: 'username',
        password: 'password',
        scope: 'scope1 scope2'
    };
    oauth.generateToken(request, function(err, reply) {
        var token = reply.access_token;
    });


## Interface

### Error Handling

Nearly all the methods in this module take a "callback" as a parameter. In all cases, the first parameter of
the callback will be set to an Error object if the operation fails for any reason, and are "undefined" if the
operation succeeds.

## Cache

The OAuth module can also accept a Volos Cache to reduce contention and delay in validating tokens. 
Note: Cache passed to Oauth must not specify an encoding option.

### Example

      var Cache = require('volos-cache-memory');
      var cache = Cache.create('OAuth cache');
      oauth.useCache(cache);


## Middleware

### oauth.expressMiddleware(options)

Create an object that may be used as "middleware" in the Express framework. See below for the details.

### oauth.argoMiddleware(options)

Create an object that may be used as "middleware" in the Argo framework. See below for the details.

## Argo and Express Middleware

The middleware functions return objects that contain methods, and these methods have functions that
in turn return other functions, which may be used as "middleware". (That sounds complicated but it's
actually pretty concise.)

By using the middleware, the work of gathering request bodies and query parameters, and generating responses
is done automatically, so you have to write much less code.

The Express middleware follows the pattern used by [Connect](http://www.senchalabs.org/connect/) so it may be
configured in a chain with other Express and Connect middleware.

The Argo middleware follows the slightly different pattern used by [Argo](https://github.com/argo/argo). Again,
it may be easily combined with other Argo middleware.

Either way, the same set of middleware functions are available:

### Middleware.handleAuthorize()

Return a function that may be used as middleware that would be used in the "/authorize" URI of an OAuth-enabled
application. The middleware will parse the query parameters on the request and generate a JSON response.

### Middleware.handleAccessToken()

Return a function that would be used as middleware in the "/accessToken" URI of an application. The middleware
will parse the request body and generate a JSON response.

### Middleware.authenticate()

Return a function that will check the "Authorization" header of the incoming request. If invalid, then it will
generate an error response. Otherwise, it will do nothing, passing the method through to the next handler.

### Middleware.refreshToken()

Return a function that would be used as middleware to refresh an OAuth token. It will read the request body
and generate a JSON response.

### Middleware.invalidateToken()

Return a function that would be used as middleware to invalidate an OAuth token. It will read the request body
and generate a JSON response.

## Raw API

The middleware is built on top of a lower-level API, which may be used directly. This would be the case if you
are using a different web app framework, or if you are not using a web app framework at all, or if you
just like to do things manually. The lower-level API does not depend on any frameworks, and does not even
depend on Node's "http" module.

### class: OAuth

### OAuth.authorize(queryString, callback)

For the OAuth "authorization code" grant type, this method returns the authorization code, as described
in Section 4.1.1 of RFC 6749. "queryString" must be set to the query string on the incoming HTTP request.
"callback" will be invoked on completion. If the result is successful, then the second parameter of
"callback" will be an object that contains all the fields of an OAuth 2.0 response as defined in section
4.1.2.

For the "implicit grant" grant type, this method does the same thing, but the URL that is returned contains
the token itself as described in RFC 6749 Section 4.2.2.

    oauth.authorize('response_type=code&client_id=s6BhdRkqt3&state=xyz&redirect_uri=https%3A%2F%2Fclient%2Eexample%2Ecom%2Fcb',
                    function(err, result) {
                      if (err) {
                        // Handle OAuth error
                      } else {
                        // return data to client
                      }
                    });

### OAuth.generateToken(requestBody, options, callback)

Generate an OAuth access token based on the specified grant type. This is described
in Sections 4.1.3 ("authorization_code"), 4.3 ("password"), and 4.4 ("client_credentials"). Of RFC 6749.
The "requestBody" in this case must be set to the HTTP POST body on the request, which is in turn a
set of form-encoded parameters.

    oauth.generateToken('grant_type=password&username=johndoe&password=A3ddj3w',


### OAuth.refreshToken(requestBody, options, callback)

Refresh an existing OAuth access token as described in section 6 of RFC6749. As in previous requests,
the request body is required.

    oauth.refreshToken('grant_type=refresh_token&refresh_token=tGzv3JOkF0XG5Qx2TlKWIA',
                       function(err, result) {
                          // Check both as described before
                        });

### OAuth.invalidateToken(requestBody, options, callback)

Invalidate an existing OAuth access token, as described in RFC 7009.

   oauth.invalidateToken('token=45ghiukldjahdnhzdauz&token_type_hint=refresh_token',
                        function(err, result) {
                          // Check both as described before
                        });

### OAuth.verifyToken(authorizationHeader, requiredScopes, callback)

Verify an OAuth bearer token, as described in section 2.1 of RFC 6750. This validates the HTTP "Authorization"
header against the database. requiredScopes is optional and may be either an array or a space-delimited string.

    oauth.verifyToken('Bearer mF_9.B5f-4.1JqM', 'scope1 scope2', function(err, result) {
                        function(err, result) {
                          // Check both as described before
                        });

### OAuth.verifyApiKey(apiKey, request, callback)

Verify an ApiKey (client id) header against the database. Request is not required.

    oauth.verifyApiKey('some api key', request, function(err, result) {
                        function(err, result) {
                          // Check both as described before
                        });
