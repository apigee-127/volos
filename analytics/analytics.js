'use strict'

var _ = require('underscore');


function Analytics(Spi) {
	this.Spi = Spi;
	this.recordsQueue = []; 
}
module.exports = Analytics;

Analytics.prototype.useAnalytics = function(record) {
	this.recordsQueue.push(record);
	
	console.log(this.recordsQueue.length);
	
	if(this.recordsQueue.length % 2 == 0) {
		this.Spi.useAnalytics(this.recordsQueue, 2)
	}
	
};

Analytics.prototype.expressMiddleWare = function() {
	var mw = require('./analytics-express.js');
	return new mw(this);
};