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
 /*
 * This is the proxy that uses the "apigee-access" module to get access to
 * Apigee services required by a remote instance of Volos.
 */

'use strict';

var http = require('http');
var urlModule = require('url');

// This is the version of the API (not the version of the code).
// We will change the major number for incompatible changes,
// and the minor number for new API calls,
// and the last bit when we change the implementation.
var LATEST_VERSION = '1.1.0';
var NO_AX_VERSION = '1.0.0';
var OLD_VERSION = '0.0.0';
var isJson = /^application\/json(;.+)?$/;

// There are a lot of reasons why this won't work if we're on an older
// version of Apigee. Test them here.
var apigee;
var quota;
var oauth;
var analytics;
var spikeArrest;
var supportedVersion;

// Discover which features are available by checking the local
// implementation of apigee-access. Because people download it from NPM,
// we have to actually try each feature, not just check for the function.
try {
  apigee = require('apigee-access');
  quota = apigee.getQuota();
  oauth = apigee.getOAuth();
  try {
    analytics = apigee.getAnalytics();
    supportedVersion = LATEST_VERSION;
  } catch (e) {
    supportedVersion = NO_AX_VERSION;
  }
  try {
    spikeArrest = apigee.getSpikeArrest();
    supportedVersion = LATEST_VERSION;
  } catch (e) {
    supportedVersion = NO_AX_VERSION; // todo: not sure how this version stuff works
  }
} catch (e) {
  // The module or one of its features was missing, so continue and
  // the API below will respond as appropriate.
  supportedVersion = OLD_VERSION;
}

var svr = http.createServer(handleRequest);
svr.listen(process.env.PORT || 9001, function() {
  console.log('Proxy running supporting %s of the volos API', supportedVersion);
});

function handleRequest(req, resp) {
  var uri = urlModule.parse(req.url);

  if (uri.pathname === '/v2/quotas/apply') {
    applyQuota(req, resp);
  } else if (uri.pathname === '/v2/spikearrest/apply') {
    applySpikeArrest(req, resp);
  } else if (uri.pathname === '/v2/oauth/verifyAccessToken') {
    verifyAccessToken(req, resp);
  } else if (uri.pathname === '/v2/oauth/verifyApiKey') {
    verifyApiKey(req, resp);
  } else if (uri.pathname === '/v2/oauth/generateAccessToken') {
    generateAccessToken(req, resp);
  } else if (uri.pathname === '/v2/oauth/generateAuthorizationCode') {
    generateAuthorizationCode(req, resp);
  } else if (uri.pathname === '/v2/oauth/revokeToken') {
    revokeToken(req, resp);
  } else if (uri.pathname === '/v2/analytics/accept') {
    acceptAnalytics(req, resp);
  } else if (uri.pathname === '/v2/version') {
    getVersion(req, resp);
  } else {
    sendError(404, resp);
  }
}

function applyQuota(req, resp) {
  if (!quota) {
    sendError(400, resp, 'Quota support not available');
    return;
  }
  verifyJsonRequest(req, resp, function(request) {
    quota.apply(request, function(err, result) {
      if (err) {
        sendError(500, resp, err.message);
      } else {
        sendJson(200, resp, result);
      }
    });
  });
}

function applySpikeArrest(req, resp) {
  if (!spikeArrest) {
    sendError(400, resp, 'SpikeArrest support not available');
    return;
  }
  verifyJsonRequest(req, resp, function(request) {
    spikeArrest.apply(request, function(err, result) {
      if (err) {
        sendError(500, resp, err.message);
      } else {
        sendJson(200, resp, result);
      }
    });
  });
}

function verifyAccessToken(req, resp) {
  if (!oauth) {
    sendError(400, resp, 'OAuth support not available');
    return;
  }
  verifyJsonRequest(req, resp, function(request) {
    // TODO if resource path is included, set flow.resource.name to it.
    oauth.verifyAccessToken(req, request, function(err, result) {
      if (err) {
        sendError(500, resp, err.message);
      } else {
        sendJson(200, resp, result);
      }
    });
  });
}

function verifyApiKey(req, resp) {
  if (!oauth) {
    sendError(400, resp, 'OAuth support not available');
    return;
  }
  verifyJsonRequest(req, resp, function(request) {
    oauth.verifyApiKey(req, request, function(err, result) {
      if (err) {
        sendError(500, resp, err.message);
      } else {
        sendJson(200, resp, result);
      }
    });
  });
}

function generateAccessToken(req, resp) {
  if (!oauth) {
    sendError(400, resp, 'OAuth support not available');
    return;
  }
  verifyJsonRequest(req, resp, function(request) {
    oauth.generateAccessToken(request, function(err, result) {
      if (err) {
        sendError(500, resp, err.message);
      } else {
        sendJson(200, resp, result);
      }
    });
  });
}

function generateAuthorizationCode(req, resp) {
  if (!oauth) {
    sendError(400, resp, 'OAuth support not available');
    return;
  }
  verifyJsonRequest(req, resp, function(request) {
    oauth.generateAuthorizationCode(request, function(err, result) {
      if (err) {
        sendError(500, resp, err.message);
      } else {
        sendJson(200, resp, result);
      }
    });
  });
}

function revokeToken(req, resp) {
  if (!oauth) {
    sendError(400, resp, 'OAuth support not available');
    return;
  }
  verifyJsonRequest(req, resp, function(request) {
    oauth.revokeToken(request, function(err, result) {
      if (err) {
        sendError(500, resp, err.message);
      } else {
        sendJson(200, resp, {});
      }
    });
  });
}

function acceptAnalytics(req, resp) {
  if (!analytics) {
    sendError(400, resp, 'Analytics support not available');
    return;
  }
  verifyJsonRequest(req, resp, function(request) {
    analytics.push(request, function(err, result) {
      if (err) {
        sendError(500, resp, err.message);
      } else {
        sendJson(200, resp, result);
      }
    });
  });
}

function getVersion(req, resp) {
  if (req.method === 'GET') {
    resp.writeHead(200, {
      'content-type': 'text/plain'
    });
    resp.end(supportedVersion);
  } else {
    sendError(405, resp);
  }
}

function sendError(errCode, resp, message) {
  if (message) {
    resp.writeHead(errCode, {
      'content-type': 'application/json'
    });
    var err = { message: message };
    resp.end(JSON.stringify(err));
  } else {
    resp.writeHead(errCode);
    resp.end();
  }
}

function sendJson(errCode, resp, result) {
  resp.writeHead(errCode, {
    'content-type': 'application/json'
  });
  resp.end(JSON.stringify(result));
}

// This method checks that the request is valid, and rejects it if not.
// Otherwise, it calls "cb" with a parsed JSON object.
function verifyJsonRequest(req, resp, cb) {
  if (req.method !== 'POST') {
    resp.writeHead(405, {
      'allow': 'POST'
    });
    resp.end();
    return;
  }
  if (!isJson.test(req.headers['content-type'])) {
    sendError(415, resp);
    return;
  }

  var bodyStr = '';
  req.setEncoding('utf8');

  req.on('data', function(chunk) {
    bodyStr += chunk;
  });

  req.on('end', function() {
    var body;
    try {
      body = JSON.parse(bodyStr);
    } catch (e) {
      sendError(400, resp, 'Invalid JSON');
      return;
    }

    try {
      cb(body);
    } catch (e) {
      sendError(500, resp, e.message);
      return;
    }
  });
}
