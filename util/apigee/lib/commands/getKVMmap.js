const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options"),
  command_utils = require("./command-utils");

var descriptor = defaults.defaultDescriptor({
  environment: {
    name: "Environment",
    shortOption: "e",
    required: false
  },
  api: {
    name: "API",
    shortOption: "n",
    required: false
  },
  mapName: {
    name: "Map Name",
    required: true,
    prompt: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("getKVMmap: %j", opts);
  }

  let uri;

  if (opts.api) {
    uri = util.format(
      "%s/v1/o/%s/apis/%s/keyvaluemaps/%s",
      opts.baseuri,
      opts.organization,
      opts.api,
      opts.mapName
    );
  } else if (opts.environment) {
    uri = util.format(
      "%s/v1/o/%s/e/%s/keyvaluemaps/%s",
      opts.baseuri,
      opts.organization,
      opts.environment,
      opts.mapName
    );
  } else {
    uri = util.format(
      "%s/v1/o/%s/keyvaluemaps/%s",
      opts.baseuri,
      opts.organization,
      opts.mapName
    );
  }

  let requestOpts = {
    uri,
    method: "GET"
  };
  command_utils.run("getkvmmap", opts, requestOpts, cb);
};
