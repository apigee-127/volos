/* jshint node: true  */
"use strict";

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
  },
  entryName: {
    name: "Entry Name",
    required: true,
    prompt: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("deleteKVMentry: %j", opts);
  }

  var uri = util.format(
    "%s/v1/o/%s/keyvaluemaps/%s/entries/%s",
    opts.baseuri,
    opts.organization,
    opts.mapName,
    opts.entryName
  );

  if (opts.api) {
    uri = util.format(
      "%s/v1/o/%s/apis/%s/keyvaluemaps/%s/entries/%s",
      opts.baseuri,
      opts.organization,
      opts.api,
      opts.mapName,
      opts.entryName
    );
  }

  if (opts.environment) {
    uri = util.format(
      "%s/v1/o/%s/e/%s/keyvaluemaps/%s/entries/%s",
      opts.baseuri,
      opts.organization,
      opts.environment,
      opts.mapName,
      opts.entryName
    );
  }

  var requestOpts = {
    uri: uri,
    method: "DELETE"
  };
  command_utils.run("deleteKVMentry", opts, requestOpts, cb);
};
