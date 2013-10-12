/*
 * Create a developer and app so that we can have them for the rest of the tests.
 */

var mgmtSpi = require('../management-spi-apigee');
var opts = require('./testconfig');

var TestDeveloper='dyniss@example.org';
var TestApp='ApigeenTestApp';

function Creator() {
  this.spi = new mgmtSpi(opts);
}
Creator.TestDeveloper = TestDeveloper;
Creator.TestApp = TestApp;
module.exports = Creator;

Creator.prototype.createFixtures = function(cb) {
  checkDeveloper(this, cb);
}

function checkDeveloper(self, cb) {
  self.spi.getDeveloper(TestDeveloper, function(err, dev) {
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
  self.spi.createDeveloper(dev, function(err, dev) {
    if (err) {
      cb(err);
    } else {
      checkApp(self, cb);
    }
  });
}

function checkApp(self, cb) {
  self.spi.getDeveloperApp(TestDeveloper, TestApp, function(err, app) {
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
  self.spi.createApp(app, function(err, app) {
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