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
    console.log("assignUserRole: %j", opts);
  }

  let body = util.format("id=%s", encodeURIComponent(opts.email));
  let uri = util.format(
    "%s/v1/o/%s/userroles/%s/users",
    opts.baseuri,
    opts.organization,
    opts.roleName
  );
  let requestOptions = {
    uri,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    json: true
  };
  command_utils.run("assignUserRole", opts, requestOptions, cb);
};
