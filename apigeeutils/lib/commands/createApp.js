/* jshint node: true  */
'use strict';

const util = require('util'),
      defaults = require('../defaults'),
      options = require('../options');

var descriptor = defaults.defaultDescriptor({
  'name': {
    name: 'App Name',
    required: true
  },
  'apiProducts': {
        name: 'API Products',
        required: true
  },
  'email' : {
        name: 'Developer Email',
        required: true
  },
  'callback': {
        name:'Callback URL'
  }

});

module.exports.descriptor = descriptor;

module.exports.run = function(opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log('createApp: %j', opts);
  }
  var request = defaults.defaultRequest(opts);
  createApp(opts, request, function(err, results) {
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

function createApp(opts,request,done) {
  let app = {
        name : opts.name,
        apiProducts : [],
        callbackUrl: opts.callback
      };

  if(opts.attributes){
    app.attributes = opts.attributes;
  }

  if(opts.keyExpiresIn){
    app.keyExpiresIn = opts.keyExpiresIn;
  }

  if(opts.scopes){
    app.scopes = opts.scopes;
  }

  if(opts.apiProducts){
    opts.apiProducts.split(',')
    .forEach(function(s){
      if(s && s.trim()!= '') {
        app.apiProducts.push(s.trim());
      }
    });
  }

  let uri = util.format('%s/v1/o/%s/developers/%s/apps',
                        opts.baseuri, opts.organization,opts.email);
  request({
    uri: uri,
    method:'POST',
    body: app,
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
        console.log('Create successful');
      }
      if (opts.debug) {
        console.log('%s', body);
      }
      done(undefined, jsonBody);
    }else {
      if (opts.verbose) {
        console.error('Create App result: %j', body);
      }
      var errMsg;
      if (jsonBody && (jsonBody.message)) {
        errMsg = jsonBody.message;
      } else {
        errMsg = util.format('Create App failed with status code %d', res.statusCode);
      }
      done(new Error(errMsg));
    }
  });
}
