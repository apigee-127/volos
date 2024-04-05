const options = require('./options');
const fns = require('./fns');

var DefaultDefaults = {};

function runCommand(cmd, opts) {
  return new Promise((resolve, reject) => {
    options.validate(opts, cmd.descriptor, e => {
      if (e) {
        reject(e);
        return;
      }
      cmd.run(opts, (run_e, response) => {
        if (run_e) { reject(run_e); }
        else { resolve(response); }
      });
    });
  });
}

function ApigeeUtils(defaults) {
  this.defaults = (defaults ? defaults : DefaultDefaults);
}

ApigeeUtils.defaults = (newDefaults) => new ApigeeUtils(newDefaults);

fns.forEach(fnName => {
  ApigeeUtils[fnName] = (opts) => runCommand(require(`./commands/${fnName}`), opts);
});

module.exports = ApigeeUtils;
