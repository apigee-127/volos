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

var commonTest = require('../../test/mgmttest');
var config = require('../../../common/testconfig-redis');
var mgmt = config.management;
var should = require('should');
var creator = config.fixtureCreator;
var assert = require('assert');

describe('Redis', function() {

  describe('scopesMatching', function(done) {

    var app;

    before(function(done) {
      creator.createFixtures(function(err, apps) {
        if (err) {
          console.error('Error creating fixtures: %j', err);
        }
        app = apps[0];
        done();
      });
    });

    describe('Redis Update App', function() {
  
      it('Update App', function(done) {
        app.callbackUrl="http://localhost"
        mgmt.updateApp(app, function(err, foundApp) {
          assert.equal(foundApp.callbackUrl, app.callbackUrl);
          done();
        });
      });
    
    });

    it('GET /pigs', function(done) {
      mgmt.scopesMatching(app.id, 'GET', '/pigs', function(err, scopes) {
        scopes.should.be.instanceof(Array).and.have.lengthOf(1);
        scopes.should.include('scope1');
        done();
      });
    });

    it('GET /dogs', function(done) {
      mgmt.scopesMatching(app.id, 'GET', '/dogs', function(err, scopes) {
        scopes.should.be.instanceof(Array).and.have.lengthOf(1);
        scopes.should.include('scope2');
        done();
      });
    });

    it('GET /cats', function(done) {
      mgmt.scopesMatching(app.id, 'GET', '/cats', function(err, scopes) {
        scopes.should.be.instanceof(Array).and.have.lengthOf(2);
        scopes.should.include('scope1');
        scopes.should.include('scope2');
        done();
      });
    });

    it('POST /cats', function(done) {
      mgmt.scopesMatching(app.id, 'POST', '/cats', function(err, scopes) {
        scopes.should.be.instanceof(Array).and.have.lengthOf(2);
        scopes.should.include('scope1');
        scopes.should.include('scope2');
        done();
      });
    });

    it('DELETE /cats', function(done) {
      mgmt.scopesMatching(app.id, 'DELETE', '/cats', function(err, scopes) {
        scopes.should.be.instanceof(Array).and.have.lengthOf(0);
        done();
      });
    });

    it('GET /cat', function(done) {
      mgmt.scopesMatching(app.id, 'GET', '/cat', function(err, scopes) {
        scopes.should.be.instanceof(Array).and.have.lengthOf(3);
        done();
      });
    });

    it('GET /cats2', function(done) {
      mgmt.scopesMatching(app.id, 'GET', '/cats2', function(err, scopes) {
        scopes.should.be.instanceof(Array).and.have.lengthOf(3);
        done();
      });
    });

    it('GET /cats/dogs', function(done) {
      mgmt.scopesMatching(app.id, 'GET', '/cats/dogs', function(err, scopes) {
        scopes.should.be.instanceof(Array).and.have.lengthOf(3);
        done();
      });
    });

  });

  commonTest.testManagement(config);

});
