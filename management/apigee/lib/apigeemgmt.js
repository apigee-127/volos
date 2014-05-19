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

/**
 * This module implements the management SPI interface using the Apigee API.
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
 *   credentials: (credentials object),
 *   scopes: [(string))]
 * }
 *
 * credentials: {
 *   key: (string)
 *   secret: (string)
 *   status: (string)
 *   attributes: (object)
 * }
 *
 * To create an instance of this module, the following must be set on the "options" object:
 *   organization (string): Apigee Organization name
 *   user: (string) Apigee user name
 *   password: (string) Password for Apigee user
 *   managementUri: (string) optional URI for Apigee API endpoint to happen -- otherwise it hits api.enterprise.apigee.com.
 */

// todo: support defaultScope on Application

var DEFAULT_APIGEE_URI = 'https://api.enterprise.apigee.com';

var url = require('url');
var path = require('path');
var http = require('http');
var https = require('https');
var Common = require('volos-management-common');

var create = function(config) {
  return new Common(ApigeeManagementSpi, config);
};
module.exports.create = create;

function ApigeeManagementSpi(config) {
  if (!config.organization) {
    throw new Error('organization must be specified');
  }
  if (!config.user) {
    throw new Error('user must be specified');
  }
  if (!config.password) {
    throw new Error('password must be specified');
  }

  this.organization = config.organization;
  this.auth = 'Basic ' + (new Buffer(config.user + ':' + config.password).toString('base64'));
  this.uri = (config.managementUri ? config.managementUri : DEFAULT_APIGEE_URI);
}

// Operations on developers

ApigeeManagementSpi.prototype.createDeveloper = function(developer, cb) {
  makeRequest(this, 'POST', '/developers', makeDeveloper(developer), function(err, created) {
    cb(err, parseDeveloper(created));
  });
};

ApigeeManagementSpi.prototype.getDeveloper = function(uuid, cb) {
  makeRequest(this, 'GET', path.join('/developers', uuid), function(err, dev) {
    cb(err, parseDeveloper(dev));
  });
};

ApigeeManagementSpi.prototype.listDevelopers = function(cb) {
  makeRequest(this, 'GET', '/developers', function(err, emails) {
    cb(err, emails);
  });
};

ApigeeManagementSpi.prototype.updateDeveloper = function(developer, cb) {
  makeRequest(this, 'PUT', path.join('/developers', developer.uuid),
              makeDeveloper(developer), function(err, created) {
    cb(err, parseDeveloper(created));
  });
};

ApigeeManagementSpi.prototype.deleteDeveloper = function(uuid, cb) {
  makeRequest(this, 'DELETE', path.join('/developers', uuid), function(err) {
    cb(err);
  });
};

function makeDeveloper(d) {
  return {
    email: d.email,
    userName: d.userName,
    firstName: d.firstName,
    lastName: d.lastName,
    status: d.status,
    attributes: d.attributes
  };
}

function parseDeveloper(o) {
  if (!o) { return o; }
  return {
    email: o.email,
    userName: o.userName,
    id: o.developerId,
    firstName: o.firstName,
    lastName: o.lastName,
    status: o.status,
    attributes: o.attributes
  };
}


// Operations on Apps

ApigeeManagementSpi.prototype.createApp = function(app, cb) {
  var self = this;
  var ar = {
    name: app.name,
    status: app.status,
    callbackUrl: app.callbackUrl,
//    scopes: app.scopes,
    attributes: app.attributes
  };
  makeRequest(this, 'POST', path.join('/developers', app.developerId, '/apps'), ar, function(err, newApp) {
    if (err) { return cb(err); }
//    return cb(err, parseApp(newApp));
    // todo: is this really necessary? App looks like it should directly support a scopes prop, but I can't get it to work

    // create an ApiProduct
    if (app.scopes) { // todo: env settings
      var api = {
        name: getApiProductName(app),
        environments: [ 'test', 'prod' ], // todo: which environment(s)?
        scopes: app.scopes
      };
      self.createApiProduct(api, function(err, reply) {
        if (err && err.statusCode !== 409) { // 409 == already exists, assuming this is ok
          return cb(err);
        }
        var key = newApp.credentials[0].consumerKey;

        self.addDeveloperAppApiProduct(app.developerId, app.name, key, api.name, function(err, reply) {
          if (err) { return cb(err); }
          addScopesToApp(self, newApp, function(err, newApp) {
            var app = parseApp(newApp);
            cb(undefined, app);
          });
        });
      });
    }
  });
};

ApigeeManagementSpi.prototype.getApp = function(uuid, cb) {
  var self = this;
  makeRequest(this, 'GET', path.join('/apps', uuid), function(err, app) {
    if (err) { return cb(err); }
    addScopesToApp(self, app, function(err, app) {
      cb(undefined, parseApp(app));
    });
  });
};

ApigeeManagementSpi.prototype.listDeveloperApps = function(developerName, cb) {
  var self = this;
  makeRequest(this, 'GET', path.join('/developers', developerName, '/apps'), function(err, apps) {
    cb(err, apps);
  });
};

ApigeeManagementSpi.prototype.getDeveloperApp = function(developerName, appName, cb) {
  var self = this;
  makeRequest(this, 'GET', path.join('/developers', developerName, '/apps', appName), function(err, app) {
    if (err) { return cb(err); }
    addScopesToApp(self, app, function(err, app) {
      cb(undefined, parseApp(app));
    });
  });
};

