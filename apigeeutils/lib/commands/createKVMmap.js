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
  encrypted: {
    name: "Encrypted",
    required: false,
    toggle: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("createKVMmap: %j", opts);
  }
  var payload = {
    name: opts.mapName,
    encrypted: opts.encrypted
  };

  var uri = util.format(
    "%s/v1/o/%s/keyvaluemaps",
    opts.baseuri,
    opts.organization
  );

  if (opts.api) {
    uri = util.format(
      "%s/v1/o/%s/apis/%s/keyvaluemaps",
      opts.baseuri,
      opts.organization,
      opts.api
    );
  }

  if (opts.environment) {
    uri = util.format(
      "%s/v1/o/%s/e/%s/keyvaluemaps",
      opts.baseuri,
      opts.organization,
      opts.environment
    );
  }

  var requestOpts = {
    uri: uri,
    method: "POST",
    body: payload,
    json: true
  };

  command_utils.run("createKeyValueMap", opts, requestOpts, cb);
};
