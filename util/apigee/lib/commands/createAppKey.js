const util = require('util'),
      defaults = require('../defaults'),
      options = require('../options');

var descriptor = defaults.defaultDescriptor({
  developerId: {
    name: 'Developer Id',
    required: true
  },
  appName: {
    name: 'App Name',
    required: true
  },
  key: {
    name: 'Client Key',
    required: true
  },
  secret: {
    name: 'Client secret',
    required: true
  },
  apiProducts : {
    name: 'API Products',
    required: true
  }

});

module.exports.descriptor = descriptor;

module.exports.run = function(opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log('createAppKey: %j', opts);
  }
  var request = defaults.defaultRequest(opts);
  createAppKey(opts, request, function(err, results) {
    if (err) {
      cb(err);
    }
    else {
      if (opts.debug) {
        console.log('results: %j', results);
      }
      associateKeySecret(opts, request, function(err, results) {
        if (err) {
          cb(err);
        } else {
          if (opts.debug) {
            console.log('results: %j', results);
          }
          cb(undefined, results);
        }
      });
    }
  });
};

function createAppKey(opts,request,done) {
  var payload = {
        consumerKey : opts.key,
        consumerSecret : opts.secret
      };

  var uri = util.format('%s/v1/o/%s/developers/%s/apps/%s/keys/create',
                        opts.baseuri, opts.organization, opts.developerId, opts.appName);
  request({
    uri: uri,
    method:'POST',
    body: payload,
    json:true
  },function(err,res,body){
    var jsonBody = body;
    if(err){
      if (opts.debug) {
        console.log('Error occured %s', err);
      }
      done(err);
    }else if (res.statusCode === 201) {
      if (opts.verbose) {
        console.log('Create KeySecret successful');
      }
      if (opts.debug) {
        console.log('%s', body);
      }
      done(undefined, jsonBody);
    }else {
      if (opts.verbose) {
        console.error('Create KeySecret result: %j', body);
      }
      var errMsg;
      if (jsonBody && (jsonBody.message)) {
        errMsg = jsonBody.message;
      } else {
        errMsg = util.format('Create KeySecret failed with status code %d', res.statusCode);
      }
      done(new Error(errMsg));
    }
  });
}

function associateKeySecret(opts,request,done) {
  var prods = opts.apiProducts;
  if (typeof prods === 'string') {
    prods = [prods];
  }

  var payload = {
        apiProducts : prods
      };

  var uri = util.format('%s/v1/o/%s/developers/%s/apps/%s/keys/%s',
                        opts.baseuri, opts.organization, opts.developerId, opts.appName, opts.key);
  request({
    uri: uri,
    method:'POST',
    body: payload,
    json:true
  },function(err,res,body){
    var jsonBody = body;
    if(err){
      if (opts.debug) {
        console.log('Error occured %s', err);
      }
      done(err);
    }
    else if (res.statusCode === 200) {
      if (opts.verbose) {
        console.log('Associate KeySecret successful');
      }
      if (opts.debug) {
        console.log('%s', body);
      }
      done(undefined, jsonBody);
    }else {
      if (opts.verbose) {
        console.error('Associate KeySecret result: %j', body);
      }
      var errMsg;
      if (jsonBody && (jsonBody.message)) {
        errMsg = jsonBody.message;
      } else {
        errMsg = util.format('Associate KeySecret failed with status code %d', res.statusCode);
      }
      done(new Error(errMsg));
    }
  });
}
