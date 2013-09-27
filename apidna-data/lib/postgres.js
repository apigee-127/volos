var pg = require('pg');

function Postgres(options) {
  // Open based on the options
  if (!options.connectString) {
    throw new Error('"connectString" must be set');
  }
  this.connectString = options.connectString;
}
module.exports.Postgres = Postgres;

Postgres.prototype.insertDeveloper = function(data, cb) {
  pg.connect(this.connectString, function(err, client, done) {
    client.query(
      { name: 'insertDeveloper',
        text: 'insert into dna.developers (uuid, email, full_name) values ($1, $2, $3)',
        values: [ data.uuid, data.email, data.fullName ]
      }, function(err) {
        done();
        if (err) {
          cb(err);
        } else {
          cb(undefined, data);
        }
      });
  });
};

Postgres.prototype.deleteDeveloper = function(uuid, cb) {
  pg.connect(this.connectString, function(err, client, done) {
    client.query(
      { name: 'deleteDeveloper',
        text: 'delete from dna.developers where uuid = $1',
        values: [ uuid ]
      }, function(err) {
        done();
        if (err) {
          cb(err);
        } else {
          cb();
        }
      });
  });
}

Postgres.prototype.getDeveloper = function(uuid, cb) {
  pg.connect(this.connectString, function(err, client, done) {
    client.query(
      { name: 'getDeveloper',
        text: 'select distinct uuid, email, full_name from dna.developers where uuid = $1',
        values: [ uuid ]
      }, function(err, result) {
        done();
        if (err) {
          cb(err);
        } else {
          if (result && result.rows && result.rows.length > 0) {
            var r = result.rows[0];
            var dev = {
              uuid: r.uuid,
              email: r.email,
              fullName: r.full_name
            };
            cb(undefined, dev);
          } else {
            cb();
          }
        }
      });
  });
}

function insertAppAttribute(props, index, data, client, cb, done) {
  if (index >= props.length) {
    done();
    cb(undefined, data);
  } else {
    client.query(
      { name: 'insertAppAttribute',
        text: 'insert into dna.application_attributes (app, name, value) values ($1, $2, $3)',
        values: [ data.uuid, props[index], data.attributes[props[index]] ]
      }, function(err) {
        if (err) {
          done();
          cb(err);
        } else {
          insertAppAttribute(props, index + 1, data, client, cb, done);
        }
      });
  }
}

function insertIntoApp(data, client, cb, done) {
  client.query(
    { name: 'insertApp',
      text: 'insert into dna.applications (uuid, developer, name, display_name, key, secret) values ($1, $2, $3, $4, $5, $6)',
      values: [
        data.uuid,
        data.developer ? data.developer.uuid : null,
        data.name, data.displayName,
        data.key, data.secret ]
    }, function(err) {
      if (err) {
        done();
        cb(err);
      } else {
        var props = [];
        for (n in data.attributes) {
          props.push(n);
        }
        insertAppAttribute(props, 0, data, client, cb, done);
      }
    });
}

Postgres.prototype.insertApp = function(data, cb) {
  pg.connect(this.connectString, function(err, client, done) {
    if (err) {
      cb(err);
    } else {
      insertIntoApp(data, client, cb, done);
    }
  });
};

function deleteApp(uuid, client, cb, done) {
  client.query( {
    name: 'deleteApp',
    text: 'delete from dna.applications where uuid = $1',
    values: [ uuid ]
  }, function(err, result) {
    done();
    if (err) {
      console.error(err);
      cb(err);
    } else if (result && (result.rowCount > 0)) {
      cb();
    } else {
      cb(new Error('Application not found'));
    }
  });
}

function deleteAppAttributes(uuid, client, cb, done) {
  client.query( {
    name: 'deleteAppAttributes',
    text: 'delete from dna.application_attributes where app = $1',
    values: [ uuid ]
  }, function(err) {
    if (err) {
      console.error(err);
      done();
      cb(err);
    } else {
      deleteApp(uuid, client, cb, done);
    }
  });
}

