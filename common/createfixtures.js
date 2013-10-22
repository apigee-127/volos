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

var TestDeveloper='dyniss@example.org';
var TestApp='ApigeenTestApp';

function Creator(management) {
  this.management = management;
}
Creator.TestDeveloper = TestDeveloper;
Creator.TestApp = TestApp;
module.exports = Creator;

Creator.prototype.createFixtures = function(cb) {
  checkDeveloper(this, cb);
};

function checkDeveloper(self, cb) {
  self.management.getDeveloper(TestDeveloper, function(err, dev) {
    if (err) {
      if (err.statusCode === 404) {
        createDeveloper(self, cb);
      } else {
        cb(err);
      }
    } else {
      checkApp(self, cb);
    }
  });
}

function createDeveloper(self, cb) {
  console.log('Creating new developer %s', TestDeveloper);
  var dev = {
      firstName: 'Dyniss',
      lastName: 'Apigeen',
      email: 'dyniss@example.org',
      userName: 'dyniss'
    };
  self.management.createDeveloper(dev, function(err, dev) {
    if (err) {
      cb(err);
    } else {
      checkApp(self, cb);
    }
  });
}

function checkApp(self, cb) {
  self.management.getDeveloperApp(TestDeveloper, TestApp, function(err, app) {
    if (err) {
      if (err.statusCode === 404) {
        createApp(self, cb);
      } else {
        cb(err);
      }
    } else {
      returnApp(cb, app);
    }
  });
}

function createApp(self, cb) {
  console.log('Creating new app %s', TestApp);
  var app = {
    name: TestApp,
    developerId: TestDeveloper
  };
  self.management.createApp(app, function(err, app) {
    if (err) {
      cb(err);
    } else {
      returnApp(cb, app);
    }
  });
}

function returnApp(cb, app) {
  cb(undefined, app);
}