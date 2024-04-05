/* jshint node: true  */
"use strict";

// this works only if the proxy/app has already been undeployed

const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options"),
  parseDeployments = require("./parseDeployments");

/*
 Usage: delete -o [organization] -n [proxy name]
 -u [username] -p [password]
 -l [Apigee URL]

 -o Apigee organization name
 -n Apigee proxy name
 -u Apigee user name
 -p Apigee password
 -l Apigee API URL (optional, defaults to https://api.enterprise.apigee.com)
 -h Print this message
 */

var descriptor = defaults.defaultDescriptor({
  name: {
    name: "SharedFlow Name",
    shortOption: "n",
    required: true
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
    console.log("undeploySharedFlow: %j", opts);
  }

  var request = defaults.defaultRequest(opts);

  // Run each function in series, and collect an array of results.
  doDelete(opts, request, function (err, results) {
    if (err) {
      cb(err);
    } else {
      if (opts.debug) {
        console.log("results: %j", results);
      }

      cb(undefined, {});
    }
  });
};

function doDelete(opts, request, done) {
  if (opts.verbose) {
    console.log("Deleting %s", opts.name);
  }

  var uri = util.format(
    "%s/v1/o/%s/sharedflows/%s",
    opts.baseuri,
    opts.organization,
    opts.name
  );
  if (opts.debug) {
    console.log("Going to send DELETE to %s", uri);
  }

  request(
    {
      uri: uri,
      method: "DELETE",
      json: false,
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
          console.log("Delete successful");
        }
        if (opts.debug) {
          console.log("%s", body);
        }
        done(undefined, jsonBody);
      } else {
        if (opts.verbose) {
          console.error("Delete result: %j", body);
        }

        var errMsg;
        if (jsonBody && jsonBody.message) {
          errMsg = jsonBody.message;
        } else {
          errMsg = util.format(
            "Delete failed with status code %d",
            req.statusCode
          );
        }
        done(new Error(errMsg));
      }
    }
  );
}
