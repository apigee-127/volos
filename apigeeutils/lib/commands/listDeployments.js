const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options"),
  parseDeployments = require("./parseDeployments");

var descriptor = defaults.defaultDescriptor({
  api: {
    name: "API Name",
    shortOption: "n"
  },
  environment: {
    name: "Environment",
    shortOption: "e"
  },
  revision: {
    name: "Revision",
    shortOption: "r"
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
    console.log("listdeployments: %j", opts);
  }

  if (opts.api && !opts.environment) {
    uri = util.format(
      "%s/v1/o/%s/apis/%s/deployments",
      opts.baseuri,
      opts.organization,
      opts.api
    );
    parser = parseAPIBody;
  } else if (opts.environment && !opts.api) {
    uri = util.format(
      "%s/v1/o/%s/e/%s/deployments",
      opts.baseuri,
      opts.organization,
      opts.environment
    );
    parser = parseEnvironmentBody;
  } else if (opts.environment && opts.api) {
    cb(new Error("Can't specify both API and environment options"));
    return;
  } else {
    cb(new Error('Either "api" or "environment" must be specified'));
    return;
  }

  // Call the standard "deployments" API to get the list of what's deployed
  var request = defaults.defaultRequest(opts);
  if (opts.debug) {
    console.log('Going to invoke "%s"', uri);
  }
  request.get(uri, function (err, req, body) {
    if (err) {
      cb(err);
    } else {
      if (req.statusCode === 200) {
        if (opts.debug) {
          console.log("List of deployed APIs: %j", body);
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
        state: pr.state,
        basePath: pr.configuration.basePath
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
        state: re.state,
        basePath: re.configuration.basePath
      });
    }
  }
  return r;
}
