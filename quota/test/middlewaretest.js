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

var should = require('should');
var request = require('supertest');
var memoryQuota = require('../memory');
var expressServer = require('./expressserver');
var argoServer = require('./argoserver');

describe('Middleware', function() {

  describe('Express', function() {
    var options = {
      timeUnit: 'minute',
      interval: 1,
      allow: 2
    };
    var quota = memoryQuota.create(options);
    var server = expressServer(quota);
    verifyQuota(server);
  });

  describe('Argo', function() {
    var options = {
      timeUnit: 'minute',
      interval: 1,
      allow: 2
    };
    var quota = memoryQuota.create(options);
    var server = argoServer(quota);
    verifyQuota(server);
  });

});

 function verifyQuota(server) {

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

};
