const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options");

const descriptor = defaults.defaultDescriptor({});

module.exports.descriptor = descriptor;

module.exports.format = function (r) {
  return r.join("\n");
};

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("listproxies: %j", opts);
  }

  let uri = util.format("%s/v1/o/%s/apis", opts.baseuri, opts.organization);
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
          console.log("List of APIs: %j", body);
        }
        if (opts.debug) {
          console.log("All done");
        }
        cb(undefined, body);
      } else {
        cb(new Error(util.format("HTTP error %d", req.statusCode)));
      }
    }
  });
};
