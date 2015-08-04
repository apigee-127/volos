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

/* This module implements the management SPI interface using redis.
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
 *   attributes: (object)
 * }
 *
 * application: {
 *   name: (string)
 *   id: (string)
 *   status: (string)
 *   callbackUrl: (string)
 *   developerId: (string)
 *   attributes: (object)
 *   credentials: [encrypted(credentials)],
 *   defaultScope: (string) - optional - if exists, assigned when no scope is requested
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

/*
 schema:
 volos:management:application_id -> application
 volos:management:developer_id -> developer
 volos:management:developer_email -> developer_id
 volos:management:credentials.key -> application_id
 volos:management:credentials.key:hashed(credentials.secret) -> application_id
 volos:management:developer_email:application_name -> application_id
 */

var KEY_PREFIX = 'volos:management';
var CRYPTO_BYTES = 256 / 8;

var debug = require('debug')('apigee');
var crypto = require('crypto');
var uuid = require('node-uuid');
var redis = require("redis");
var _ = require('underscore');
var Common = require('volos-management-common');
var async = require('async');
var url = require('url');

var create = function(config) {
  return new Common(RedisManagementSpi, config);
};
module.exports.create = create;

function RedisManagementSpi(config) {
  config = config || {};
  var port = config.port || 6379;
  var host = config.host || '127.0.0.1';
  var db = config.db || 0;
  var ropts = _.extend({}, config.options) || {};
  this.hashAlgo = config.hashAlgo || 'sha256';
  this.cypherAlgo = config.cypherAlgo || 'aes192';
  if (!config.encryptionKey) { throw new Error('you must provide an encryptionKey in config'); }
  this.encryptionKey = config.encryptionKey;
  this.client = redis.createClient(port, host, ropts);
  this.client.select(db);
}

// Operations on developers

RedisManagementSpi.prototype.createDeveloper = function(developer, cb) {
  var self = this;
  if (!developer.id) { developer.id = developer.uuid; }
  var doSave = function() {
    var dev = makeDeveloper(developer);
    saveDeveloper(self.client, dev, cb);
  };
  if (!developer.id) {
    getDeveloperIdForEmail(this.client, developer.email, function(err, id) {
      if (!err && id) {
        err = new Error('duplicate email');
        err.statusCode = 409;
      }
      if (err) { return cb(err); }
      developer.id = developer.uuid = uuid.v4();
      doSave();
    });
  } else {
    doSave();
  }
};

RedisManagementSpi.prototype.getDeveloper = function(uuid_or_email, cb) {
  var self = this;
  var respond = function(id) {
    getWith404(self, id, function(err, reply) {
      if (err) { return cb(err); }
      cb(undefined, makeDeveloper(reply));
    });
  };
  if (!isUUID(uuid_or_email)) {
    getDeveloperIdForEmail(self.client, uuid_or_email, function(err, id) {
      if (err) { return cb(err); }
      respond(id);
    });
  } else {
    respond(uuid_or_email);
  }
};

RedisManagementSpi.prototype.updateDeveloper = function(developer, cb) {
  this.createDeveloper(developer, cb);
};

// cascades delete to associated apps
RedisManagementSpi.prototype.deleteDeveloper = function(uuid_or_email, cb) {
  var self = this;
  this.getDeveloper(uuid_or_email, function(err, dev) {
    if (err) { return cb(err); }
    deleteDeveloper(self, dev, cb);
  });
};

RedisManagementSpi.prototype.listDevelopers = function(cb) {
  var devs = [];
  var prefixLen = KEY_PREFIX.length + 1;
  this.client.keys(_key('*@*.*'), function(err, keys) {
    _.each(keys, function(key) {
      var nopref = key.substring(prefixLen);
      var sep = nopref.indexOf(":");
      if (sep < 0) { devs.push(nopref); }
    });
    cb(null, devs);
  });
};

function makeDeveloper(d) {
  return {
    id: d.uuid,
    uuid: d.uuid,
    email: d.email,
    userName: d.userName,
    firstName: d.firstName,
    lastName: d.lastName,
    status: d.status,
    attributes: d.attributes
  };
}

// Operations on applications

RedisManagementSpi.prototype.createApp = function(app, cb) {
  if(!app.uuid) {
    app.uuid = uuid.v4();
  }

  if(!app.credentials) {
    app.credentials = {
      key: genSecureToken(),
      secret: genSecureToken(),
      status: 'valid'
    };
  }

  updateApp(this, app, true, cb);
};

