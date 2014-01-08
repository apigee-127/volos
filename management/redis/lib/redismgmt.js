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

/**
 * This module implements the management SPI interface using redis.
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
 *   defaultScope: (string) - optional - if exists, assigned when no scope is requested
 *   routeScopes: [(routeScope)]
 * }
 *
 * routeScope: {
 *   verbs: [(string)]
 *   path: (string w/ optional wildcards - see Express routes specs)
 *   scopes: [(string)]
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
 volos:management:credentials.key -> application_id
 volos:management:credentials.key:credentials.secret -> application_id
 volos:management:developer_email:application_name -> application_id
 */

var KEY_PREFIX = 'volos:management';
var CRYPTO_BYTES = 256 / 8;

var crypto = require('crypto');
var uuid = require('node-uuid');
var redis = require("redis");
var _ = require('underscore');

var debug;
var debugEnabled;
if (process.env.NODE_DEBUG && /apigee/.test(process.env.NODE_DEBUG)) {
  debug = function(x) {
    console.log('Apigee: ' + x);
  };
  debugEnabled = true;
} else {
  debug = function() { };
}

var create = function(config) {
  return new RedisManagementSpi(config);
};
module.exports.create = create;

function RedisManagementSpi(config) {
  config = config || {};
  var port = config.port || 6379;
  var host = config.host || '127.0.0.1';
  var ropts = config.options || {};
  this.client = redis.createClient(port, host, ropts);
}

// Operations on developers

RedisManagementSpi.prototype.createDeveloper = function(developer, cb) {
  if (!developer.id) { developer.id = developer.uuid; }
  if (!developer.id) {
    developer.id = developer.uuid = uuid.v4();
  }
  var dev = makeDeveloper(developer);
  this.client.set(_key(dev.uuid), JSON.stringify(dev), function(err, reply) {
    if (err) { return cb(err); }
    return cb(undefined, dev);
  });
};

RedisManagementSpi.prototype.getDeveloper = function(uuid, cb) {
  getWith404(this.client, uuid, function(err, reply) {
    if (err) { return cb(err); }
    var dev = makeDeveloper(reply);
    return cb(undefined, dev);
  });
};

RedisManagementSpi.prototype.updateDeveloper = function(developer, cb) {
  this.createDeveloper(developer, cb);
};

