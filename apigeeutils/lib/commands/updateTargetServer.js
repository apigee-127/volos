const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options"),
  command_utils = require("./command-utils");

var descriptor = defaults.defaultDescriptor({
  environments: {
    name: "Environments",
    shortOption: "e",
    required: true,
    prompt: true
  },
  targetServerName: {
    name: "Target Server Name",
    shortOption: "n",
    required: true,
    prompt: true
  },
  targetHost: {
    name: "Target Host",
    /* required: true, */
    prompt: true
  },
  targetEnabled: {
    name: "Target Enabled"
  },
  targetPort: {
    name: "Target Port",
    /* required: true, */
    prompt: true
  },
  targetSSL: {
    name: "SSL Info"
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("updateTargetServer: %j", opts);
  }
  let uri = util.format(
    "%s/v1/organizations/%s/environments/%s/targetservers/%s",
    opts.baseuri,
    opts.organization,
    opts.environments,
    opts.targetServerName
  );

  let { targetHost, targetPort, targetEnabled } = opts;

  let readTargetConfig = function (cb) {
    let requestOpts = {
      uri,
      method: "GET",
      json: true
    };
    command_utils.run(
      "readTargetServerConfig",
      opts,
      requestOpts,
      (e, json) => {
        if (e) return cb(e);
        // fill in any options not specified
        if (!targetHost) targetHost = json.host;
        if (!targetPort) targetPort = json.port;
        if (!("targetEnabled" in opts)) targetEnabled = json.isEnabled;
        cb();
      }
    );
  };

  let noop = (cb) => cb();

  // might need to retrieve the existing configuration
  let prepFn =
    !targetHost || !targetPort || !("targetEnabled" in opts)
      ? readTargetConfig
      : noop;

  prepFn((e) => {
    if (e) return cb(e);
    let payload = {
      name: opts.targetServerName,
      host: targetHost,
      isEnabled: targetEnabled,
      port: targetPort
    };

    if (opts.targetSSL) {
      // TODO: allow update of SSLInfo details
      payload.sSLInfo = { enabled: true };
    }

    let requestOpts = {
      uri,
      method: "PUT",
      body: payload,
      json: true
    };
    command_utils.run("updateTargetServer", opts, requestOpts, cb);
  });
};
