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
		record['client_received_start_timestamp'] = Date.now();
		record['recordType']   = 'APIAnalytics';
		record['apiproxy']     = 'analyticsproxy';
		record['request_uri']  = req.protocol + '://' + req.headers.host + req.url;
		record['request_path'] = req.url.split('?')[0];
		record['request_verb'] = req.method;
		record['client_ip']    = req.connection.remoteAddress;
		record['useragent']    = req.headers['user-agent'];
		// record['client_sent_start_timestamp']
		// record['client_received_end_timestamp'] 
		onResponse(req, resp, function (err, summary) {
			record['response_status_code'] = resp.statusCode;
			record['client_sent_end_timestamp'] = Date.now();

			self.analytics.useAnalytics(record);

		});

		next();
	};
}