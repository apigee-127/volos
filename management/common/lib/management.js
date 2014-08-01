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

/**
 * This module implements the management interface.
 *
 * Objects supported:
 *
 * developer: {
 *   email (string)
 *   id: (string)
 *   userName: (string)
 *   firstName: (string)
 *   lastName: (string)
 *   status: (string)
 *   attributes: (hash)
 * }
 *
 * application: {
 *   name: (string)
 *   id: (string)
 *   status: (string)
 *   callbackUrl: (string)
 *   developerId: (string)
 *   attributes: (hash)
 *   credentials: [(credentials)],
 *   defaultScope: (string) - optional - if exists, assigned when no scope is requested (note: not currently supported by Apigee Edge)
 *   scopes: (string) or [(string)]
 * }
 *
 * credentials: {
 *   key: (string)
 *   secret: (string)
 *   status: (string)
 *   attributes: (object)
 * }
 */

var url = require('url');
var _ = require('underscore');

function Management(Spi, options) {
  this.options = _.extend({}, options) || {};
  this.management = new Spi(this.options);
}
module.exports = Management;

Management.prototype.getSpi = function() {
  return this.management;
};

// Operations on developers

Management.prototype.createDeveloper = function(developer, cb) {
  this.management.createDeveloper(developer, cb);
};

Management.prototype.getDeveloper = function(uuid_or_email, cb) {
  this.management.getDeveloper(uuid_or_email, cb);
};

Management.prototype.updateDeveloper = function(developer, cb) {
  this.management.updateDeveloper(developer, cb);
};

Management.prototype.deleteDeveloper = function(uuid_or_email, cb) {
  this.management.deleteDeveloper(uuid_or_email, cb);
};

// returns array of developer emails
Management.prototype.listDevelopers = function(cb) {
  this.management.listDevelopers(cb);
};

// Operations on applications

Management.prototype.createApp = function(app, cb) {

  var self = this;
  checkApp(app, function(err) {
    if (err) { return cb(err); }
    self.management.createApp(app, cb);
  });

};

Management.prototype.getApp = function(key, cb) {
  this.management.getApp(key, cb);
};

Management.prototype.getDeveloperApp = function(developerEmail, appName, cb) {
  this.management.getDeveloperApp(developerEmail, appName, cb);
};

Management.prototype.deleteApp = function(uuid, cb) {
  this.management.deleteApp(uuid, cb);
};

Management.prototype.updateApp = function(app, cb) {

  var self = this;
  checkApp(app, function(err) {
    if (err) { return cb(err); }
    self.management.updateApp(app, cb);
  });
};

// returns array of app names
Management.prototype.listDeveloperApps = function(developerEmail, cb) {
  this.management.listDeveloperApps(developerEmail, cb);
};

function checkApp(app, cb) {

  if (app.callbackUrl) {
    var uri = url.parse(app.callbackUrl);
    // must not be relative
    if (uri.protocol !== 'http:' && uri.protocol !== 'https:') {
      return cb(new Error('invalid callbackUrl - must be http or https'));
    }
    if (uri.hash) {
      return cb(new Error('invalid callbackUrl - must not include fragment'));
    }
  }

  cb();
}

// Apigee-specific

//ManagementSpi.prototype.createApiProduct = function(product, cb) {
//};
//
//ManagementSpi.prototype.getApiProduct = function(name, cb) {
//};
//
//ManagementSpi.prototype.deleteApiProduct = function(name, cb) {
//};
//
//ManagementSpi.prototype.addDeveloperAppApiProduct = function(developerName, appName, consumerKey, products, cb) {
//};

// Redis-specific

//Management.prototype.getAppForClientId = function(key, cb) {
//};
//
//Management.prototype.checkRedirectUri = function(clientId, redirectUri, cb) {
//};
//
//Management.prototype.getAppIdForCredentials = function(key, secret, cb) {
//};
//
//Management.prototype.getAppForCredentials = function(key, secret, cb) {
//};
