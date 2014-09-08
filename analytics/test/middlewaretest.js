'use strict';

var memoryAnalytics = require('../memory');
var expressServer = require('./expressserver');
var verifyAnalytics = require('./verifyanalytics');


describe('Middleware', function() {
	
	var options = {
		bufferSize: 3,
		flushInterval: 10,
		batchSize : 3 
	};

	describe('Express', function() {
		var analytics = memoryAnalytics.create(options);
		var server = expressServer(analytics);
		verifyAnalytics.verify(server);
	});
});