# Apigene

Apigene is a set of Node.js modules for common API management functionality.

# Core Modules

## apigene-cache

A simple cache module, supporting "put, "get," and "delete" of string keys and binary values.

* Locally -- cache is in memory on each app
* Deployed to Apigee -- module is replaced with Apigee's distributed cache

## apigene-kvm

A simple key-value map, with a similar interface to apigene-cache, but with a different service level.

Uses a pluggable SPI for persistence -- apigene-apigee-runtime is the first implementation.

## apigene-oauth

OAuth 2.0 support with bearer tokens and all the standard grant types.

Uses a pluggable SPI -- apigene-apigee-runtime is the first implementation.

## apigene-quota

A quota module, supporting quotas using any string identifier, for varying lengths of time and
different strategies for resetting them.

Uses a pluggable SPI for persistence and support across the cluster.
apigene-apigee-runtime is the first implementation.

# Support Modules

## apigene-apigee-runtime

This is the module that provides back-end support for kvm, quotas, and oauth. It uses a special Apigee
proxy, which must be deployed to Apigee, so that it can communicate with Apigee in order to store and
access data.

In the future we can create other modules that support the same interface but which do different things.

## apigene-apigee-management

This is a small module that wraps the Apigee management API for creating developers, applications, and the like.
It is deliberately separated from the runtime because these operations should not happen often and do
not necessarily support high volume. This module is used for testing.

# Other Directories

## common

Common utilities used by the test scripts, and test configuration.

## samples

Samples!

## proxy

An Apigee proxy that is used by the apigene-apigee-runtime and apigene-apigee-management modules. These modules
communicate with this proxy usign an API.

# Runtime Options

There are a few options for running Apigene -- either locally, with remote API access to Apigee, or on Apigee
itself.

In the future, additional "runtime" and "management" modules may be created, which allow different styles of
persistence.

## Apigee Adapter

When run locally, Apigene's runtime module ("apigene-apigee-runtime")
can use API calls to communicate with Apigee. These API calls are
used for creating and validating OAuth tokens, persisting quota values, and storing key-value maps.

## Deploy to Apigee

When an application that useas "apigene-apigee-runtime" is deployed to Apigee, the implementation is replaced
with one that is optimized to function within Apigee itself. This provides Apigee additional access to information
about the app which allows for better analytics, stronger SLAs, and better performance.

# Testing

Test scripts are written using "mocha."

1) Run "npm install" in this directory to pull down dependencies used by all the modules.
2) "npm install -g mocha" to install mocha on your machine
3) Install the "proxy" module on an Apigee organization that you control, and create an API product, developer, and app.
See the instructions in the "samples" directory for details.
3) In the "common" directory, copy "testconfig-sample.js" to "testconfig.js" and edit the values. You will
need to specify where your proxy was deployed and the key and secret for the app that you created.
3) Run mocha in each directory that has a "tests" subdirectory in order to run the tests for that module.
