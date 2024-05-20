/* jshint node: true  */
"use strict";

const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options"),
  command_utils = require("./command-utils");

var descriptor = defaults.defaultDescriptor({
  roleName: {
    name: "Role Name",
    required: true,
    prompt: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("getRolePermissions: %j", opts);
  }
  let uri = util.format(
    "%s/v1/o/%s/userroles/%s/permissions",
    opts.baseuri,
    opts.organization,
    opts.roleName
  );
  let requestOptions = {
    uri,
    method: "GET",
    json: true
  };
  command_utils.run("getRolePermissions", opts, requestOptions, cb);
};
