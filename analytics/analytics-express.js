'use strict';

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
		self.analytics.useAnalytics(req, resp);
		next();
	};
}