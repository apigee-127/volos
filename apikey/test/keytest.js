var apikey = require('..');
var data = require('../../apidna-data');
var uuid = require('uuid');
var assert = require('assert');

describe('ApiKey', function() {
  var db;
  var keys;
  var app;

  before(function(done) {
    db = new data.ApiDnaData({
      database: 'postgres',
      postgres: {
        connectString: 'postgres://dna:dna@localhost:5432/postgres'
      }
    });
    keys = new apikey.ApiKey({ data: db });

    var newApp = {
      name: 'TestApp',
      displayName: 'App For Testing',
      key: uuid.v4(),
      secret: uuid.v4(),
      developer: { uuid: '56b64cb7-c050-4451-969e-ed7189d9d651' },
      attributes: { custom: 'Custom' }
    };

    db.insertApp(newApp, function(err, inserted) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(inserted.uuid);
      app = inserted;
      done();
    });
  });

  it('Valid API Key', function(done) {
    keys.verify(app.key, function(err, result) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(result);
      if (result.error) {
        console.error(result.error);
      }
      assert(result.application);
      assert(!result.error);
      assert.equal(app.uuid, result.application.uuid);
      assert.deepEqual(app.attributes, result.application.attributes);
      done();
    });
  });

  it('Invalid API Key', function(done) {
    keys.verify(uuid.v4(), function(err, result) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(result);
      assert(!result.application);
      assert(result.error);
      assert.equal(result.error.code, 'InvalidAPIKey');
      done();
    });
  });

  after(function(done) {
    db.deleteApp(app.uuid, function() {
      done();
    });
  });
});