RedisManagementSpi.prototype.deleteDeveloper = function(uuid, cb) {
  this.client.del(_key(uuid), function(err, reply) {
    if (err) { return cb(err); }
    return cb(undefined, reply);
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
 
  var validScopes = _.map(app.routeScopes, function(routeScope) { return routeScope.scopes; });
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
    credentials: [app.credentials],
    defaultScope: app.defaultScope,
    routeScopes: app.routeScopes,
    scopes: app.scopes
  };
 
  var self = this;
  self.client.get(_key(app.developerId), function(err, reply) {
    if (err) { return cb(err); }
    if (!reply) { return cb(new Error('developer ' + app.developerId + ' not found.')); }
    var developer = JSON.parse(reply);
    saveApplication(self.client, application, developer, function(err, reply) {
      if (err) { return cb(err); }
      return cb(undefined, application);
    });
  });
};
 
RedisManagementSpi.prototype.updateApp = function(app, cb) {
  var self = this
  this.getAppIdForClientId(app.credentials[0].key, function(err, reply){
    if (err) { return cb(err); }
    else if(reply == app.id) {
      self.createApp(app, cb);
    } else {
      cb(new Error("invalid app"))
    }
  })
};

RedisManagementSpi.prototype.getApp = function(key, cb) {
  getWith404(this.client, key, cb);
};

RedisManagementSpi.prototype.getDeveloperApp = function(developerEmail, appName, cb) {
  var self = this;
  this.client.get(_key(developerEmail, appName), function(err, reply) {
    if (err) { return cb(err); }
    if (reply) {
      getWith404(self.client, reply, cb);
    } else {
      return cb(make404());
    }
  });
};

RedisManagementSpi.prototype.getAppIdForClientId = function(key, cb) {
  this.client.get(_key(key), cb);
};

RedisManagementSpi.prototype.getAppForClientId = function(key, cb) {
  var self = this;
  self.getAppIdForClientId(key, function(err, reply) {
    if (err) { return cb(err); }
    self.getApp(reply, cb);
  });
};

// returns first match
RedisManagementSpi.prototype.scopesMatching = function(key, verb, path, cb) {
  var self = this;
  self.getApp(key, function(err, app) {
    if (err) { return cb(err); }
    var routeScope = _.find(app.routeScopes, function(rs) {
      var pathMatch = pathRegexp(rs.path).test(path);
      if (!pathMatch) { return false; }
      return rs.verbs ? _.contains(rs.verbs, verb) : true; // default is to match any verbs
    });
    cb(null, routeScope ? routeScope.scopes : []);
  });
};


RedisManagementSpi.prototype.checkRedirectUri = function(clientId, redirectUri, cb) {
  this.getAppForClientId(clientId, function(err, reply) {
    if (err) { return cb(err); }
    if (redirectUri && redirectUri !== reply.callbackUrl) { // todo: better comparison, ignore state, etc
      return cb(new Error('callback url mismatch'));
    }
    return cb(null, redirectUri || reply.callbackUrl);
  });
};

RedisManagementSpi.prototype.deleteApp = function(uuid, cb) {
  deleteApplication(this.client, uuid, cb);
};

RedisManagementSpi.prototype.getAppIdForCredentials = function(key, secret, cb) {
  this.client.get(_key(key, secret), cb);
};

RedisManagementSpi.prototype.getAppForCredentials = function(key, secret, cb) {
  var self = this;
  self.getAppIdForCredentials(key, secret, function(err, reply) {
    if (err) { return cb(err); }
    getWith404(self.client, reply, cb);
  });
};

// utility functions

function getWith404(client, key, cb) {
  if (!key) { return cb(make404()); }
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

function saveApplication(client, application, developer, cb) {
  var multi = client.multi();

  // application_id: -> application
  multi.set(_key(application.uuid), JSON.stringify(application));

  // developer_name:application_name -> application_id
  multi.set(_key(developer.email, application.name), application.id);

  // credentials[i].key -> application_id
  // credentials[i].key:credentials[i].secret -> application_id
  for (var i = 0; i < application.credentials.length; i++) {
    multi.set(_key(application.credentials[i].key), application.id);
    multi.set(_key(application.credentials[i].key, application.credentials[i].secret), application.id);
  }

  multi.exec(cb);
}

// must match saveApplication for deleting created keys
function deleteApplication(client, uuid, cb) {
  getWith404(client, uuid, function(err, application) {
    if (err) { return cb(err); }

    var multi = client.multi();

    // credentials[i].key -> application_id
    // credentials[i].key:credentials[i].secret -> application_id
    for (var i = 0; i < application.credentials.length; i++) {
      multi.del(_key(application.credentials[i].key));
      multi.del(_key(application.credentials[i].key, application.credentials[i].secret));
    }

    // application_id: -> application
    multi.del(_key(uuid));

    // developer_name:application_name -> application_id
    getWith404(client, uuid, function(err, dev) {
      if (dev) {
        multi.del(_key(dev.email, application.name));
      }

      // must do here instead of outside because of async callback
      multi.exec(cb);
    });
  });
}

function genSecureToken() {
  return crypto.randomBytes(CRYPTO_BYTES).toString('base64');
}

function _key() {
  var argsArray = [].slice.apply(arguments);
  argsArray.unshift(KEY_PREFIX);
  return argsArray.join(':');
}

// the following was blatantly stolen from https://github.com/visionmedia/express/blob/master/lib/utils.js

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String|RegExp|Array} path
 * @param  {Array} keys
 * @param  {Boolean} sensitive
 * @param  {Boolean} strict
 * @return {RegExp}
 * @api private
 */

var toString = {}.toString;
function pathRegexp(path, keys, sensitive, strict) {
  keys = keys || [];
  if (toString.call(path) == '[object RegExp]') return path;
  if (Array.isArray(path)) path = '(' + path.join('|') + ')';
  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
      keys.push({ name: key, optional: !! optional });
      slash = slash || '';
      return ''
        + (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
        + (optional || '')
        + (star ? '(/*)?' : '');
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)');
  return new RegExp('^' + path + '$', sensitive ? '' : 'i');
}
