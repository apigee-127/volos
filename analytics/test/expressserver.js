'use strict';

var express = require('express');
var assert = require('assert');
var http = require('http');

module.exports = function(analytics) {
	var app = express();
	
	app.get('/count', 
		analytics.expressMiddleWare().apply(),
		function(req, resp) {
			resp.json({count: analytics.buffer.length});
		});

	return app;
};