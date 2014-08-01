/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2013 Apigee Corporation

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
'use strict';

/*
 * This is a utility that will use the configuration in "testconfig-apigee"
 * to automatically deploy this proxy to your Apigee environment.
 * It is very useful in development.
 */

var PROXY_NAME = 'volosproxy';
var ENVIRONMENT = 'test';

var apigeetool = require('apigeetool');
var path = require('path');
var config = require('../testconfig/testconfig-apigee');
var _ = require('underscore');

var opts = _.pick(config.config,
  'organization', 'password'
);
opts.username = config.config.user;
if (config.config.managementUri) {
  opts.baseuri = config.config.managementUri;
}

opts.api = PROXY_NAME;
opts.environment = ENVIRONMENT;
opts.directory = __dirname;

apigeetool.deployProxy(opts, function(err, result) {
  if (err) {
    console.error('%j', err);
  } else {
    _.each(result.uris, function(uri) {
      console.log('URI: %s', uri);
    });
  }
});
