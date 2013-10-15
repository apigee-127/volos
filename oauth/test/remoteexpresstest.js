var remote = require('./remotetest');
var httphelper = require('../../common/httphelper');
var child_process = require('child_process');

var child;

describe('Remote Express test', function() {
  this.timeout(10000);
  before(function(done) {
    child = child_process.fork('./fixtures/expressserver');
    console.log('Spawned %d', child.pid);
    httphelper.waitForResponse('http://localhost:10010/ok', function() {
      console.log('Server is now up');
      done();
    });
  });

  it('Express server', function() {
    remote.runTests('localhost', 10010, function() {
     console.log('Killing %d', child.pid);
     child.kill();
    });
  });
});