ApigeeManagementSpi.prototype.updateApp = function(app, cb) {
  this.updateDeveloperApp(app.developerId, app.name, app, cb);
};

ApigeeManagementSpi.prototype.updateDeveloperApp = function(developerName, appName, data, cb) {
  var self = this;
  makeRequest(this, 'PUT', path.join('/developers', developerName, '/apps', appName), data, function(err, app) {
    if (err) { return cb(err); }
    addScopesToApp(self, app, function(err, app) {
      cb(undefined, parseApp(app));
    });
  });
};

ApigeeManagementSpi.prototype.deleteApp = function(uuid, cb) {
  // First we have to get the app because the API is weird and I can't delete it directly
  var self = this;
  this.getApp(uuid, function(err, app) {
    if (err) {
      cb(err);
    } else {
      makeRequest(self, 'DELETE', path.join('/developers', app.developerId, '/apps', app.name), function(err) {
        if (err) {
          cb(err);
        } else {
          self.deleteApiProduct(getApiProductName(app), cb);
        }
      });
    }
  });
};

// todo: is this really necessary? App looks like it should directly support a scopes prop, but I can't get it to work
function addScopesToApp(self, app, cb) {
  self.getApiProduct(getApiProductName(app), function(err, product) {
    if (err) { debug('unable to get scopes for app: ' + app.name); }
    if (product && product.scopes) {
      app.scopes = product.scopes;
    }
    cb(undefined, app);
  });
}

function getApiProductName(app) {
  return app.name + ' product';
}

function parseApp(a) {
  var app = {
    id: a.appId,
    name: a.name,
    status: a.status,
    developerId: a.developerId,
    callbackUrl: a.callbackUrl,
    attributes: a.attributes,
    scopes: a.scopes,
    credentials: []
  };
  for (var i = 0; i < a.credentials.length; i++) {
    var nc = {
      key: a.credentials[i].consumerKey,
      secret: a.credentials[i].consumerSecret,
      status: a.credentials[i].status
      // TODO attributes
    };
    app.credentials.push(nc);
  }
  return app;
}


// Operations on API Products

ApigeeManagementSpi.prototype.createApiProduct = function(product, cb) {
  var ar = {
    name: product.name,
    displayName: product.displayName ? product.displayName : product.name,
    approvalType: product.approvalType ? product.approvalType : 'auto',
    environments: product.environments,
    scopes: Array.isArray(product.scopes) ? product.scopes : product.scopes.split(' ')
  };
  makeRequest(this, 'POST', path.join('/apiproducts'), ar, function(err, apiProd) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, apiProd);
    }
  });
};

ApigeeManagementSpi.prototype.getApiProduct = function(name, cb) {
  makeRequest(this, 'GET', path.join('/apiproducts', name), function(err, product) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, product);
    }
  });
};

ApigeeManagementSpi.prototype.deleteApiProduct = function(name, cb) {
  makeRequest(this, 'DELETE', path.join('/apiproducts', name), function(err) {
    if (err) {
      cb(err);
    } else {
      cb();
    }
  });
};

ApigeeManagementSpi.prototype.addDeveloperAppApiProduct = function(developerName, appName, consumerKey, products, cb) {
  products = Array.isArray(products) ? products : [ products ];
  makeRequest(this, 'POST',
    path.join('/developers', developerName, '/apps', appName, '/keys', consumerKey), { apiProducts: products },
    function(err, reply) {
      if (err) {
        cb(err);
      } else {
        cb(undefined, reply);
      }
    });
};

//function parseConsumerKey()


// Utility

function makeRequest(self, verb, uriPath, o, cb) {
  if (typeof o === 'function') {
    cb = o;
    o = undefined;
  }

  var finalUri = self.uri + path.join('/v1/o', self.organization, uriPath);
  if (debugEnabled) {
    debug(verb + ' ' + finalUri);
  }

  var r = url.parse(finalUri);
  r.headers = {
    Authorization: self.auth,
    Accept: 'application/json'
  };
  r.method = verb;
  if (o) {
    r.headers['Content-Type'] = 'application/json';
  }
  if (debugEnabled) {
    debug(JSON.stringify(r));
  }

  var req;
  if (r.protocol === 'http:') {
    req = http.request(r, function(resp) {
      requestComplete(req, resp, cb);
    });
  } else if (r.protocol === 'https:') {
    req = https.request(r, function(resp) {
      requestComplete(req, resp, cb);
    });
  } else {
    cb(new Error('Unsupported protocol ' + r.protocol));
    return;
  }

  req.on('error', function(err) {
    if (debugEnabled) {
      debug('Error: ' + JSON.stringify(err));
    }
    cb(err);
  });
  if (o) {
    req.end(JSON.stringify(o));
  } else {
    req.end();
  }
}

function requestComplete(req, resp, cb) {
  resp.on('error', function(err) {
    cb(err);
  });

  var respData = '';
  resp.on('readable', function() {
    var d;
    do {
      d = resp.read();
      if (d) {
        respData += d;
      }
    } while (d);
  });

  resp.on('end', function() {
    if (resp.statusCode >= 300) {
      var err = new Error('Error on HTTP request');
      err.statusCode = resp.statusCode;
      err.message = respData;
      cb(err);
    } else {
      cb(undefined, JSON.parse(respData));
    }
  });
}

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
