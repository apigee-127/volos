'use strict';

var Analytics = require('./analytics.js');
var onResponse = require('on-response');
var superagent = require('superagent');

var create = function(options) {
  var spi = new ApigeeAnalyticsSpi(options);
  return new Analytics(spi, options);
};
module.exports.create = create;

var ApigeeAnalyticsSpi = function(options) {
  if (!options.uri) {
    throw new Error('uri parameter must be specified');
  }
  if (!options.key) {
    throw new Error('key parameter must be specified');
  }
  this.uri = options.uri;
  this.key = options.key;
  //See if analytics is allowed or not
};

ApigeeAnalyticsSpi.prototype.useAnalytics = function(recordsQueue, cb) {
  var recordsToBeUploaded = {};
  recordsToBeUploaded.records = recordsQueue;
  
  superagent.agent().
  post(this.uri + 'v2/analytics/accept').
  set('x-DNA-Api-Key', this.key).
  set('Content-Type', 'application/json').
  send(JSON.stringify(recordsToBeUploaded)).
  end(function(err, resp) {
    if(err) {
      cb(err)
    } else {
      if(resp.statusCode != 200) {
        var errString = resp.statusCode + ": " + resp.body;
        cb(errString);
      } else {
        cb(undefined, resp.body);
      }
    }
  });
};

ApigeeAnalyticsSpi.prototype.makeRecord = function(req, resp, cb) {
  var record = {};
  record['client_received_start_timestamp'] = Date.now();
  record['recordType']   = 'APIAnalytics';
  record['apiproxy']     = 'analyticsproxy';
  record['request_uri']  = req.protocol + '://' + req.headers.host + req.url;
  record['request_path'] = req.url.split('?')[0];
  record['request_verb'] = req.method;
  record['client_ip']    = req.connection.remoteAddress;
  record['useragent']    = req.headers['user-agent'];
  
  onResponse(req, resp, function (err, summary) {
    record['response_status_code'] = resp.statusCode;
    record['client_sent_end_timestamp'] = Date.now();
    // self.analytics.useAnalytics(record);
    cb(undefined, record);
  });
}