Postgres.prototype.deleteApp = function(uuid, cb) {
  pg.connect(this.connectString, function(err, client, done) {
    if (err) {
      cb(err);
    } else {
      deleteAppAttributes(uuid, client, cb, done);
    }
  });
};

function getFromApp(uuid, options, client, cb, done) {
  var q = { name: 'getAppByUuid', values: [ uuid ] };
  if (options.getDeveloper) {
    q.text = 'select distinct a.uuid as uuid, a.name as name, a.display_name as display_name, \
     a.key as key, a.secret as secret, \
     d.uuid as developer_uuid, \
     d.email as developer_email, d.full_name as developer_full_name \
     from dna.applications as a, dna.developers as d \
     where a.developer = d.uuid and a.uuid = $1';
  } else {
    q.text = 'select distinct uuid, name, display_name, key, secret \
     from dna.applications, \
     where uuid = $1';
  }
  client.query(q, function(err, result) {
    if (err) {
      done();
      cb(err);
    } else {
      if (result && result.rows && (result.rows.length > 0)) {
        var r = result.rows[0];
        var data = {
          uuid: r.uuid,
          name: r.name,
          displayName: r.display_name,
          key: r.key,
          secret: r.secret
        };
        if (options.getDeveloper) {
          data.developer = {
            uuid: r.developer_uuid,
            email: r.developer_email,
            fullName: r.developer_full_name
          };
        }
        if (options.getAttributes) {
          getAppAttributes(data, uuid, client, cb, done);
        } else {
          done();
          cb(undefined, data);
        }
      } else {
        done();
        cb(undefined, undefined);
      }
    }
  });
}

function getFromKey(key, options, client, cb, done) {
  var q = { name: 'getAppByKey', values: [ key ] };
  if (options.getDeveloper) {
    q.text = 'select distinct a.uuid as uuid, a.name as name, a.display_name as display_name, \
     a.key as key, a.secret as secret, \
     d.uuid as developer_uuid, \
     d.email as developer_email, d.full_name as developer_full_name \
     from dna.applications as a, dna.developers as d \
     where a.developer = d.uuid and a.key = $1';
  } else {
    q.text = 'select distinct uuid, name, display_name, key, secret \
     from dna.applications \
     where key = $1';
  }
  client.query(q, function(err, result) {
    if (err) {
      done();
      cb(err);
    } else {
      if (result && result.rows && (result.rows.length > 0)) {
        var r = result.rows[0];
        var data = {
          uuid: r.uuid,
          name: r.name,
          displayName: r.display_name,
          key: r.key,
          secret: r.secret
        };
        if (options.getDeveloper) {
          data.developer = {
            uuid: r.developer_uuid,
            email: r.developer_email,
            fullName: r.developer_full_name
          };
        }
        if (options.getAttributes) {
          getAppAttributes(data, data.uuid, client, cb, done);
        }
      } else {
        done();
        cb(undefined, undefined);
      }
    }
  });
}

function getAppAttributes(data, uuid, client, cb, done) {
  var q = client.query( {
    name: 'getAppAttributes',
    text: 'select name, value from dna.application_attributes where app = $1',
    values: [ uuid ]
  });
  q.on('error', function(err) {
    console.error(err);
    done();
    cb(err);
  });
  q.on('row', function(row) {
    if (!data.attributes) {
      data.attributes = {};
    }
    data.attributes[row.name] = row.value;
  });
  q.on('end', function() {
    done();
    cb(undefined, data);
  });
}

Postgres.prototype.getApp = function(uuid, options, cb) {
  pg.connect(this.connectString, function(err, client, done) {
    if (err) {
      cb(err);
    } else {
      getFromApp(uuid, options, client, cb, done);
    }
  });
};

Postgres.prototype.getAppByKey = function(key, options, cb) {
  pg.connect(this.connectString, function(err, client, done) {
    if (err) {
      cb(err);
    } else {
      getFromKey(key, options, client, cb, done);
    }
  });
};
