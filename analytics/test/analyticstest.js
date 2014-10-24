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

var assert = require('assert');
var random = Math.random();
var _ = require('underscore');
var should = require('should');

// clone & extend hash
function extend(a, b) {
  return _.extend({}, a, b);
}

exports.testAnalytics = function(config, Spi) {
  this.config = config;
  this.Spi = Spi;

  var record;
  before(function(done) {
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
    done();
  });

  describe('Analytics', function() {

    describe('create', function() {

      it('bufferSize must be > 0', function(done) {
        var options = extend(config, {
          bufferSize: -5,
          proxy: 'testAnalytics',
          flushInterval: 100,
          batchSize : 100
        });
        assert.throws(function() {
          Spi.create(options);
        });
        done();
      });

      it('flushInterval must be > 0', function(done) {
        var options = extend(config, {
          bufferSize: 50,
          proxy: 'testAnalytics',
          flushInterval: -1,
          batchSize : 100
        });
        assert.throws(function() {
          Spi.create(options);
        });
        done();
      });

      it('batchSize must be > 0', function(done) {
        var options = extend(config, {
          bufferSize: 50,
          proxy: 'testAnalytics',
          flushInterval: 1000,
          batchSize : -100
        });
        assert.throws(function() {
          Spi.create(options);
        });
        done();
      });

      it('batchSize must be <= bufferSize', function(done) {
        var options = extend(config, {
          bufferSize: 50,
          proxy: 'testAnalytics',
          flushInterval: 100,
          batchSize : 100
        });
        assert.throws(function() {
          Spi.create(options);
        });
        done();
      });
    });

    describe('operation', function() {

      var a;

      afterEach(function() {
        if (a) {
          a.destroy();
          a = null;
        }
      });

      it('must push a record onto the records queue', function(done) {
        var options = extend(config, {
            bufferSize: 10,
            proxy: 'testAnalytics',
            flushInterval: 5000,
            batchSize : 5
          });
        a = Spi.create(options);
        var prevSize = a.buffer.length;
        a.push(record);
        a.buffer.length.should.be.exactly(prevSize + 1);
        done();
      });

      it('must not push when buffer is full', function(done) {
        var options = extend(config, {
            bufferSize: 2,
            proxy: 'testAnalytics',
            flushInterval: 5000,
            batchSize : 1
          });
        a = Spi.create(options);
        a.push(record);
        a.push(record);
        a.push(record);
        a.buffer.should.have.length(2);
        a.destroy();
        done();
      });

      it('must flush at intervals', function(done) {
        var options = extend(config, {
            bufferSize: 2,
            proxy: 'testAnalytics',
            flushInterval: 500,
            batchSize : 1
          });
        a = Spi.create(options);
        a.push(record);
        a.push(record);
        setTimeout(function() {
          console.log(a.buffer.length);
          a.buffer.length.should.be.below(2);
          a.destroy();
          done();
        }, options.flushInterval + 10);
      });
    });
  });
};