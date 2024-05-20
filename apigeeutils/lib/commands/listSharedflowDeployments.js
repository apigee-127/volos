/* jshint node: true  */
"use strict";

const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options"),
  parseDeployments = require("./parseDeployments");

var descriptor = defaults.defaultDescriptor({
  name: {
    name: "SharedFlow name",
    shortOption: "n"
  },
  environment: {
    name: "Environment",
    shortOption: "e"
  },
  long: {
    name: "Long",
    shortOption: "l",
    toggle: true
  }
});
module.exports.descriptor = descriptor;

module.exports.format = function (r) {
  return r.deployments
    .map((d) => parseDeployments.formatDeployment(d))
    .join("\n");
};

module.exports.run = function (opts, cb) {
  var uri;
  var parser;

  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("listsharedflowdeployments: %j", opts);
  }

  if (opts.name && !opts.environment) {
    uri = util.format(
      "%s/v1/o/%s/sharedflows/%s/deployments",
      opts.baseuri,
      opts.organization,
      opts.name
    );
    parser = parseAPIBody;
  } else if (opts.environment && !opts.name) {
    uri = util.format(
      "%s/v1/o/%s/e/%s/deployments?sharedFlows=true",
      opts.baseuri,
      opts.organization,
      opts.environment
    );
    parser = parseEnvironmentBody;
  } else if (opts.environment && opts.name) {
    cb(new Error("Can't specify both SharedFlow name and environment options"));
    return;
  } else {
    cb(
      new Error('Either "SharedFlow name" or "environment" must be specified')
    );
    return;
  }

  // Call the standard "deployments" API to get the list of what's deployed
  let request = defaults.defaultRequest(opts);
  if (opts.debug) {
    console.log('Going to invoke "%s"', uri);
  }
  request.get(uri, function (err, req, body) {
    if (err) {
      cb(err);
    } else {
      if (req.statusCode === 200) {
        if (opts.debug) {
          console.log("List of deployed SharedFlows: %j", body);
        }
        var result = parser(body);
        if (opts.long) {
          parseDeployments.getPathInfo(
            result.deployments,
            opts,
            function (err) {
              cb(err, result);
            }
          );
        } else {
          if (opts.debug) {
            console.log("All done");
          }
          cb(undefined, result);
        }
      } else {
        cb(new Error(util.format("HTTP error %d", req.statusCode)));
      }
    }
  });
};

// Normalize the JSON that we get back when we query deployments for an environment
function parseEnvironmentBody(b) {
  var env = b.name;
  var r = {
    deployments: []
  };
  for (var pn in b.aPIProxy) {
    var p = b.aPIProxy[pn];
    for (var prn in p.revision) {
      var pr = p.revision[prn];
      r.deployments.push({
        name: p.name,
        environment: env,
        revision: parseInt(pr.name),
        state: pr.state
      });
    }
  }
  return r;
}

// Normalize the JSON that we get back when we query deployments for an environment
function parseAPIBody(b) {
  var name = b.name;
  var r = {
    deployments: []
  };
  for (var en in b.environment) {
    var e = b.environment[en];
    for (var ren in e.revision) {
      var re = e.revision[ren];
      r.deployments.push({
        name: name,
        environment: e.name,
        revision: parseInt(re.name),
        state: re.state
      });
    }
  }
  return r;
}
