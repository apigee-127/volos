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
//var memoryCache = require('../memory');
var memoryCache = require('../redis');
var expressServer = require('./expressserver');
var argoServer = require('./argoserver');
var async = require('async');
var _ = require('underscore');

var ttl = 20;

describe('Middleware', function() {

  var options = {
    ttl: ttl
  };

  describe('Express', function() {
    var cache = memoryCache.create('express', options);
    var server = expressServer(cache);
    verifyCache(server);
  });

  describe('Argo', function() {
    var cache = memoryCache.create('argo', options);
    var server = argoServer(cache);
    verifyCache(server);
  });
});

function verifyCache(server) {

  it('must cache', function(done) {
    request(server)
      .get('/count')
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.eql(200);
        should.exist(res.header['cache-control']);
        res.body.count.should.equal(1);
        var headers = res.headers;

        request(server)
          .get('/count')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);
            res.body.count.should.equal(1);
            _.keys(headers).length.should.equal(_.keys(res.headers).length);

            request(server)
              .get('/count')
              .end(function(err, res) {
                should.not.exist(err);
                res.status.should.eql(200);
                res.body.count.should.equal(1);
                _.keys(headers).length.should.equal(_.keys(res.headers).length);

                done();
              });
          });
      });
  });

  it('must timeout', function(done) {
    setTimeout(function() {
      request(server)
        .get('/count')
        .end(function(err, res) {
          should.not.exist(err);
          res.status.should.eql(200);
          res.body.count.should.equal(2);

          request(server)
            .get('/count')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              res.body.count.should.equal(2);

              done();
            });
        });
    }, ttl + 1);
  });

  it('must allow string id override', function(done) {
    request(server)
      .get('/countId')
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.eql(200);
        res.body.count.should.equal(2);

        done();
      });
  });

  it('must allow function id override', function(done) {
    request(server)
      .get('/countIdFunction')
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.eql(200);
        res.body.count.should.equal(2);

        done();
      });
  });

  it('must be repeatable', function(done) {

    var times = 50;
    var count = 3;
    var func = function(cb) {
      setTimeout(function() {
        request(server)
          .get('/count')
          .end(function(err, res) {
            should.not.exist(err);
            res.status.should.eql(200);
            res.body.count.should.equal(count);

            request(server)
              .get('/count')
              .end(function(err, res) {
                should.not.exist(err);
                res.body.count.should.equal(count++);
              });
          });
        cb();
      }, ttl + 10);
    };
    for (var funcs = []; funcs.length < times;) { funcs.push(func); }

    async.series(funcs, done);
  });

  it('must be parallel', function(done) {

    var concurrent = 3;
    var times = 50;

    var task = function(cb) {
      request(server)
        .get('/count')
        .end(function(err, res) {
          should.not.exist(err);
          res.status.should.eql(200);
          cb(err);
        });
    };

    for (var tasks = []; tasks.length < times;) { tasks.push(task); }
    var thread = function(cb) {
      async.series(tasks, cb);
    };
    for (var threads = []; threads.length < concurrent;) { threads.push(thread); }
    async.parallel(threads, done);
  });
}
