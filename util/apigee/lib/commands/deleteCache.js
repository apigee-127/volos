/* jshint node: true  */
'use strict';

const util = require('util'),
      defaults = require('../defaults'),
      options = require('../options');

var descriptor = defaults.defaultDescriptor({
  environment: {
    name: 'Environment',
    shortOption: 'e',
    required: true
  },
  cache: {
    name: 'Cache Resource',
    shortOption: 'z',
    required: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function(opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log('deleteCache: %j', opts);
  }
  var request = defaults.defaultRequest(opts);
  deleteCache(opts, request, function(err, results) {
      if (err) {
        cb(err);
      } else {
        if (opts.debug) {
          console.log('results: %j', results);
        }
        cb(undefined, results);
      }
    });
};

function deleteCache(opts, request, done) {
  let uri = util.format('%s/v1/o/%s/e/%s/caches/%s',
                        opts.baseuri, opts.organization, opts.environment,opts.cache);
  request({
    uri,
    method:'DELETE',
    json:false
  },function(err,res,body){
    var jsonBody = body;
    if(err){
      done(err);
    }else if (res.statusCode === 200) {
      if (opts.verbose) {
        console.log('Delete successful');
      }
      if (opts.debug) {
        console.log('%s', body);
      }
      done(undefined, jsonBody);
    }else {
      if (opts.verbose) {
        console.error('Delete Cache result: %j', body);
      }
      var errMsg;
      if (jsonBody && (jsonBody.message)) {
        errMsg = jsonBody.message;
      } else {
        errMsg = util.format('Delete Cache failed with status code %d', res.statusCode);
      }
      done(new Error(errMsg));
    }
  });
}
