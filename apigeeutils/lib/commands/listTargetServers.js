const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options"),
  command_utils = require("./command-utils");

var descriptor = defaults.defaultDescriptor({
  environment: {
    name: "Environment",
    shortOption: "e",
    required: true,
    prompt: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("listTargetServers: %j", opts);
  }
  let uri = util.format(
    "%s/v1/o/%s/e/%s/targetservers",
    opts.baseuri,
    opts.organization,
    opts.environment
  );
  let requestOptions = {
    uri,
    method: "GET",
    json: true
  };
  command_utils.run("listTargetServers", opts, requestOptions, cb);
};
