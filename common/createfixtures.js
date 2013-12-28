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
"use strict";

/*
 * Create a developer and app so that we can have them for the rest of the tests.
 */

var DEFAULT_SCOPE = 'scope1';
var ROUTE_SCOPES = [
  { path: '/dogs',
    scopes: ['scope2']
  }
];

var DEV_1 = {
  firstName: 'Dyniss',
  lastName: 'Apigeen',
  email: 'dyniss@example.org',
  userName: 'dyniss'
};

var APP_1 = {
  name: 'ApigeenTestApp',
  developerId: DEV_1.email,
  callbackUrl: 'http://example.org',
  defaultScope: DEFAULT_SCOPE,
  routeScopes: ROUTE_SCOPES
};

var DEV_2 = {
  firstName: 'Dyniss2',
  lastName: 'Apigeen2',
  email: 'dyniss2@example.org',
  userName: 'dyniss2'
};

var APP_2 = {
  name: 'ApigeenTestApp2',
  developerId: DEV_2.email,
  callbackUrl: 'http://example.org',
  defaultScope: DEFAULT_SCOPE,
  routeScopes: ROUTE_SCOPES
};


function Creator(management) {
  this.management = management;
}
module.exports = Creator;

Creator.prototype.createFixtures = function(cb) {
  var self = this;
  checkDeveloper(self, DEV_1, APP_1, function(err, app1) {
    if (err) { return cb(err); }
    checkDeveloper(self, DEV_2, APP_2, function(err, app2) {
      if (err) { return cb(err); }
      cb(undefined, [app1, app2]);
    });
  });
};

function checkDeveloper(self, dev, app, cb) {
  self.management.getDeveloper(dev.email, function(err, devRet) {
    if (err) {
      if (err.statusCode === 404) {
        createDeveloper(self, dev, app, cb);
      } else {
        cb(err);
      }
    } else {
      checkApp(self, devRet, app, cb);
    }
  });
}

function createDeveloper(self, dev, app, cb) {
  console.log('Creating new dev %s', JSON.stringify(dev));
  self.management.createDeveloper(dev, function(err, dev) {
    if (err) {
      cb(err);
    } else {
      checkApp(self, dev, app, cb);
    }
  });
}

function checkApp(self, dev, app, cb) {
  app.developerId = dev.id;
  self.management.getDeveloperApp(dev.id, app.name, function(err, appRet) {
    if (err) {
      if (err.statusCode === 404) {
        createApp(self, app, cb);
      } else {
        cb(err);
      }
    } else {
      cb(undefined, appRet);
    }
  });
}

function createApp(self, app, cb) {
  console.log('Creating new app %s', JSON.stringify(app));
  self.management.createApp(app, cb);
}
