/* jshint node: true  */
'use strict';

const util = require('util'),
      defaults = require('../defaults'),
      options = require('../options'),
      command_utils = require('./command-utils');

var descriptor = defaults.defaultDescriptor({
  roleName: {
    name: 'Role Name',
    required: true,
    prompt: true
  },
  permissions: {
    name: 'Permissions array for path and verbs',
    required: true,
    prompt: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function(opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log('setRolePermissions: %j', opts);
  }
  let permissions;
  if( opts.permissions ) {
    permissions = JSON.parse(opts.permissions);
  }
  let payload = {
        resourcePermission : permissions
      };
  let uri = util.format('%s/v1/o/%s/userroles/%s/resourcepermissions',
                        opts.baseuri, opts.organization, opts.roleName);
  let requestOptions = {
    uri,
    method:'POST',
    body: payload,
    json:true
      };
  command_utils.run('setRolePermissions', opts, requestOptions, cb);
};
