'use strict'

var _ = require('underscore');


function Analytics(Spi, options) {
	this.Spi = Spi;
	this.recordsQueue = [];
	this.recordLimit = options.recordLimit;
	this.flushLimit = options.flushLimit;
	this.interval = options.interval;
}
module.exports = Analytics;

Analytics.prototype.useAnalytics = function(record, cb) {
	if(this.recordsQueue.length < this.recordLimit) {
		console.log("Pushing data");
		this.recordsQueue.push(record);
		console.log("Queue length: " + this.recordsQueue.length);
	}
	if(this.recordsQueue.length % this.interval == 0) {
		this.flush();
	}
};

Analytics.prototype.flush = function() {
	var self = this;
	this.Spi.useAnalytics(this.recordsQueue, function(err, result) {
			if(err) { console.log(err) };
			self.recordsQueue.splice(0,result.accepted);
			console.log(result.accepted + " elements uploaded");
		});
};

Analytics.prototype.expressMiddleWare = function() {
	var mw = require('./analytics-express.js');
	return new mw(this);
};