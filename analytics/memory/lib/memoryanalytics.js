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
var EventEmitter = require('events').EventEmitter;
var util = require('util');

// events: makeRecord, flush
var create = function(options) {
  var spi = new MemoryAnalyticsSpi(options);
  return new Analytics(spi, options);
};
module.exports.create = create;

var MemoryAnalyticsSpi = function(options) {
  EventEmitter.call(this);
};
util.inherits(MemoryAnalyticsSpi, EventEmitter);

MemoryAnalyticsSpi.prototype.flush = function(recordsQueue, cb) {
  this.emit('flush', recordsQueue);
  cb();
};

MemoryAnalyticsSpi.prototype.makeRecord = function(req, resp, cb) {
  var record = {};
  record['client_received_start_timestamp'] = Date.now();
  record['recordType']   = 'APIAnalytics';
  record['request_uri']  = req.protocol + '://' + req.headers.host + req.url;
  record['request_path'] = req.url.split('?')[0];
  record['request_verb'] = req.method;
  record['client_ip']    = req.connection.remoteAddress;
  record['useragent']    = req.headers['user-agent'];

  var self = this;
  onResponse(req, resp, function(err, summary) {
    record['response_status_code'] = resp.statusCode;
    record['client_sent_end_timestamp'] = Date.now();
    cb(undefined, record);
    self.emit('makeRecord', record);
  });
};
