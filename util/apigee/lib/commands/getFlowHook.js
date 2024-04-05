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
    required: true,
    prompt: true
  },
  flowHookName: {
    name: "One of: PreProxyFlowHook\n        PreTargetFlowHook\n        PostTargetFlowHook\n        PostProxyFlowHook",
    required: true,
    prompt: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("getFlowHook: %j", opts);
  }
  // if(opts.targetSSL){
  //   payload.sSLInfo = {enabled: true};
  // }

  let uri = util.format(
    "%s/v1/o/%s/e/%s/flowhooks/%s",
    opts.baseuri,
    opts.organization,
    opts.environment,
    opts.flowHookName
  );
  let requestOpts = {
    uri,
    method: "GET",
    json: true
  };
  command_utils.run("getFlowHook", opts, requestOpts, cb);
};
