'use strict';

/*
 * This is the set of tests that run remotely to a server.
 */

var should = require('should');
var request = require('supertest');

module.exports.verifyQuota = function(server) {

  describe('count', function() {
    it('must count correctly', function(done) {
      request(server)
        .get('/count')
        .end(function(err, res) {
          should.not.exist(err);
          res.status.should.eql(200);
          checkHeaders(res, 2, 1, 60);

          request(server)
            .get('/count')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              checkHeaders(res, 2, 0, 60);

              request(server)
                .get('/count')
                .end(function(err, res) {
                  should.not.exist(err);
                  res.status.should.eql(403);
                  checkHeaders(res, 2, -1, 60);

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
          checkHeaders(res, 2, 1, 60);

          request(server)
            .get('/countPerAddress')
            .set('x-forwarded-for', 'foo')
            .end(function(err, res) {
              should.not.exist(err);
              res.status.should.eql(200);
              checkHeaders(res, 2, 0, 60);

              request(server)
                .get('/countPerAddress')
                .set('x-forwarded-for', 'bar')
                .end(function(err, res) {
                  should.not.exist(err);
                  res.status.should.eql(200);
                  checkHeaders(res, 2, 1, 60);

                  request(server)
                    .get('/countPerAddress')
                    .set('x-forwarded-for', 'foo')
                    .end(function(err, res) {
                      should.not.exist(err);
                      res.status.should.eql(403);
                      checkHeaders(res, 2, -1, 60);

                      done();
                    });
                });
            });
        });
    });
  });
};

function checkHeaders(res, limit, remaining, reset) {
  parseInt(res.headers['x-ratelimit-limit']).should.equal(limit);
  parseInt(res.headers['x-ratelimit-remaining']).should.equal(remaining);
  parseInt(res.headers['x-ratelimit-reset']).should.be.approximately(reset, 5);
}
