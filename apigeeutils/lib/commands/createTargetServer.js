/* jshint node: true  */
'use strict';

const util = require('util'),
      defaults = require('../defaults'),
      options = require('../options'),
      command_utils = require('./command-utils');

var descriptor = defaults.defaultDescriptor({
  environment: {
    name: 'Environment',
    shortOption: 'e',
    required: true,
    prompt: true
  },
  targetServerName: {
    name: 'Target Server Name',
    required: true,
    prompt: true
  },
  targetHost: {
        name: 'Target Host',
    required: true,
    prompt: true
  },
  targetEnabled: {
        name: 'Target Enabled'
  },
  targetPort: {
        name: 'Target Port',
        required: true,
    prompt: true
  },
  targetSSL:{
        name: 'SSL Info'
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function(opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log('createTargetServer: %j', opts);
  }
  var payload  = {
                  "name" : opts.targetServerName,
                  "host" : opts.targetHost,
                  "isEnabled" : opts.targetEnabled? opts.targetEnabled:true,
                  "port" : opts.targetPort,
        }
        if(opts.targetSSL){
                payload.sSLInfo = {enabled: true}
        }

        var uri = util.format('%s/v1/o/%s/e/%s/targetservers', opts.baseuri, opts.organization, opts.environment);
        var requestOpts = {
                uri: uri,
                method:'POST',
                body: payload,
                json:true
        }
        command_utils.run('createTargetServer',opts, requestOpts, cb)
};
