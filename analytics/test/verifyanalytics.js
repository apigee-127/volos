'use strict';

var assert = require('assert');
var should = require('should');
var request = require('supertest');
var debug = require('debug')('analyticstest');
var _ = require('underscore');

module.exports.verify = function(server) {
	it('must use push requests to buffer', function(done) {
		debug('GET /count');

		request(server)
			.get('/count')
			.end(function(err, res) {
				should.not.exist(err);
				res.status.should.equal(200);
				res.body.count.should.equal(0);
			});

		request(server)
			.get('/count')
			.end(function(err, res) {
				should.not.exist(err);
				res.status.should.equal(200);
				res.body.count.should.equal(1);
			});

		done();	
	});

	it('must flush', function(done) {
		debug('GET /count');
		request(server)
			.get('/count')
			.end(function(err, res) {
				should.not.exist(err);
				res.status.should.equal(200);
				res.body.count.should.equal(0);
				setTimeout(function () {
							request(server)
							.get('/count')
							.end(function(err, res) {
								should.not.exist(err);
								res.status.should.equal(200);
								res.body.count.should.equal(0);
								done();	
							});
						}, 1500);
			});
	});
};