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

var commonTest = require('../../test/mgmttest');
var config = require('../../../testconfig/testconfig-redis');
var should = require('should');

var TEST_DEVELOPER_EMAIL = 'joe@schmoe.io';
var TEST_APP_NAME = 'APIDNA Unit Test App';

describe('Redis', function() {

  commonTest.testManagement(config);

  describe('Management SPI', function() {

    it('app name change should not strand developer app key', function(done) {

      var mgmt = config.management;
      var developer;
      var app;

      var js = {
        firstName: 'Joe',
        lastName: 'Schmoe',
        email: TEST_DEVELOPER_EMAIL,
        userName: 'joeschmoe'
      };
      mgmt.createDeveloper(js, function(err, dev) {
        if (err) { console.error('%j', err); }
        should.not.exist(err);
        developer = dev;

        var na = {
          name: TEST_APP_NAME,
          developerId: developer.id,
          scopes: 'scope1 scope2',
          attributes: { test1: 'foo', test2: 'bar' }
        };
        mgmt.createApp(na, function(err, newApp) {
          if (err) { console.error('%j', err); }
          should.not.exist(err);
          app = newApp;

          mgmt.getDeveloperApp(developer.email, na.name, function(err, reply) {
            if (err) { console.error('%j', err); }
            should.not.exist(err);
            should.exist(reply);

            var oldName = app.name;
            app.name = 'newname';
            mgmt.updateApp(app, function(err, updated) {
              if (err) { console.error('%j', err); }
              should.not.exist(err);
              should.exist(updated);
              updated.name.should.equal(app.name);

              // old app name
              mgmt.getDeveloperApp(developer.email, oldName, function(err) {
                should.exist(err);

                // old app name
                mgmt.getDeveloperApp(developer.email, app.name, function(err, reply) {
                  should.not.exist(err);
                  should.exist(reply);

                  done();
                });
              });
            });
          });
        });
      });
    })
  });
});
