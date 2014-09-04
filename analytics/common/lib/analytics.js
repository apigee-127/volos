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

function Analytics(Spi, options) {
	this.Spi = Spi;
	this.recordsQueue = [];
	this.recordLimit = options.recordLimit || 10000;
	this.flushInterval = options.flushInterval || 200;
	this.uploadLength = options.uploadLength || 100;
}
module.exports = Analytics;

Analytics.prototype.useAnalytics = function(req, resp) {	
	var self = this;
	this.Spi.makeRecord(req, resp, function (err, record) {
		if (err) { throw err; }
		self.push(record);
	});
};

Analytics.prototype.push = function (record) {
	
	if (this.recordsQueue.length < this.recordLimit) {
		this.recordsQueue.push(record);
	}
	if (this.recordsQueue.length % this.flushInterval == 0) {
		this.flush();
	}
};

Analytics.prototype.flush = function() {
	var self = this;
	var recordsToBeUploaded = self.recordsQueue.splice(0, self.uploadLength);
	self.Spi.upload(recordsToBeUploaded, function (err, result) {
		// If some records failed to be pushed, add them back into the queue
		if (result.rejected > 0) {
			self.recordsQueue.concat(recordsToBeUploaded.splice(result.rejected, recordsToBeUploaded.length));
		}
	});
};

Analytics.prototype.expressMiddleWare = function() {
	var mw = require('./analytics-express.js');
	return new mw(this);
};
