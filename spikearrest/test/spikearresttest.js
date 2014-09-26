/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2014 Apigee Corporation

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

var random = Math.random();
var _ = require('underscore');
var assert = require('assert');
var should = require('should');

exports.testSpikeArrest = function(config, Spi) {

  this.config = config;
  this.Spi = Spi;

  describe('SpikeArrest', function() {

    describe('options', function() {

      it('timeunit must be valid', function(done) {
        var options = extend(config, {
          timeUnit: 'hour',
          allow: 2
        });
        assert.throws(function() {
          Spi.create(options)
        });
        done();
      });

      it('allow must be a number', function(done) {
        var options = extend(config, {
          timeUnit: 'minute',
          allow: 'hey'
        });
        assert.throws(function() {
          Spi.create(options)
        });
        done();
      });

      describe('apply', function() {

        var ps;
        before(function() {
          var options = extend(config, {
            timeUnit: 'second',
            allow: 10
          });
          ps = Spi.create(options);
        });

        it('must have a key', function(done) {
          ps.apply({
            weight: 1
          }, function(err) {
            should.exist(err);
            done();
          });
        });

        it('must have a string key', function(done) {
          ps.apply({
            key: 1,
            weight: 1
          }, function(err) {
            should.exist(err);
            done();
          });
        });

        it('weight must be a number', function(done) {
          ps.apply({
            key: 'x',
            weight: 'x'
          }, function(err) {
            should.exist(err);
            done();
          });
        });

      });
    });


    describe('fast fail seconds', function() {

      var ps;
      before(function() {
        var options = extend(config, {
          timeUnit: 'second',
          allow: 100
        });
        ps = Spi.create(options);
      });

      it('should succeed when no spikes', function(done) {
        ps.apply({ key: 'x' }, function(err, reply) {
          should.not.exist(err);
          reply.allowed.should.equal(1);
          reply.used.should.equal(1);
          reply.isAllowed.should.be.true;
          reply.expiryTime.should.be.approximately(10, 2);
          done();
        });
      });

      it('should fail on a spike', function(done) {
        ps.apply({ key: 'y' }, function(err, reply) {
          should.not.exist(err);
          reply.allowed.should.equal(1);
          reply.used.should.equal(1);
          reply.isAllowed.should.be.true;
          reply.expiryTime.should.be.approximately(10, 2);

          setTimeout(function() {

            ps.apply({ key: 'y' }, function(err, reply) {
              should.not.exist(err);
              reply.allowed.should.equal(1);
              reply.used.should.equal(2);
              reply.isAllowed.should.be.false;
              reply.expiryTime.should.be.approximately(5, 2);

              setTimeout(function() {

                ps.apply({ key: 'y' }, function(err, reply) {
                  should.not.exist(err);
                  reply.allowed.should.equal(1);
                  reply.used.should.equal(1);
                  reply.isAllowed.should.be.true;
                  reply.expiryTime.should.be.approximately(10, 2);

                  done();
                });
              }, 6);
            });
          }, 5);
        });
      });
    });

    describe('smoothed minutes', function() {

      var ps;
      var window = 60000 / 6000;
      before(function() {
        var options = extend(config, {
          timeUnit: 'minute',
          allow: 6000,
          bufferSize: 5
        });
        ps = Spi.create(options);
      });

      it('should succeed when no spikes', function(done) {
        ps.apply({ key: 'x' }, function(err, reply) {
          should.not.exist(err);
          reply.allowed.should.equal(1);
          reply.used.should.equal(1);
          reply.isAllowed.should.be.true;
          reply.expiryTime.should.be.approximately(10, 2);
          done();
        });
      });

      it('should smooth a spike', function(done) {
        ps.apply({ key: 'y' }, function(err, reply) {
          should.not.exist(err);
          reply.allowed.should.equal(1);
          reply.used.should.equal(1);
          reply.isAllowed.should.be.true;
          reply.expiryTime.should.be.approximately(10, 2);

          ps.apply({ key: 'y' }, function(err, reply) {
            should.not.exist(err);
            reply.allowed.should.equal(1);
            reply.used.should.equal(1);
            reply.isAllowed.should.be.true;
            reply.expiryTime.should.be.approximately(10, 2);

            setTimeout(function() {

              ps.apply({ key: 'y' }, function(err, reply) {
                should.not.exist(err);
                reply.allowed.should.equal(1);
                reply.used.should.equal(1);
                reply.isAllowed.should.be.true;
                reply.expiryTime.should.be.approximately(10, 2);

                done();
              });
            }, 10);
          });
        });
      });

      it('should fail when buffer exceeded', function(done) {
        for (var i = 0; i < 6; i++) {
          ps.apply({ key: 'z' }, function() {});
        }
        ps.apply({ key: 'z' }, function(err, reply) {
          should.not.exist(err);
          reply.allowed.should.equal(1);
          reply.used.should.equal(2);
          reply.isAllowed.should.be.false;
          done();
        });
      });

    });
  });
};


// options.key (Non-object) required
// options.weight (Number) default = 1
// cb is invoked with first parameter error, second with stats on the spike arrest

// clone & extend hash
function extend(a, b) {
  return _.extend({}, a, b);
}

// avoid run to run conflicts
function id(_id) {
  return 'test:' + random + ":" + _id;
}
