/* jshint node: true  */
"use strict";

const util = require("util"),
  defaults = require("../defaults"),
  command_utils = require("./command-utils");

var descriptor = defaults.defaultDescriptor({});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  if (opts.debug) {
    console.log("listRoles: %j", opts);
  }
  let uri = util.format(
    "%s/v1/o/%s/userroles",
    opts.baseuri,
    opts.organization
  );
  let requestOptions = {
    uri,
    method: "GET",
    json: true
  };
  command_utils.run("listRoles", opts, requestOptions, cb);
};
