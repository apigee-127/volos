'use strict'

var _ = require('underscore');


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
		if(err) { //TODO
		}
		self.push(record);
	});
};

Analytics.prototype.push = function (record) {
	
	if(this.recordsQueue.length < this.recordLimit) {
		this.recordsQueue.push(record);
	}
	if(this.recordsQueue.length % this.flushInterval == 0) {
		this.flush();
	}
	// console.log("Queue Size: " + this.recordsQueue.length);
};

Analytics.prototype.flush = function() {
	var self = this;
	var recordsToBeUploaded = self.recordsQueue.splice(0, self.uploadLength);
	self.Spi.upload(recordsToBeUploaded, function (err, result) {
		//If some records failed to be pushed, add them back into the queue
		if (result.rejected > 0) {
			self.recordsQueue.concat(recordsToBeUploaded.splice(result.rejected, recordsToBeUploaded.length));
		}
	});

};

Analytics.prototype.expressMiddleWare = function() {
	var mw = require('./analytics-express.js');
	return new mw(this);
};