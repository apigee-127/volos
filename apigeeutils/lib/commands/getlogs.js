/* jshint node: true  */
'use strict';

const util = require('util'),
      defaults = require('../defaults'),
      options = require('../options'),
      STREAM_DELAY = 5000,
      CATEGORY_NODEJS = 'nodejs',
      CATEGORY_HOSTED_BUILD = 'hostedtarget-build',
      CATEGORY_HOSTED_RUNTIME = 'hostedtarget-runtime';

var descriptor = defaults.defaultDescriptor({
  api: {
    name: 'API Name',
    shortOption: 'n',
    required: true
  },
  environment: {
    name: 'Environment',
    shortOption: 'e',
    required: true
  },
  streaming: {
    name: 'Keep Streaming',
    shortOption: 'f',
    toggle: true,
    required: false
  },
  timezone: {
    name: 'Time Zone',
    shortOption: 'z',
    required: false
  },
  'hosted-runtime': {
    name: 'Hosted Targets Runtime Logs',
    toggle: true,
    required: false
  },
  'hosted-build': {
    name: 'Hosted Targets Build Logs',
    toggle: true,
    required: false
  }
});
module.exports.descriptor = descriptor;

// This just prevents the command processor from logging "undefined" at the end
module.exports.format = function(r) {
  return '';
};

module.exports.run = function(opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log('getlogs: %j', opts);
  }

  var request = defaults.defaultRequest(opts);

  opts['category'] = CATEGORY_NODEJS;
  if (opts['hosted-build'] !== undefined) {
    opts['category'] = CATEGORY_HOSTED_BUILD;
  } else if (opts['hosted-runtime'] !== undefined) {
    opts['category'] = CATEGORY_HOSTED_RUNTIME;
  }

  if (opts['streaming'] &&
    (opts['category'] === CATEGORY_HOSTED_BUILD ||
    opts['category'] === CATEGORY_HOSTED_RUNTIME)) {

      console.log('Log streaming is currently disabled for hosted-build & hosted-runtime logs')
      opts['streaming'] = false;
  }

  var outStream = (opts.stream ? opts.stream : process.stdout);
  if (opts.streaming) {
    makeStreamRequest(request, opts, outStream, cb);
  } else {
    makeOneRequest(request, opts, outStream, cb);
  }
};

function makeOneRequest(request, opts, outStream, cb) {
  var uri = util.format(
    '%s/v1/o/%s/e/%s/apis/%s/cachedlogs/categories/%s',
    opts.baseuri, opts.organization, opts.environment,
    opts.api, opts.category);
  if (opts.timezone) {
    uri += util.format('?tz=%s', opts.timezone);
  }
  var resp = request({
    uri: uri,
    method: 'GET',
    headers: {
      'Accept': 'text/plain'
    }
  });
  resp.on('response', function(httpResp) {
    if (httpResp.statusCode === 200) {
      httpResp.pipe(outStream);
      httpResp.on('end', function() {
        cb();
      });
    } else {
      cb(new Error(util.format('HTTP error %d', httpResp.statusCode)));
    }
  });
  resp.on('error', function(err) {
    console.error(err);
    cb(err);
  });
}

function makeStreamRequest(request, opts, outStream, cb, state) {
  var uri = util.format(
    '%s/v1/o/%s/e/%s/apis/%s/cachedlogs/categories/%s?getState=true',
    opts.baseuri, opts.organization, opts.environment,
    opts.api, opts.category);
  if (state) {
    uri += util.format('&state=%s', state);
  }
  if (opts.timezone) {
    uri += util.format('&tz=%s', opts.timezone);
  }
  var resp = request({
      uri: uri,
      method: 'GET',
      headers: {
        'Accept': 'text/plain'
      }
    },
    function(err, req, body) {
      if (err) {
        cb(err);
      } else if (req.statusCode === 200) {
        // Need to split the log by newlines to find the "state".
        var state;
        body.split('\n').forEach(function(line) {
          // The log ends with "[state BLAHBLAH]" which we need for the next step
          var r = /^\[state (.*)\][\s]*$/.exec(line);
          if (r) {
            state = r[1];
          } else if (line !== '') {
            outStream.write(line + '\n');
          }
        });

        setTimeout(function() {
          makeStreamRequest(request, opts, outStream, cb, state);
        }, STREAM_DELAY);
      } else {
        cb(new Error(util.format('HTTP error %d', req.statusCode)));
      }
    });
}
