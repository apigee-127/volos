'use strict'

var Spi = require('..');
var config = require('../../../testconfig/testconfig-apigee').config;
var commonTest = require('../../test/analyticsTest');
var assert = require('assert');
var random = Math.random();
var _ = require('underscore');
var should = require('should');
var nock = require('nock');

describe('Apigee', function() {

	function extend(a, b) {
		return _.extend({}, a, b);
	}

	var analytics;
	var record;

	before(function(done) {
		var options = extend(config, {
			recordLimit: 10000,
			proxy: 'testAnalytics',
			flushInterval: 100,
			uploadLength : 100
		});
		
		record = {
			client_received_start_timestamp : Date.now(),
			recordType   : 'APIAnalytics',
			apiproxy     : 'testAnalytics',
			request_uri  : 'http://example.com',
			request_path : '/path',
			request_verb : 'GET',
			response_status_code : 200,
			client_sent_end_timestamp : Date.now()
		};

		analytics = Spi.create(options);
		done();
	});
	
	it('should have an URI', function(done) {
		var options = {
			key: "key",
			bufferSize: 10,
			proxy: 'testAnalytics',
			flushInterval: 5,
			batchSize : 5 
		};
		
		assert.throws(function() {
			Spi.create(options);
		});
		done();
	});

	it('should have a key', function(done) {
		var options = {
			uri: "uri",
			bufferSize: 10,
			proxy: 'testAnalytics',
			flushInterval: 5,
			batchSize : 5 
		};
		assert.throws(function() {
			Spi.create(options);
		});
		done();
	});	

	it('should have a proxy', function(done) {
		var options = extend(config, {
			uri: "uri",
			key: "key",
			bufferSize: 10,
			flushInterval: 5,
			batchSize : 5 
		});
		assert.throws(function() {
			Spi.create(options);
		});
		done();
	});
	
	it('flush', function(done) {	
		var recordsQueue = [record, record, record];
		analytics.spi.flush(recordsQueue, function(err, retryRecords) {
			assert(!err);
			if(retryRecords) {
				assert(retryRecords.length <= recordsQueue.length);
			}
			done();
		});
	});
	
	describe('Common', function() {
		commonTest.testAnalytics(config, Spi);
	});

});