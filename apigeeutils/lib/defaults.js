/* jshint node: true  */
'use strict';

const request = require('postman-request'),
      url = require('url'),
      fs = require('fs'),
      netrc = require('netrc')();

const DefaultBaseURI = 'https://api.enterprise.apigee.com';
const DefaultAsyncLimit = 4;

var DefaultDescriptor = {
  help: {
    name: 'Help',
    shortOption: 'h',
    scope: 'default',
    toggle: true
  },
  username: {
    name: 'Username',
    shortOption: 'u',
    scope: 'default',
    required: true,
    prompt: true
  },
  password: {
    name: 'Password',
    shortOption: 'p',
    scope: 'default',
    required: true,
    prompt: true,
    secure: true
  },
  header: {
    name: 'Header',
    shortOption: 'H',
    scope: 'default',
    required: false,
    prompt: false,
    multiple: true
  },
  token: {
    name: 'Token',
    shortOption: 't',
    scope: 'default',
    required: false,
    prompt: false
  },
  netrc: {
    name: 'netrc',
    shortOption: 'N',
    scope: 'default',
    required: false,
    toggle: true
  },
  organization: {
    name: 'Organization',
    shortOption: 'o',
    scope: 'default',
    required: true
  },
  baseuri: {
    name: 'Base URI',
    shortOption: 'L',
    scope: 'default'
  },
  debug: {
    name: 'Debug',
    shortOption: 'D',
    scope: 'default',
    toggle: true,
  },
  verbose: {
    name: 'Verbose',
    shortOption: 'V',
    scope: 'default',
    toggle: true
  },
  json: {
    name: 'JSON',
    shortOption: 'j',
    toggle: true
  },
  cafile: {
    name: 'CA file',
    shortOption: 'c',
    scope: 'default'
  },
  keyfile: {
    name: 'Key file',
    shortOption: 'K',
    scope: 'default'
  },
  certfile: {
    name: 'Cert file',
    shortOption: 'C',
    scope: 'default'
  },
  insecure: {
    name: 'insecure',
    shortOption: 'k',
    scope: 'default',
    toggle: true
  },
  asynclimit: {
    name: 'Async limit',
    shortOption: 'a',
    scope: 'default',
    type: 'int'
  }
};

module.exports.defaultDescriptor = function(opts) {
  var o = {};
  var n;
  for (n in DefaultDescriptor) {
    o[n] = DefaultDescriptor[n];
  }
  for (n in opts) {
    o[n] = opts[n];
  }
  return o;
};

var DefaultOptions = {
  baseuri: DefaultBaseURI,
  asynclimit: DefaultAsyncLimit
};

module.exports.defaultOptions = function(opts) {
  for (var n in DefaultOptions) {
    if (!opts[n]) {
      opts[n] = DefaultOptions[n];
    }
  }
  if (!opts.organization) {
    opts.organization = process.env['APIGEE_ORGANIZATION'];
  }
  if (opts.netrc) {
    var mgmtUrl = url.parse(opts.baseuri);
    if (netrc[mgmtUrl.hostname]) {
      opts.username = netrc[mgmtUrl.hostname].login;
      opts.password = netrc[mgmtUrl.hostname].password;
    }
  } else if (opts.token) {
    opts.prompt = true;
  } else {
    if (!opts.username) {
      opts.username = process.env['APIGEE_USERNAME'];
    }
    if (!opts.password) {
      opts.password = process.env['APIGEE_PASSWORD'];
    }
  }
};

module.exports.defaultRequest = function(opts) {

  var auth = {};

  if(opts.token){
    auth = {
      bearer: opts.token
    }
  } else {
    if(opts.username && opts.password){
      auth = {
        username: opts.username,
        password: opts.password.getValue()
      }
    }
  }

  var hdrs = {};
  if (opts.header) {
    var header;
    opts.header.forEach(element => {
      header = element.split(":");
      hdrs[header[0]] = header[1];
    });
  }

  var ro = {
    auth: auth,
    json: true,
    headers: hdrs,
    agentOptions: {}
  };

  if (opts.baseuri) {
    var pu = url.parse(opts.baseuri);
    if ((pu.protocol === 'https:') &&
        process.env.https_proxy) {
      opts.proxy = process.env.https_proxy;

    } else if ((pu.protocol === 'http:') &&
        process.env.http_proxy) {
      opts.proxy = process.env.http_proxy;
    }
  }


  if (opts.cafile) {
    var files = opts.cafile.split(','),
        ca = files.map( file => fs.readFileSync(file));

    ro.agentOptions.ca = ca;
  }

  if (opts.keyfile) {
    ro.key = fs.readFileSync(opts.keyfile);
  }

  if (opts.certfile) {
    ro.cert = fs.readFileSync(opts.certfile);
  }

  if (opts.insecure) {
    ro.agentOptions.rejectUnauthorized = false;
    // Skips certificate validation
    ro.strictSSL = false;
  }

  return request.defaults(ro);
};
