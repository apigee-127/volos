var remote = require('./remotetest');
var httphelper = require('../../common/httphelper');
var child_process = require('child_process');

var child;

describe('Remote Argo test', function() {
  this.timeout(10000);
  before(function(done) {
    child = child_process.fork('./fixtures/argoserver');
    console.log('Spawned %d', child.pid);
    httphelper.waitForResponse('http://localhost:10011/ok', function() {
      console.log('Server is now up');
      done();
    });
  });

  it('Argo server', function() {
    remote.runTests('http://localhost:10011', function() {
     console.log('Killing %d', child.pid);
     child.kill();
    });
  });
});
