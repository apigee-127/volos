Apigee Volos
============

Volos is an open source Node.js solution for developing and deploying production-level APIs. Volos provides a way to
leverage common features such as [OAuth 2.0](#oauth), [Caching](#cache), and [Quota Management](#quota) into your
APIs with maximum joy.

All modules are exposed with well-defined interfaces and full test suites such that, for example, changing between a
memory-backed Cache or Quota implementation to a Redis-backed one requires only a simple configuration change. In
addition, all modules also have the option to proxy to Apigee Edge.

Finally, all modules include Connect, Express, and Volos middleware for easy integration into http proxies and
applications.

***

Quick start
===========
Check out the [training sample](samples/training/README.md).

***

Usage
=====

Apigee Proxy
------------
All modules are capable of using Apigee Edge as a commercially supported, hardened and distributed backend
implementation (though this is not required). If you intend to use the Apigee Edge implementations, you'll need to
install an Apigee proxy into your Application on the Apigee Edge server. See [apigee proxy installation](proxy/README.md)

Core Modules
------------
The following modules are part of the core of Volos and are available for inclusion in your project via npm:

### [OAuth 2.0](id:oauth)

OAuth 2.0 support with bearer tokens and all the standard grant types. Includes a raw API, plus middleware for
Express and Argo.

Two implementations are supported:

* [volos-oauth-redis](https://www.npmjs.org/package/volos-oauth-redis): Uses Redis as a database for OAuth tokens and other data
* [volos-oauth-apigee](https://www.npmjs.org/package/volos-oauth-apigee): Communicates with Apigee via API for all data storage

### [Quota](id:quota)

Support for "quotas" as implemented in many APIs -- count API calls by minute, hour, day, and week and reject them
when they are exceeded.

Three implementations are supported:

* [volos-quota-memory](https://www.npmjs.org/package/volos-quota-memory): Keeps quota buckets in memory
* [volos-quota-redis](https://www.npmjs.org/package/volos-quota-redis):  Keeps quota buckets in redis
* [volos-quota-apigee](https://www.npmjs.org/package/volos-quota-apigee): Communicates with Apigee via API to store quota values across servers

### [Cache](id:cache)

A simple cache module, supporting "put, "get," and "delete" of string keys and binary values.

Three implementations are supported:

* [volos-cache-memory](https://www.npmjs.org/package/volos-cache-memory): Keeps cache in memory
* [volos-cache-redis](https://www.npmjs.org/package/volos-cache-redis):  Keeps cache in redis
* [volos-cache-apigee](https://www.npmjs.org/package/volos-cache-apigee):  Uses Apigee cache (when running on Apigee)

### Support Modules

#### volos-management-apigee

This is a small module that wraps the Apigee management API for creating developers, applications, and the like.
It is deliberately separated from the runtime because these operations should not happen often and do not
necessarily support high volume. This module is mainly used for testing.

#### volos-management-redis

This is the equivalent management module for Redis.

***

Development
===========
If you're developing on this project, it is easiest to link all the various modules into your node_modules directory
so they all run locally instead of pulling from npm. To do this, just run:

        npm install

and then:

        link.sh

Testing
-------
Test scripts are written using "mocha." Install mocha if you haven't already like this:

        npm install -g mocha

To test Apigee providers:

1. Install the "proxy" module on an Apigee application. See the instructions [here](proxy/README.md).
2. In the "testconfig" directory, copy "testconfig-apigee-sample.js" to "testconfig-apigee.js" and edit the values. 
   You will need to specify the location of your proxy as well as the key and secret for the application.
3. Run `mocha` in each apigee/test directory you wish you test.

To test Redis providers:

1. Install and start a [redis](http://redis.io) server.
2. In the "common" directory, copy "testconfig-redis-sample.js" to "testconfig-redis.js" and edit the values if necessary.
3. Run `mocha` in each redis/test in order to run the tests for that module.


Support
=======

The support model for Volos is 'community support' for non-paying Apigee customers.  This means that you can use 
publicly-available resources to solicit assistance from the Volos developer community as well as employees of Apigee 
that help support Volos.  If you are a paying Apigee customer we can offer support through the stated channels in your 
support agreement.

Having Problems?
----------------

If you are having issues with Volos please do one or both of the following:

1. Open an issue in the [GitHub issue tracker](https://github.com/apigee-127/volos/issues)
2. Ask a question on [Stack Overflow](http://stackoverflow.com)

We will do our best to help you resolve the issue as soon as possible.
