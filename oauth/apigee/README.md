# volos-oauth-apigee

This is an OAuth 2.0 implementation for the Volos family of modules that uses Apigee as its source
of data. That is, information about valid application IDs and secrets, and the access tokens themselves,
are stored in Apigee.

When run locally, this module makes API calls to Apigee to access this information. That makes this
the right OAuth module to use when building OAuth-enabled applications to run on the Apigee product,
because when the application is deployed to Apigee itself, it will use all the same data as any other
Apigee application.

This module actually exports the same programming interface as "volos-oauth-common" -- see that module
for detailed documentation.

## Installing the Adapter

This module depends on an "adapter," which is a special API that is deployed to Apigee for your specific
organization in the Apigee cloud. This proxy is hosted in the Volos GitHub repo, which is here:

[https://github.com/apigee/volos](https://github.com/apigee/volos)

The proxy is inside the "proxy" directory. Instructions for deploying it may be found here:

[https://github.com/apigee/volos/blob/master/samples/basic/README.md](https://github.com/apigee/volos/blob/master/samples/basic/README.md)

### oauth.create(options)

The module exports one function, called "create". It takes an argument called "options" with the following
parameters:

* uri: The full URI of the Apigee adapter that you deployed in the last step. For instance, if the organization
name is "foo" then this might be "https://foo-test.apigee.net/adapterproxy".
* key: An API consumer key for a valid "application" that is part of the same organization where the adapter
was installed.

The result of this call will be an "OAuth" object, which may be used according to the interface defined
by the "volos-oauth-common" module.

## Deploying to Apigee

The "apigeetool" that you installed while setting up the adapter may also be used to deploy the application to
Apigee. For instance, the following command deploys the script named "oauthtest.js" to the organization named
"foo" in the "test" environment:

    apigeetool deploynodeapp -u USERNAME -p PASSWORD -o foo -e test -n argo-oauth -b /BASEPATH -m oauthtest.js -d .


