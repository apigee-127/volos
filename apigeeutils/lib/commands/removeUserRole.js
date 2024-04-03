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
    name: "Developer email",
    required: true,
    prompt: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("removeUserRole: %j", opts);
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
    method: "DELETE",
    json: true
  };
  command_utils.run("removeUserRole", opts, requestOptions, cb);
};
