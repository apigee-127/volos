/* jshint node: true  */
"use strict";

const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options"),
  command_utils = require("./command-utils");

let descriptor = defaults.defaultDescriptor({
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
    console.log("getRoleUsers: %j", opts);
  }

  let uri = util.format(
    "%s/v1/o/%s/userroles/%s/users",
    opts.baseuri,
    opts.organization,
    opts.roleName
  );
  let requestOptions = {
    uri,
    method: "GET",
    json: true
  };
  command_utils.run("getRoleUsers", opts, requestOptions, cb);
};
