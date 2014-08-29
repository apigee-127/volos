'use strict';

var Analytics = require('./analytics.js');

var create = function() {
	var spi = new ApigeeAnalyticsSpi();
	return new Analytics(spi);
};
module.exports.create = create;

var ApigeeAnalyticsSpi = function() {
	this.something = "Something";
};

ApigeeAnalyticsSpi.prototype.useAnalytics = function(recordsQueue, numUpload) {
	var recordsToBeUploaded = recordsQueue.slice(0, numUpload);
	console.log(recordsToBeUploaded);
};