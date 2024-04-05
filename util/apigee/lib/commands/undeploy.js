/* jshint node: true  */
"use strict";

const util = require("util"),
  async = require("async"),
  defaults = require("../defaults"),
  options = require("../options"),
  parseDeployments = require("./parseDeployments");

var descriptor = defaults.defaultDescriptor({
  api: {
    name: "API Name",
    shortOption: "n",
    required: true
  },
  environment: {
    name: "Environment",
    shortOption: "e",
    required: true
  },
  revision: {
    name: "Revision",
    shortOption: "r",
    required: false
  }
});
module.exports.descriptor = descriptor;

module.exports.format = function (r) {
  if (r.name) {
    return parseDeployments.formatDeployment(r);
  } else {
    return "";
  }
};

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("undeploy: %j", opts);
  }

  var request = defaults.defaultRequest(opts);

  // Run each function in series, and collect an array of results.
  async.series(
    [
      function (done) {
        getDeploymentInfo(opts, request, done);
      },
      function (done) {
        undeploy(opts, request, done);
      }
    ],
    function (err, results) {
      if (err) {
        cb(err);
      } else {
        if (opts.debug) {
          console.log("results: %j", results);
        }

        var deployResult = results[results.length - 1];
        var deployment = parseDeployments.parseDeploymentResult(deployResult);
        if (deployment) {
          cb(undefined, deployment);
        } else {
          // Can't parse the result -- do nothing
          cb(undefined, {});
        }
      }
    }
  );
};

function getDeploymentInfo(opts, request, done) {
  // Just undeploy what we said
  if (opts.revision) {
    opts.deploymentVersion = opts.revision;
    done();
    return;
  }

  // Find out which revision we should be undeploying
  request.get(
    util.format(
      "%s/v1/o/%s/environments/%s/apis/%s/deployments",
      opts.baseuri,
      opts.organization,
      opts.environment,
      opts.api
    ),
    function (err, req, body) {
      if (err) {
        done(err);
      } else if (req.statusCode === 404) {
        if (opts.verbose) {
          console.log("API %s does not exist.", opts.api);
        }
        done();
      } else if (req.statusCode === 400) {
        done(new Error(console.log(body.message)));
      } else if (req.statusCode === 200) {
        opts.deploymentVersion = parseInt(body.revision[0].name);
        if (opts.verbose) {
          console.log(
            "Going to undeploy revision %d of API %s",
            opts.deploymentVersion,
            opts.api
          );
        }
        done();
      } else {
        done(
          new Error(
            util.format("Get API info returned status %d", req.statusCode)
          )
        );
      }
    }
  );
}

function undeploy(opts, request, done) {
  if (opts.verbose) {
    console.log(
      "Undeploying revision %d of %s to %s",
      opts.deploymentVersion,
      opts.api,
      opts.environment
    );
  }

  var uri = util.format(
    "%s/v1/o/%s/apis/%s/deployments",
    opts.baseuri,
    opts.organization,
    opts.api
  );
  if (opts.debug) {
    console.log("Going to POST to %s", uri);
  }

  var deployCmd = util.format(
    "action=undeploy&revision=%d&env=%s",
    opts.deploymentVersion,
    opts.environment
  );
  if (opts["base-path"]) {
    deployCmd = util.format("%s&basepath=%s", deployCmd, opts["base-path"]);
  }
  if (opts.debug) {
    console.log("Going go send command %s", deployCmd);
  }

  request(
    {
      uri: uri,
      method: "POST",
      json: false,
      body: deployCmd,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      }
    },
    function (err, req, body) {
      var jsonBody = body ? JSON.parse(body) : null;
      if (err) {
        done(err);
      } else if (req.statusCode === 200) {
        if (opts.verbose) {
          console.log("Undeployment successful");
        }
        if (opts.debug) {
          console.log("%s", body);
        }
        done(undefined, jsonBody);
      } else {
        if (opts.verbose) {
          console.error("Undeployment result: %j", body);
        }

        var errMsg;
        if (jsonBody && jsonBody.message) {
          errMsg = jsonBody.message;
        } else {
          errMsg = util.format(
            "Undeployment failed with status code %d",
            req.statusCode
          );
        }
        done(new Error(errMsg));
      }
    }
  );
}
