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

// todo: use a more efficient buffer structure

var debug = require('debug')('analytics');
var util = require('util');

var DEFAULT_BUFFERSIZE = 10000;
var DEFAULT_FLUSHINTERVAL = 5000; // in ms
var DEFAULT_BATCHSIZE = 500;

function Analytics(spi, options) {
	this.spi = spi;
	this.buffer = [];
  this.bufferSize = options.bufferSize ? convertNumber(options.bufferSize, 'bufferSize') : DEFAULT_BUFFERSIZE;
  this.flushInterval = options.flushInterval ? convertNumber(options.flushInterval, 'flushInterval') : DEFAULT_FLUSHINTERVAL;
  this.batchSize = options.batchSize ? convertNumber(options.batchSize, 'batchSize') : DEFAULT_BATCHSIZE;
  if (this.bufferSize <= 0) {
    throw new Error('bufferSize must be > 0');
  }
  if (this.flushInterval <= 0) {
    throw new Error('flushInterval must be > 0');
  }
  if (this.batchSize <= 0) {
    throw new Error('batchSize must be > 0');
  }
  if (this.batchSize > this.bufferSize) {
    throw new Error('batchSize must be <= bufferSize');
  }

  var self = this;
  this.intervalObject = setInterval(function() {
    self.flush();
  }, this.flushInterval);
  this.intervalObject.unref();
}
module.exports = Analytics;

Analytics.prototype.apply = function(req, resp) {
	var self = this;
	this.spi.makeRecord(req, resp, function (err, record) {
		if (err) { throw err; }
		self.push(record);
	});
};

Analytics.prototype.destroy = function() {
  clearInterval(this.intervalObject);
  this.buffer = null;
};

  Analytics.prototype.push = function(record) {

	if (this.buffer.length < this.bufferSize) {
		this.buffer.push(record);
	} else {
    // todo: we ought to think about flushing or consolidating records if possible
    debug('buffer overflow, dropped pushed record')
  }
};

Analytics.prototype.flush = function() {
	var self = this;
	var recordsToFlush = self.buffer.splice(0, self.batchSize);
  if (recordsToFlush.length > 0) {
    debug('flushing %d records. %d records remaining.', recordsToFlush.length, self.buffer.length);
    self.spi.flush(recordsToFlush, function(err, retryRecords) {
      if (err && debug.enabled) {
        debug('error flushing: ' + err.message);
        if (retryRecords && retryRecords.length > 0) {
          debug('attempting to return %d records to buffer', retryRecords.length);
        }
      }
      // If some records failed to be pushed, add them back into the queue (up to bufferSize)
      if (retryRecords && retryRecords.length > 0) {
        var slotsInBuffer = self.bufferSize - self.buffer.length;
        if (slotsInBuffer < retryRecords.length) {
          retryRecords = retryRecords.slice(0, slotsInBuffer - 1);
        }
        self.buffer.concat(retryRecords);
        debug('returned %d records to buffer', retryRecords.length);
      }
    });
  }
};

Analytics.prototype.connectMiddleware = function() {
	var mw = require('./analytics-connect.js');
	return new mw(this);
};

Analytics.prototype.expressMiddleWare = Analytics.prototype.connectMiddleware;

function convertNumber(value, name) {
  if (typeof value === 'string') {
    return parseInt(value, 10);
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(name + ' must be a string or a number');
  }
}
