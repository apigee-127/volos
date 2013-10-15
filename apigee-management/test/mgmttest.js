var spi = require('..');
var testOpts = require('../../common/testconfig');
var assert = require('assert');

// We delete this ID on every test -- be careful about that!
var TestDeveloperId = 'joe@schmoe.io';
var TestAppName = 'APIDNA Unit Test App';

describe('Apigee Management SPI', function() {
  var mgmt;
  var developer;
  var app;

  before(function() {
    mgmt = new spi(testOpts);

    // Clean up old test data
    mgmt.deleteDeveloper(TestDeveloperId, function(err) {
      if (err) {
        console.log('Test developer %s doesn\'t exist. Good', TestDeveloperId);
      }
    });
  });

  it('Developer not found', function(done) {
    mgmt.getDeveloper('asdfg', function(err, dev) {
      assert(err);
      assert.equal(err.statusCode, 404);
      assert(!dev);
      done();
    });
  });

  it('Create Developer', function(done) {
    var js = {
      firstName: 'Joe',
      lastName: 'Schmoe',
      email: 'joe@schmoe.io',
      userName: 'joeschmoe'
    };
    mgmt.createDeveloper(js, function(err, dev) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      console.log('Created %j', dev);
      assert.equal(js.firstName, dev.firstName);
      assert.equal(js.lastName, dev.lastName);
      assert.equal(js.email, dev.email);
      assert.equal(js.userName, dev.userName);
      assert(dev.id);
      developer = dev;
      console.log('Created %s', developer.id);
      done();
    });
  });

  it('Get Developer', function(done) {
    mgmt.getDeveloper(developer.id, function(err, dev) {
      assert(!err);
      assert.deepEqual(developer, dev);
      done();
    });
  });

  it('Create App', function(done) {
    var na = {
      name: TestAppName,
      developerId: developer.id
    };
    mgmt.createApp(na, function(err, newApp) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      assert.equal(na.name, newApp.name);
      assert.equal(na.developerId, newApp.developerId);
      assert(newApp.id);
      app = newApp;
      done();
    });
  });

  it('Get App', function(done) {
    mgmt.getApp(app.id, function(err, foundApp) {
      assert(!err);
      assert.equal(foundApp.name, app.name);
      done();
    });
  });

  it('Delete App', function(done) {
    mgmt.deleteApp(app.id, function(err) {
      if (err) {
        console.error('%j', err);
      }
      assert(!err);
      done();
    });
  });

  it('Delete Developer', function(done) {
    mgmt.deleteDeveloper(developer.id, function(err) {
      assert(!err);
      done();
    });
  });
});