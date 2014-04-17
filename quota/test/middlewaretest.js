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

   describe('count', function() {
     it('must count correctly', function(done) {
       request(server)
         .get('/count')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(200);

           request(server)
             .get('/count')
             .end(function(err, res) {
               should.not.exist(err);
               res.status.should.eql(200);

               request(server)
                 .get('/count')
                 .end(function(err, res) {
                   should.not.exist(err);
                   res.status.should.eql(403);

                   done();
                 });
             });
         });
     });

     it('must allow string id override', function(done) {
       request(server)
         .get('/countId')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(403);

           done();
         });
     });

     it('must allow function id override', function(done) {
       request(server)
         .get('/countFunctionId')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(403);

           done();
         });
     });

     it('must allow weight number override', function(done) {
       request(server)
         .get('/countWeight')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(200);

           request(server)
             .get('/countWeight')
             .end(function(err, res) {
               should.not.exist(err);
               res.status.should.eql(403);

               done();
             });
         });
     });

     it('must allow weight function override', function(done) {
       request(server)
         .get('/countWeightFunc')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(200);

           request(server)
             .get('/countWeightFunc')
             .end(function(err, res) {
               should.not.exist(err);
               res.status.should.eql(403);

               done();
             });
         });
     });

     it('must allow weight and id override', function(done) {
       request(server)
         .get('/countWeightId')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(200);

           request(server)
             .get('/countWeight')
             .end(function(err, res) {
               should.not.exist(err);
               res.status.should.eql(403);

               done();
             });
         });
     });

     it('must allow weight and id function override', function(done) {
       request(server)
         .get('/countWeightIdFunction')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(200);

           request(server)
             .get('/countWeightIdFunction')
             .end(function(err, res) {
               should.not.exist(err);
               res.status.should.eql(403);

               done();
             });
         });
     });

   });

   describe('count per address', function() {

     it('must count correctly', function(done) {
       request(server)
         .get('/countPerAddress')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(200);

           request(server)
             .get('/countPerAddress')
             .end(function(err, res) {
               should.not.exist(err);
               res.status.should.eql(200);

               request(server)
                 .get('/countPerAddress')
                 .end(function(err, res) {
                   should.not.exist(err);
                   res.status.should.eql(403);

                   done();
                 });
             });
         });
     });

     it('must allow string id override', function(done) {
       request(server)
         .get('/countPerAddressId')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(403);

           done();
         });
     });

     it('must allow function id override', function(done) {
       request(server)
         .get('/countPerAddressFunctionId')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(403);

           done();
         });
     });

     it('must consider addresses', function(done) {
       request(server)
         .get('/countPerAddress')
         .set('x-forwarded-for', 'foo')
         .end(function(err, res) {
           should.not.exist(err);
           res.status.should.eql(200);

           request(server)
             .get('/countPerAddress')
             .set('x-forwarded-for', 'foo')
             .end(function(err, res) {
               should.not.exist(err);
               res.status.should.eql(200);

               request(server)
                 .get('/countPerAddress')
                 .set('x-forwarded-for', 'bar')
                 .end(function(err, res) {
                   should.not.exist(err);
                   res.status.should.eql(200);

                   request(server)
                     .get('/countPerAddress')
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
}
