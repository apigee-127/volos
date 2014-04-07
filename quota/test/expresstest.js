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
"use strict";

var should = require('should');
var request = require('supertest');
var _ = require('underscore');
var memoryQuota = require('../memory');
var expressServer = require('./expressserver');

describe('Express Middleware', function() {

  var server;

  before(function(done) {
    var options = {
      timeUnit: 'minute',
      interval: 1,
      allow: 2
    };
    var quota = memoryQuota.create(options);
    server = expressServer(quota);
    done();
  });

  it('must count correctly', function(done) {
    request(server)
      .get('/allDogs')
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.eql(200);

        request(server)
          .get('/allDogs')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);

            request(server)
              .get('/allDogs')
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(403);

                done();
              });
          });
      });
  });

  it('must count single per address', function(done) {
    request(server)
      .get('/dogsPerAddress')
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.eql(200);

        request(server)
          .get('/dogsPerAddress')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);

            request(server)
              .get('/dogsPerAddress')
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(403);

                done();
              });
          });
      });
  });

  it('must count multiple per address', function(done) {
    request(server)
      .get('/dogsPerAddress')
      .set('x-forwarded-for', 'foo')
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.eql(200);

        request(server)
          .get('/dogsPerAddress')
          .set('x-forwarded-for', 'foo')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);

            request(server)
              .get('/dogsPerAddress')
              .set('x-forwarded-for', 'bar')
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(200);

                request(server)
                  .get('/dogsPerAddress')
                  .set('x-forwarded-for', 'foo')
                  .end(function(err, res) {
                    should.not.exist(err);
                    res.status.should.eql(403);

                    done();
                  });
              });
          });
      });
  });

});

//describe('Quota SPI', function() {
//  var pm;
//  var ph;
//
//  before(function() {
//    var options = extend(config, {
//      timeUnit: 'minute',
//      interval: 1,
//      allow: 2
//    });
//    pm = Spi.create(options);
//  });
//
//  it('Basic per-minute', function(done) {
//    pm.apply({
//      identifier: id('One'),
//      weight: 1
//    }, function(err, result) {
//      assert(!err);
//      checkResult(result, 2, 1, true);
//
//      pm.apply({
//        identifier: id('Two'),
//        weight: 1
//      }, function(err, result) {
//        assert(!err);
//        checkResult(result, 2, 1, true);
//
//        pm.apply({
//          identifier: id('One'),
//          weight: 1
//        }, function(err, result) {
//          assert(!err);
//          checkResult(result, 2, 2, true);
//
//          pm.apply({
//            identifier: id('One'),
//            weight: 1
//          }, function(err, result) {
//            assert(!err);
//            checkResult(result, 2, 3, false);
//            done();
//          });
//        });
//      });
//
//    });
//  });
