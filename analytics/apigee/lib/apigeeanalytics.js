/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2014 Apigee Corporation

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
'use strict';

var Analytics = require('volos-analytics-common');
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
  if (!options.proxy) {
    throw new Error('Proxy parameter must be specified');
  }
  this.uri = options.uri;
  this.key = options.key;
  this.proxy = options.proxy;
  
  //TODO: Ping /v2/accept to see if analytics is allowed;
};

ApigeeAnalyticsSpi.prototype.flush = function(recordsQueue, cb) {
  var recordsToBeUploaded = {};
  recordsToBeUploaded.records = recordsQueue;
  superagent.agent()
    .post(this.uri + '/v2/analytics/accept')
    .set('x-DNA-Api-Key', this.key)
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(recordsToBeUploaded))
    .end(function(err, resp) {
      if (err || resp.statusCode != 200) {
        cb(err || new Error('error from server: ' + resp.statusCode), recordsToBeUploaded);
      } else {
        resp.body.rejected > 0 ? cb(undefined, recordsQueue.slice(recordsQueue.length - resp.body.rejected)) : cb();
      }
    });
    
};

ApigeeAnalyticsSpi.prototype.makeRecord = function(req, resp, cb) {
  var record = {};
  record['client_received_start_timestamp'] = Date.now();
  record['recordType']   = 'APIAnalytics';
  record['apiproxy']     = this.proxy;
  record['request_uri']  = req.protocol + '://' + req.headers.host + req.url;
  record['request_path'] = req.url.split('?')[0];
  record['request_verb'] = req.method;
  record['client_ip']    = req.connection.remoteAddress;
  record['useragent']    = req.headers['user-agent'];
  
  onResponse(req, resp, function (err, summary) {
    record['response_status_code'] = resp.statusCode;
    record['client_sent_end_timestamp'] = Date.now();
    cb(undefined, record);
  });
};
