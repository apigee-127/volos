const defaults  = require('../defaults'),
      util      = require('util');

module.exports.run = function(command, opts, requestOpts, done) {
  if (opts.verbose) {
    console.log(`${command} - ${requestOpts.method} ${requestOpts.uri}`);
  }
  var request = defaults.defaultRequest(opts);
  request(requestOpts, function(err, res, jsonBody) {
    if(err){
      done(err);
      return;
    }
    if (res.statusCode == 200 || res.statusCode == 201 || res.statusCode == 204) {
      if (opts.verbose) {
        console.log(`${command} - success`);
      }
      if (opts.debug) {
        console.log('%s', jsonBody);
      }
      done(undefined, jsonBody);
      return;
    }
    if (opts.verbose) {
      console.error(command + ' result: %j', jsonBody);
    }
    let errMsg = (jsonBody && (jsonBody.message)) ?
      jsonBody.message :
      util.format(command + ' failed with status code %d', res.statusCode);

    done(new Error(errMsg));
  });
};
