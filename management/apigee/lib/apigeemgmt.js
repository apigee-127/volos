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
 *   credentials: (credentials object)
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

var url = require('url');
var path = require('path');
var http = require('http');
var https = require('https');

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

var DEFAULT_APIGEE_URI = 'https://api.enterprise.apigee.com';


var create = function(config) {
  return new ApigeeManagementSpi(config);
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
    if (err) {
      cb(err);
    } else {
      cb(undefined, parseDeveloper(created));
    }
  });
};

ApigeeManagementSpi.prototype.getDeveloper = function(uuid, cb) {
  makeRequest(this, 'GET', path.join('/developers', uuid), function(err, dev) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, parseDeveloper(dev));
    }
  });
};

ApigeeManagementSpi.prototype.updateDeveloper = function(developer, cb) {
  makeRequest(this, 'PUT', path.join('/developers', developer.uuid),
              makeDeveloper(developer), function(err, created) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, parseDeveloper(created));
    }
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

ApigeeManagementSpi.prototype.createApp = function(app, cb) {
  var ar = {
    name: app.name,
    status: app.status,
    callbackUrl: app.callbackUrl,
    attributes: app.attributes
  };
  makeRequest(this, 'POST', path.join('/developers', app.developerId, '/apps'), ar, function(err, newApp) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, parseApp(newApp));
    }
  });
};

ApigeeManagementSpi.prototype.getApp = function(uuid, cb) {
  makeRequest(this, 'GET', path.join('/apps', uuid), function(err, app) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, parseApp(app));
    }
  });
};

ApigeeManagementSpi.prototype.getDeveloperApp = function(developerName, appName, cb) {
  makeRequest(this, 'GET', path.join('/developers', developerName, '/apps', appName), function(err, app) {
    if (err) {
      cb(err);
    } else {
      cb(undefined, parseApp(app));
    }
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
          cb();
        }
      });
    }
  });
};

function parseApp(a) {
  var app = {
    id: a.appId,
    name: a.name,
    status: a.status,
    developerId: a.developerId,
    callbackUrl: a.callbackUrl,
    attributes: a.attributes,
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
