const options = require('./options');
const fns = require('./fns');

var DefaultDefaults = {};

function runCommand(cmd, opts, cb) {
  options.validate(opts, cmd.descriptor, e => {
    if (e) {
      cb(e);
      return;
    }
    cmd.run(opts, cb);
  });
}

function ApigeeUtils(defaults) {
  this.defaults = (defaults ? defaults : DefaultDefaults);
}

ApigeeUtils.getPromiseSDK = () => require('./promisesdk');
ApigeeUtils.defaults = (newDefaults) => new ApigeeUtils(newDefaults);

fns.forEach(fnName => {
  ApigeeUtils[fnName] = (opts, cb) => runCommand(require(`./commands/${fnName}`), opts, cb);
});

module.exports = ApigeeUtils;