function updateApp(self, app, isNew, cb) {
  var validScopes = app.scopes;
  if (validScopes && !Array.isArray(validScopes)) {
    validScopes = validScopes.split(' ');
  }
  if (app.defaultScope) { validScopes.push(app.defaultScope); }
  app.scopes = _.uniq(_.flatten(validScopes));

  var application = {
    id: app.uuid,
    uuid: app.uuid,
    name: app.name,
    status: app.status,
    developerId: app.developerId,
    callbackUrl: app.callbackUrl,
    attributes: app.attributes,
    credentials: Array.isArray(app.credentials) ? app.credentials : [app.credentials],
    defaultScope: app.defaultScope,
    scopes: app.scopes
  };

  self.client.get(_key(app.developerId), function(err, reply) {
    if (err) { return cb(err); }
    if (!reply) { return cb(new Error('developer ' + app.developerId + ' not found.')); }
    var developer = JSON.parse(reply);
    async.waterfall([
      function(cb) {
        if (!isNew) { return cb(); }
        self.client.get(_key(developer.email, app.name), function(err, reply) {
          if (!err && reply) { err = cb(new Error('App with name ' + app.name + ' already exists')); }
          cb(err);
        });
      },
      function(cb) {
        saveApplication(self, application, developer, function(err) {
          if (err) { return cb(err); }
          cb(undefined, application);
        });
      }
    ], cb);
  });
}

RedisManagementSpi.prototype.updateApp = function(app, cb) {
  var self = this;
  getAppIdForClientId(self.client, app.credentials[0].key, function(err, reply){
    if (err) { return cb(err); }
    if (reply === app.id) {
      updateApp(self, app, false, cb);
    } else {
      cb(new Error("invalid app"));
    }
  });
};

RedisManagementSpi.prototype.getApp = function(key, cb) {
  var self = this;
  getWith404(self, key, function(err, app) {
    if (err) { return cb(err); }
    if (app.credentials) {
      app.credentials = decrypt(self, app.credentials);
    }
    cb(err, app);
  });
};

RedisManagementSpi.prototype.getDeveloperApp = function(developerEmail, appName, cb) {
  var self = this;
  this.client.get(_key(developerEmail, appName), function(err, appId) {
    if (err) { return cb(err); }
    self.getApp(appId, cb);
  });
};

RedisManagementSpi.prototype.listDeveloperApps = function(developerEmail, cb) {
  var self = this;
  var prefix = _key(developerEmail);
  var prefixLen = prefix.length + 1;
  self.client.keys(_key(developerEmail, '*'), function(err, keys) {
    if (err) { return cb(err); }
    var names = _.map(keys, function(key) {
      return key.substring(prefixLen);
    });
    cb(null, names);
  });
};

RedisManagementSpi.prototype.getAppForClientId = function(key, cb) {
  var self = this;
  getAppIdForClientId(self.client, key, function(err, appId) {
    if (err) { return cb(err); }
    self.getApp(appId, cb);
  });
};


RedisManagementSpi.prototype.checkRedirectUri = function(clientId, redirectUri, cb) {
  this.getAppForClientId(clientId, function(err, reply) {
    if (err) { return cb(err); }
    if (redirectUri) {
      if (redirectUri !== reply.callbackUrl) {
        var url1 = url.parse(redirectUri, true);
        var url2 = url.parse(reply.callbackUrl, true);
        if (url1.protocol !== url2.protocol ||
          url1.host !== url2.host ||
          url1.port !== url2.port ||
          url1.pathname !== url2.pathname) {
          return cb(new Error('callback url mismatch'));
       } else {
          _.extend(url1.query, url2.query); // ensure registered query params are returned
          url1.search = null;
          return cb(null, url.format(url1));
        }
      }
    }
    return cb(null, redirectUri || reply.callbackUrl);
  });
};

RedisManagementSpi.prototype.deleteApp = function(uuid, cb) {
  deleteApplication(this, uuid, cb);
};

RedisManagementSpi.prototype.getAppIdForCredentials = function(key, secret, cb) {
  this.client.get(_key(key, hashToken(this, secret)), cb);
};

RedisManagementSpi.prototype.getAppForCredentials = function(key, secret, cb) {
  var self = this;
  self.getAppIdForCredentials(key, secret, function(err, appId) {
    if (err) { return cb(err); }
    self.getApp(appId, cb);
  });
};

// utility functions

function getDeveloperIdForEmail(client, email, cb) {
  client.get(_key(email), cb);
}

function getAppIdForClientId(client, key, cb) {
  client.get(_key(key), cb);
}

function getWith404(self, key, cb) {
  if (!key) { return cb(make404()); }
  var client = self.client;
  client.get(_key(key), function(err, reply) {
    if (err) { return cb(err); }
    if (reply) {
      reply = JSON.parse(reply);
      return cb(null, reply);
    } else {
      return cb(make404());
    }
  });
}

