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

/*
 * A quota SPI that uses the Apigee proxy defined in the "proxy" directory. This proxy has
 * a set of API calls that use the Apigee quota policy, and communicate using form-encoded
 * parameters.
 */

var assert = require('assert');
var url = require('url');
var http = require('http');
var https = require('https');
var querystring = require('querystring');
var util = require('util');

var Quota = require('volos-quota-common');

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

var create = function(options) {
  return new Quota(ApigeeQuotaSpi, options);
};
module.exports.create = create;

var ApigeeQuotaSpi = function(options) {
  if (!options.uri) {
    throw new Error('uri parameter must be specified');
  }
  if (!options.key) {
    throw new Error('key parameter must be specified');
  }

  assert(options.timeUnit);
  assert(options.interval);
  if (options.startTime) {
    throw new Error('Quotas with a fixed starting time are not supported');
  }

  this.uri = options.uri;
  this.key = options.key;
  this.options = options;
};

ApigeeQuotaSpi.prototype.apply = function(options, cb) {
  var allow = options.allow || this.options.allow;

  var r = {
    identifier: options.identifier,
    weight: options.weight,
    interval: this.options.interval,
    allow: allow,
    unit: this.options.timeUnit
  };

  makeRequest(this, 'POST', '/quotas/distributed', querystring.stringify(r), function(err, resp) {
    if (err) {
      cb(err);
    } else {
      var ret = {
        allowed: Number(resp.allowed),
        used: Number(resp.used) + Number(resp.exceeded), // note: this is exceeded for this req, not overall
        isAllowed: !resp.failed,
        expiryTime: Number(resp.expiry_time),
        timestamp: Number(resp.ts)
      };
      cb(undefined, ret);
    }
  });
};

function makeRequest(self, verb, uriPath, body, cb) {
  var finalUri = self.uri + uriPath;
  if (debugEnabled) {
    debug(util.format('API call to %s: %s', finalUri, body));
  }
  var r = url.parse(finalUri);

  r.headers = {
    'x-DNA-Api-Key': self.key
  };
  r.method = verb;
  if (body) {
    r.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  var req;
  if (r.protocol === 'http:') {
    req = http.request(r, function(resp) {
      requestComplete(resp, cb);
    });
  } else if (r.protocol === 'https:') {
    req = https.request(r, function(resp) {
      requestComplete(resp, cb);
    });
  } else {
    cb(new Error('Unsupported protocol ' + r.protocol));
    return;
  }

  req.on('error', function(err) {
    cb(err);
  });
  if (body) {
    req.end(body);
  } else {
    req.end();
  }
}

function readResponse(resp, data) {
  var d;
  do {
    d = resp.read();
    if (d) {
      data += d;
    }
  } while (d);
  return data;
}

function requestComplete(resp, cb) {
  resp.on('error', function(err) {
    cb(err);
  });

  var respData = '';
  resp.on('readable', function() {
    respData = readResponse(resp, respData);
  });

  resp.on('end', function() {
    if (debugEnabled) {
      debug(util.format('API response %d: %s', resp.statusCode, respData));
    }
    if (resp.statusCode !== 200) {
      var err = new Error('Error on HTTP request');
      err.statusCode = resp.statusCode;
      err.message = respData;
      cb(err);
    } else {
      var ret;
      try {
        ret = querystring.parse(respData);
      } catch (e) {
        // The response might not be a query string -- not everything returns it
        cb(e);
      }
      cb(undefined, ret);
    }
  });
}