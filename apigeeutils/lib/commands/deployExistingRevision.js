/* jshint node: true  */
'use strict';

const async = require('async'),
      util = require('util'),
      defaults = require('../defaults'),
      options = require('../options'),
      parseDeployments = require('./parseDeployments');

const DeploymentDelay = 60;

var descriptor = defaults.defaultDescriptor({
    api: {
        name: 'API Name',
        shortOption: 'n',
        required: true,
        prompt: true
    },
    environments: {
        name: 'Environments',
        shortOption: 'e',
        required: true,
        prompt: true
    },
    revision: {
        name: 'Revision',
        shortOption: 'r',
        required: true,
        prompt: true
    }
});
module.exports.descriptor = descriptor;

module.exports.format = function(r) {
  return r.map( e => parseDeployments.formatDeployment(e)).join('');
};

module.exports.run = function(opts, cb) {
    options.validateSync(opts, descriptor);
    if (opts.debug) {
      console.log('deployExistingRevision: %j', opts);
    }
    var request = defaults.defaultRequest(opts);

    deployProxy(opts, request, function(err, results) {
        if (err) { return cb(err); }
        if (opts.debug) { console.log('results: %j', results); }

        async.map(Object.values(results),
          function(result, cb) {

            if (opts.debug) { console.log('result: %j', result); }

            var deployment = parseDeployments.parseDeploymentResult(result);
            if (deployment) {
              // Look up the deployed URI for user-friendliness
              parseDeployments.getPathInfo([ deployment ], opts, function(err) {
                // Ignore this error because deployment worked
                if (err && opts.verbose) { console.log('Error looking up deployed path: %s', err); }
                cb(undefined, deployment);

              });
            } else {
                cb(undefined, result);
            }
          },
        cb);
    })
}

function deployProxy(opts, request, done) {
    if (opts.verbose) {
      console.log('Deploying revision %d of %s to %s', opts.revision,
                  opts.api, opts.environments);
    }

    var environments = opts.environments.split(',');

    function deployToEnvironment(environment, done) {

      var uri = util.format('%s/v1/o/%s/e/%s/apis/%s/revisions/%d/deployments',
        opts.baseuri, opts.organization, environment, opts.api, opts.revision);
      if (opts.debug) { console.log('Going to POST to %s', uri); }

      var deployCmd = util.format('action=deploy&override=true&delay=%d', DeploymentDelay);
      if (opts['base-path']) {
        deployCmd = util.format('%s&basepath=%s', deployCmd, opts['base-path']);
      }
      if (opts.debug) { console.log('Going go send command %s', deployCmd); }

      request({
        uri: uri,
        method: 'POST',
        json: false,
        body: deployCmd,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }, function(err, req, body) {
        if (err) { return done(err); }

        var jsonBody = (body ? JSON.parse(body) : null);

        if (req.statusCode === 200) {
          if (opts.verbose) { console.log('Deployment on %s successful', environment); }
          if (opts.debug) { console.log('%j', jsonBody); }
          return done(undefined, jsonBody);
        }

        if (opts.verbose) { console.error('Deployment on %s result: %j', environment, body); }
        var errMsg;
        if (jsonBody && (jsonBody.message)) {
          errMsg = jsonBody.message;
        } else {
          errMsg = util.format('Deployment on %s failed with status code %d', environment, req.statusCode);
        }
        done(new Error(errMsg));
      });
    }

    var tasks = {};
    environments.forEach(function(env) {
      tasks[env] = deployToEnvironment.bind(this, env);
    });

    async.parallel(tasks, done);
  }
