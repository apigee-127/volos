'use strict';
var onResponse = require('on-response');


function AnalyticsExpress(analytics, options) {
	if (!(this instanceof AnalyticsExpress)) {
		return new AnalyticsExpress(analytics, options);
	}
	this.analytics = analytics;
	this.options = options;
}
module.exports = AnalyticsExpress;

AnalyticsExpress.prototype.useAnalytics = function() {
	var self = this;

	return function(req, resp, next) {
		var record = {};
		record['request_uri'] = req.headers.host + req.url;
		record['request_path'] = req.url.split('?')[0];
		record['request_verb'] = req.method;
		record['client_ip'] = req.connection.remoteAddress;
		record['useragent'] = req.headers['user-agent'];

		onResponse(req, resp, function (err, summary) {
			record['statusCode'] = resp.statusCode;
			self.analytics.useAnalytics(record);
		});

		next();
	};
}