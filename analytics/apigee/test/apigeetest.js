/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2013 Apigee Corporation

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
'use strict';

var Spi = require('..');
var config = require('../../../testconfig/testconfig-apigee').config;
var commonTest = require('../../test/analyticstest');
var assert = require('assert');
var random = Math.random();
var _ = require('underscore');
var should = require('should');

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
      should.not.exist(err);
      if (retryRecords) {
        assert(retryRecords.length <= recordsQueue.length);
      }
      done();
    });
  });

  it('should compress before sending if so configured', function(done) {
    var options = extend(config, {
      recordLimit: 10000,
      proxy: 'testAnalytics',
      flushInterval: 100,
      uploadLength : 100,
      compress: true
    });
    var analytics = Spi.create(options);
    var recordsQueue = [record, record, record];

    analytics.spi.send = function send(compressed) {
      var zlib = require('zlib');
      zlib.gunzip(compressed, function(err, uncompressed) {
        var data = JSON.parse(uncompressed);
        recordsQueue.should.eql(data.records);
        done();
      });
    };

    analytics.spi.flush(recordsQueue);
  });
  
  describe('Common', function() {
    commonTest.testAnalytics(config, Spi);
  });

});