/* jshint node: true  */
'use strict';

const util = require('util'),
      defaults = require('../defaults'),
      options = require('../options');

var descriptor = defaults.defaultDescriptor({
  'productName': {
    name: 'Product Name',
    required: true
  },
  'displayName': {
    name: 'Display Name'
  },
  'productDesc': {
        name: 'Description'
  },
  'proxies': {
    name: 'API Proxies',
    required: true
  },
  'environments':{
        name: 'Environments',
        required: true
  },
  'approvalType': {
        name: 'Approval Type',
        required: true
  },
  'quota' : {
        name: 'Quota',
  },
  'quotaInterval':{
        name: 'Quota Interval'
  },
  'quotaTimeUnit': {
        name:'Quota Time Unit'
  },
  'scopes': {
        name: "Scope",
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function(opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log('createProduct: %j', opts);
  }
  var request = defaults.defaultRequest(opts);
  createProduct(opts, request, function(err, results) {
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

function createProduct(opts,request,done){
        var product = {
          "approvalType": "auto",
          "attributes":
            [ {"name": "access", "value": "public"} ],
          "scopes": []
        }

        product.name = opts.productName
        if(opts.displayName){
                product.displayName = opts.displayName
        }else{
                product.displayName = opts.productName
        }
        product.description = opts.productDesc
        if(opts.approvalType){
                product.approvalType = opts.approvalType
        }
        product.proxies = []
        if(opts.proxies){
                var split = opts.proxies.split(',')
                split.forEach(function(s){
                        if(s && s.trim()!= '') {
                                product.proxies.push(s.trim())
                        }
                })
        }
        product.apiResources = []
        if(opts.apiResources){
                var split = opts.apiResources.split(',')
                split.forEach(function(s){
                        if(s && s.trim()!= '') {
                                product.apiResources.push(s.trim())
                        }
                })
        }
        if(opts.attributes) {
                product.attributes = opts.attributes;
        }
        if(opts.scopes){
                var split = opts.scopes.split(',')
                split.forEach(function(s){
                        if(s && s.trim()!= '') {
                                product.scopes.push(s.trim())
                        }
                })
        }
        product.environments = []
        if(opts.environments){
                var split = opts.environments.split(',')
                split.forEach(function(s){
                        if(s && s.trim()!= '') {
                                product.environments.push(s.trim())
                        }
                })
        }
        if(opts.quota && opts.quotaInterval && opts.quotaTimeUnit){
                product.quota = opts.quota
                product.quotaInterval = opts.quotaInterval
                product.quotaTimeUnit = opts.quotaTimeUnit
        }

        var uri = util.format('%s/v1/o/%s/apiproducts', opts.baseuri, opts.organization);
        request({
                uri: uri,
                method:'POST',
                body: product,
                json:true
        },function(err,res,body){
                var jsonBody = body
                if(err){
                        if (opts.debug) {
                       console.log('Error occured %s', err);
                    }
                        done(err)
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
                console.error('Create Product result: %j', body);
              }
              var errMsg;
              if (jsonBody && (jsonBody.message)) {
                errMsg = jsonBody.message;
              } else {
                errMsg = util.format('Create Product failed with status code %d', res.statusCode);
              }
              done(new Error(errMsg));
        }
        })
}
