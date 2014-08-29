# Deployed Tests

This directory contains a test suite that we can deploy to Apigee Edge
and run there. It packages up Volos and its dependencies as a single
Apigee Edge app.

These tests will be run by:

1) Creating (in a subdirectory) an Apigee proxy that can be deployed to
any instance of Apigee. It exposes an HTTP API.
2) Deploying the proxy to Apigee.
3) Running tests against the proxy using "mocha" and HTTP
4) Undeploying the proxy

## Configuring

All of the configuration of this test will be done in
    ../testconfig/testconfig-apigee.js

Here are a few specific things to make sure that you set correctly:

* organization, user, and password: These tests will use this information in
order to deploy a proxy to Apigee. (Step 2)
* managementUri: If you are running a local installation of Apigee
(using the OPDK or "Autoplanet") then set the URI of the management API
here. Otherwise, use the default, which should be "https://api.enterprise.apigee.com".
(Step 2)
* testBaseUri: This tells the tests where they have been deployed in step 2.
In the Apigee cloud this would be something like "http://ORGNAME-test.apigeee.net".
If using the Autoplanet or OPDK then it will be an IP address and port for
the "default" virtual host in the "test" environment where we deployed
(Step 3)

## Running

Trying to do this all in one test wasn't reliable enough.
So, there are three:

Generate the proxy that you will deploy, which contains all
of Volos:

    ./pkgapigee.sh

This creates a directory called "./apigee" which contains the proxy
to deploy that contains all of Volos and test suites.

Deploy it:

    node deployservertests.js

Run the tests. These will remotely contact the server using
"testBaseUri":

    mocha -R spec

