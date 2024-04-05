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
  },
  email: {
    name: "EMail for the user",
    required: true,
    prompt: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("verifyUserRole: %j", opts);
  }

  let uri = util.format(
    "%s/v1/o/%s/userroles/%s/users/%s",
    opts.baseuri,
    opts.organization,
    opts.roleName,
    opts.email
  );
  let requestOptions = {
    uri,
    method: "GET",
    json: true
  };
  command_utils.run("verifyUserRole", opts, requestOptions, cb);
};
