var dna = require('..');
var assert = require('assert');
var uuid = require('uuid');

describe('Postgres', function() {
  var data;
  var developer;
  var firstApp;
  var secondApp;

  before(function() {
    data = new dna.ApiDnaData({
      database: 'postgres',
      postgres: {
        connectString: 'postgres://dna:dna@localhost:5432/postgres'
      }
    });
  });

  it('Insert developer', function(done) {
    var dev = {
      email: 'joe@schmoe.net',
      fullName: 'Joe Schmoe'
    };

    data.insertDeveloper(dev, function(err, inserted) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(inserted);
      assert.equal(dev.email, inserted.email);
      assert.equal(dev.fullName, inserted.fullName);
      developer = inserted;
      done();
    });
  });

  it('Get developer', function(done) {
    data.getDeveloper(developer.uuid, function(err, found) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(found);
      assert.deepEqual(developer, found);
      done();
    });
  });

  it('Get missing developer', function(done) {
    data.getDeveloper(uuid.v4(), function(err, found) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(!found);
      done();
    });
  });

  it('Insert app', function(done) {
    var app = {
      name: 'TestApp',
      displayName: 'App For Testing',
      key: uuid.v4(),
      secret: uuid.v4(),
      developer: { uuid: developer.uuid }
    };

    data.insertApp(app, function(err, inserted) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(inserted.uuid);
      firstApp = inserted;
      done();
    });
  });

  it('Get App', function(done) {
    data.getApp(firstApp.uuid, { getDeveloper: true, getAttributes: true}, function(err, data) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      compareApps(firstApp, data);
      done();
    });
  });

  it('Get App by key', function(done) {
    data.getAppByKey(firstApp.key, { getDeveloper: true, getAttributes: true}, function(err, data) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      compareApps(firstApp, data);
      done();
    });
  });

  it('Get App Defaults', function(done) {
    data.getApp(firstApp.uuid, function(err, data) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert.equal(firstApp.uuid, data.uuid);
      assert.equal(firstApp.name, data.name);
      assert.equal(firstApp.displayName, data.displayName);
      assert.equal(firstApp.key, data.key);
      assert.equal(firstApp.secret, data.secret);
      assert.deepEqual(firstApp.attributes, data.attributes);
      done();
    });
  });

  it('Get App No Attributes', function(done) {
    data.getApp(firstApp.uuid, { getDeveloper: true, getAttributes: false }, function(err, data) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert.equal(firstApp.uuid, data.uuid);
      assert.equal(firstApp.name, data.name);
      assert.equal(firstApp.displayName, data.displayName);
      assert.equal(firstApp.key, data.key);
      assert.equal(firstApp.secret, data.secret);
      assert.equal(firstApp.developer.uuid, data.developer.uuid);
      assert(!data.attributes);
      done();
    });
  });

  it('Get missing app', function(done) {
    data.getApp(uuid.v4(), function(err, data) {
      assert(!err);
      assert(!data);
      done();
    });
  });

  it('Delete app', function(done) {
    data.deleteApp(firstApp.uuid, function(err) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      done();
    });
  });

  it('Delete missing app', function(done) {
    data.deleteApp(uuid.v4(), function(err) {
      assert(err);
      done();
    });
  });

  it('Insert app with attributes', function(done) {
    var app = {
      name: 'TestAppAttrs',
      displayName: 'App For Testing With Attributes',
      key: '1234',
      secret: '5678',
      developer: { uuid: '56b64cb7-c050-4451-969e-ed7189d9d651' },
      attributes: {
        foo: 'bar',
        bar: '123'
      }
    };

    data.insertApp(app, function(err, inserted) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(inserted.uuid);
      secondApp = inserted;
      done();
    });
  });

  it('Get App with Attributes', function(done) {
    data.getApp(secondApp.uuid, { getDeveloper: true, getAttributes: true}, function(err, data) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      compareApps(secondApp, data);
      done();
    });
  });

  it('Delete app with attributes', function(done) {
    data.deleteApp(secondApp.uuid, function(err) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      done();
    });
  });

  it('Delete developer', function(done) {
    data.deleteDeveloper(developer.uuid, function(err) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      done();
    });
  });
});

// Compare without checking everything because we don't always populate developer
function compareApps(a, b) {
  assert.equal(a.uuid, b.uuid);
  assert.equal(a.name, b.name);
  assert.equal(a.displayName, b.displayName);
  assert.equal(a.key, b.key);
  assert.equal(a.secret, b.secret);
  assert.equal(a.developer.uuid, b.developer.uuid);
  assert.deepEqual(a.attributes, b.attributes);
}