function make404() {
  var err = new Error('entity not found');
  err.statusCode = 404;
  return err;
}

function saveDeveloper(client, developer, cb) {
  var multi = client.multi();

  // developer_uuid -> developer
  multi.set(_key(developer.id), JSON.stringify(developer));

  // developer_email -> developer_id
  multi.set(_key(developer.email), developer.id);

  multi.exec(function(err, reply) {
    cb(err, developer);
  });
}

// must match saveDeveloper for deleting created keys
function deleteDeveloper(self, developer, cb) {

  var multi = self.client.multi();

  // developer_uuid -> developer
  multi.del(_key(developer.id));

  // developer_uuid -> developer_id
  multi.del(_key(developer.email));

  // cascade delete to associated apps
  self.client.keys(_key(developer.email, '*'), function(err, keys) {
    if (err) { return cb(err); }
    if (!keys.length) { return multi.exec(cb); }

    self.client.mget(keys, function(err, appIds) {
      if (err) { return cb(err); }

      var called = 0;
      var gotError;
      var finish = function(err) {
        if (err && !gotError) { gotError = (err.statusCode !== 404); }
        if (++called === appIds.length) {
          if (gotError) { return cb(err); }
          multi.exec(cb);
        }
      };

      if (appIds.length === 0) { return multi.exec(cb); }
      for (var i = 0; i < appIds.length; i++) {
        addAppDeletes(self, multi, appIds[i], finish);
      }
    });
  });
}

function saveApplication(self, application, developer, cb) {
  var client = self.client;
  var multi = client.multi();
  var oldAppName = undefined;

  client.get(_key(application.uuid), function(err, reply) {
    if (err) { return cb(err); }
    if (reply) {
      oldAppName = JSON.parse(reply).name;
    }

    // application_id -> application
    var storedApp = _.extend({}, application);
    storedApp.credentials = encrypt(self, application.credentials);
    multi.set(_key(application.uuid), JSON.stringify(storedApp));

    // developer_email:application_name -> application_id
    if (oldAppName) {
      multi.del(_key(developer.email, oldAppName));
    }
    multi.set(_key(developer.email, application.name), application.id);

    // credentials[i].key -> application_id
    // credentials[i].key:credentials[i].secret -> application_id
    for (var i = 0; i < application.credentials.length; i++) {
      multi.set(_key(application.credentials[i].key), application.id);
      multi.set(_key(application.credentials[i].key, hashToken(self, application.credentials[i].secret)), application.id);
    }

    multi.exec(cb);
  });
}

// must match saveApplication for deleting created keys
function deleteApplication(self, uuid, cb) {
  var client = self.client;
  var multi = client.multi();
  addAppDeletes(self, multi, uuid, function(err) {
    if (err) { return cb(err); }
    multi.exec(cb);
  });
}

function addAppDeletes(self, multi, uuid, cb) {
  var client = self.client;
  self.getApp(uuid, function(err, application) {
    if (err) { return cb(err); }

    // credentials[i].key -> application_id
    // credentials[i].key:credentials[i].secret -> application_id
    for (var i = 0; i < application.credentials.length; i++) {
      multi.del(_key(application.credentials[i].key));
      multi.del(_key(application.credentials[i].key, hashToken(self, application.credentials[i].secret)));
    }

    // application_id -> application
    multi.del(_key(uuid));

    client.keys(_key('*@*.*', application.name), function(err, keys) {
      multi.del(keys);
      cb(err);
    });
  });
}

function isUUID(str) {
  if (typeof str !== 'string') { return false; }
  return str.search(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) !== -1;
}

function genSecureToken() {
  return crypto.randomBytes(CRYPTO_BYTES).toString('base64');
}

function hashToken(self, token) {
  return crypto.createHash(self.hashAlgo).update(token).digest("hex");
}

// returns Buffer
function encrypt(self, object) {
  var cipher = crypto.createCipher(self.cypherAlgo, self.encryptionKey);
  var json = JSON.stringify(object);
  var buffers = [cipher.update(new Buffer(json))];
  buffers.push(cipher.final());
  var encrypted = Buffer.concat(buffers);
  return encrypted;
}

function decrypt(self, data) {
  var decipher = crypto.createDecipher(self.cypherAlgo, self.encryptionKey);
  var buffers = [decipher.update(new Buffer(data))];
  buffers.push(decipher.final());
  var decrypted = Buffer.concat(buffers).toString();
  return JSON.parse(decrypted);
}

function _key() {
  var argsArray = [].slice.apply(arguments);
  argsArray.unshift(KEY_PREFIX);
  return argsArray.join(':');
}
