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

// todo: this will leak and strand records if flushInterval > batchSize
// todo: probably need a timer to drain records occasionally in addition to hitting batchSize
// todo: once we hit bufferSize, all operations will stop
// todo: on hitting bufferSize, we ought to flush or consolidate records or something
// todo: use a more efficient buffer

function Analytics(spi, options) {
	this.spi = spi;
	this.recordsQueue = [];
	this.bufferSize = options.bufferSize || 10000;
	this.flushInterval = options.flushInterval || 200;
	this.batchSize = options.batchSize || 100;
}
module.exports = Analytics;

Analytics.prototype.apply = function(req, resp) {
	var self = this;
	this.spi.makeRecord(req, resp, function (err, record) {
		if (err) { throw err; }
		self.push(record);
	});
};

Analytics.prototype.push = function (record) {
	
	if (this.recordsQueue.length < this.bufferSize) {
		this.recordsQueue.push(record);
	}
	if (this.recordsQueue.length % this.flushInterval == 0) {
		this.flush();
	}
};

Analytics.prototype.flush = function() {
	var self = this;
	var recordsToFlush = self.recordsQueue.splice(0, self.batchSize);
	self.spi.flush(recordsToFlush, function(err, result) {
    // todo: what about err?
		// If some records failed to be pushed, add them back into the queue
		if (result && result.rejected > 0) {
			self.recordsQueue.concat(recordsToFlush.splice(result.rejected, recordsToFlush.length));
		}
	});
};

Analytics.prototype.connectMiddleware = function() {
	var mw = require('./analytics-express.js');
	return new mw(this);
};

Analytics.prototype.expressMiddleWare = Analytics.prototype.connectMiddleware;
