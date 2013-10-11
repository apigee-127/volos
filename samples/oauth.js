var http = require('http');
var url = require('url');

var oauth = require('apigee-oauth');
var spi = require('runtime-spi-apigee');
var opts = require('./config');

var port = 10010;

var runtime = new spi(opts);

var oOpts = {
  validGrantTypes: [ 'client_credentials', 'authorization_code',
                     'implicit_grant', 'password' ],
  passwordCheck: checkPassword
}
var oauthRuntime = new oauth(runtime, oOpts);

console.log('Initialized OAuth runtime');

function checkPassword(username, password) {
  return true;
}

var server = http.createServer(onRequest);
server.listen(port, function() {
  console.log('Listening on %d', port);
});

function onRequest(req, resp) {
  var parsedUrl = url.parse(req.url);
  if ((req.method === 'POST') && (parsedUrl.pathname === '/accesstoken')) {
    gatherBody(req, function(body) {
      createAccessToken(req, body, resp);
    });

  } else if ((req.method === 'GET') && (parsedUrl.pathname === '/authorize')) {
    authorize(parsedUrl.query, resp);

  } else if ((req.method === 'POST') && (parsedUrl.pathname === '/refresh')) {
    gatherBody(req, function(body) {
      refresh(req, body, resp);
    });

  } else if ((req.method === 'POST') && (parsedUrl.pathname === '/invalidate')) {
    gatherBody(req, function(body) {
      invalidate(req, body, resp);
    });

  } else {
    validate(req, parsedUrl, resp);
  }
}

function createAccessToken(req, body, resp) {
  var opts = {
    authorizeHeader: req.headers['authorization']
  };
  oauthRuntime.generateToken(body, opts, function(err, oauthResult) {
    if (err) {
      sendError(resp, 500, err.message);
    } else {
      resp.writeHead(200, {
        'Content-Type': 'application/json'
      });
      resp.end(JSON.stringify(oauthResult));
    }
  });
}

function authorize(queryString, resp) {
  oauthRuntime.authorize(queryString, function(err, result) {
    if (err) {
      sendError(resp, 500, err.message);
    } else {
      resp.writeHead(301, {
        'Location': result
      });
      resp.end();
    }
  });
}

function refresh(req, body, resp) {
  var opts = {
    authorizeHeader: req.headers['authorization']
  };
  oauthRuntime.refreshToken(body, opts, function(err, oauthResult) {
    if (err) {
      sendError(resp, 500, err.message);
    } else {
      resp.writeHead(200, {
        'Content-Type': 'application/json'
      });
      resp.end(JSON.stringify(oauthResult));
    }
  });
}

function invalidate(req, body, resp) {
  var opts = {
    authorizeHeader: req.headers['authorization']
  };
  oauthRuntime.invalidateToken(body, opts, function(err, oauthResult) {
    if (err) {
      sendError(resp, 500, err.message);
    } else {
      resp.writeHead(200, {
        'Content-Type': 'application/json'
      });
      resp.end(JSON.stringify(oauthResult));
    }
  });
}

function validate(req, parsedUrl, resp) {
  oauthRuntime.verifyToken(
    req.headers.authorization, req.method,
    parsedUrl.pathname,
    function(err, result) {
      if (err) {
        sendError(resp, 500, err.message);
      } else {
        resp.writeHead(200, {
          'Content-Type': 'text/plain'
        });
        resp.end('Hello, World!');
      }
    });
}

function sendError(resp, code, msg) {
  resp.writeHead(code, {
    'Content-Type': 'text/plain'
  });
  resp.end(msg + '\n');
}

function gatherBody(req, cb) {
  var body = '';
  req.setEncoding('utf8');
  req.on('readable', function() {
    var chunk;
    do {
      chunk = req.read();
      if (chunk) {
        body = body + chunk;
      }
    } while (chunk);
  });
  req.on('end', function() {
    cb(body);
  });
}

