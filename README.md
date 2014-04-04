# Volos

Volos is a set of Node.js modules for common API management functionality.

# Core Modules

## oauth

OAuth 2.0 support with bearer tokens and all the standard grant types. Includes a raw API, plus middleware
for Express and Argo.

Two implementations are supported:

* volos-oauth-redis: Uses Redis as a database for OAuth tokens and other data
* volos-oauth-apigee: Communicates with Apigee via API for all data storage

# quota

Support for "quotas" as implemented in many APIs -- count API calls by minute, hour, day, and week and
reject them then whey are exceeded.

Three implementations are supported:

* volos-quota-memory: Keeps quota buckets in memory
* volos-quota-redis:  Keeps quota buckets in redis
* volos-quota-apigee: Communicates with Apigee via API to store quota values across servers

## volos-cache

A simple cache module, supporting "put, "get," and "delete" of string keys and binary values.

This module will likely be reorganized into different implementations like the others.

# Support Modules

## volos-management-apigee

This is a small module that wraps the Apigee management API for creating developers, applications, and the like.
It is deliberately separated from the runtime because these operations should not happen often and do
not necessarily support high volume. This module is mainly used for testing.

## volos-management-redis

This is the equivalent management module for Redis.

# Other Directories

## common

Common utilities used by the test scripts, and test configuration.

## samples

Samples!

## proxy

An Apigee proxy that is used by the volos-quota-apigee and volos-oauth-apigee modules. These modules
communicate with this proxy using an API.

# Testing

Test scripts are written using "mocha."

1) Run "npm install" in this directory to pull down dependencies used by all the modules.
2) "npm install -g mocha" to install mocha on your machine.

To test Apigee provider:

1) Install the "proxy" module on an Apigee organization that you control, and create an API product, developer, and app.
See the instructions in the "samples" directory for details.
2) In the "common" directory, copy "testconfig-apigee-sample.js" to "testconfig-apigee.js" and edit the values. You will
need to specify where your proxy was deployed and the key and secret for the app that you created.
3) Run mocha in each directory that has a "tests" subdirectory in order to run the tests for that module.

To test Redis provider:

1) Install and start redis server.
2) In the "common" directory, copy "testconfig-redis-sample.js" to "testconfig-redis.js" and edit the values if
necessary.
3) Run mocha in each directory that has a "tests" subdirectory in order to run the tests for that module.
