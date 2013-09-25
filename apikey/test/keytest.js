var apikey = require('..');
var data = require('../../apidna-data');

describe('ApiKey', function() {
  var db;
  var keys;
  var app;

  before(function() {
    db = new data.ApiDnaData({
      database: 'postgres',
      postgres: {
        connectString: 'postgres://dna:dna@localhost:5432/postgres'
      }
    });
    keys = new apikey.ApiKey({ data: data });
  });

  it('Insert test app', function(done) {
    var app = {
      name: 'TestApp',
      displayName: 'App For Testing',
      key: uuid.v4(),
      secret: uuid.v4(),
      developer: { uuid: '56b64cb7-c050-4451-969e-ed7189d9d651' }
    };

    data.insertApp(app, function(err, inserted) {
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
    keys.apply(app.uuid, function(err, app) {
      assert(!err);
      assert(app);
      assert.equal(uuid, app.uuid);
      done();
    });
  });

  after(function(done) {
    data.deleteApp(app.uuid, function() {
      done();
    });
  });
});