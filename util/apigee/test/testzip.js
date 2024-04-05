const assert = require('assert'),
      fs = require('fs'),
      find = require('lodash.find'),
      ziputils = require('../lib/ziputils');

const LONG_TIMEOUT = 8000;

describe('ZIP Utilities Test', function() {
  it('Create one file archive', function(done) {
    var data = 'Hello, World!';

    assert(data.length > 0);

    ziputils.makeOneFileZip('./', 'root', data)
      .then( buf => {
        let s = Object.prototype.toString.call(buf);
        //console.log(`typeof buffer: ${s}\n`);
        fs.writeFileSync('./test.zip', buf);
        done();
      });
  });

  it('ZIP whole directory', function(done) {
    ziputils.zipDirectory('./test/fixtures', function(err, result) {
      assert(!err);
      assert(result.length > 0);
      fs.writeFileSync('./testdir.zip', result);
      done();
    });
  }, LONG_TIMEOUT);

  it('Enumerate node file list', function(done) {
    ziputils.enumerateDirectory('./test/fixtures/employeesnode', 'node', false, function(err, files) {
      if (err) { return done(err); }

      //console.log('%j', files);

      // Should contain README.md
      let readme = find(files, function(f) {
        return (f.fileName === 'test/fixtures/employeesnode/README.md');
      });
      assert(readme);
      assert.equal(readme.fileName, 'test/fixtures/employeesnode/README.md');
      assert.equal(readme.resourceName, 'README.md');
      assert.equal(readme.resourceType, 'node');
      assert(!readme.directory);

      // Should not contain an entry for the toplevel "node_modules" directory
      let topModules = find(files, function(f) {
        return (f.fileName === 'test/fixtures/employeesnode/node_modules');
      });
      assert(!topModules);

      // Should contain "node_modules/express"
      var express = find(files, function(f) {
        return (f.fileName === 'test/fixtures/employeesnode/node_modules/express');
      });
      assert(express);
      assert.equal(express.fileName, 'test/fixtures/employeesnode/node_modules/express');
      assert.equal(express.resourceName, 'node_modules_express.zip');
      assert(express.directory);

      done();
    });
  });

  it('Enumerate regular file list', function() {
    var files =
      ziputils.enumerateResourceDirectory('./test/fixtures/employees/apiproxy/resources');

    assert.equal(files.length, 7);
    assert(files.find( f => f.fileName.endsWith("hello.js") && f.resourceType == "jsc"));
    assert(files.find( f => f.fileName.endsWith("config.js")));
    assert(files.find( f => f.fileName.endsWith("package.json")));
    assert(files.find( f => f.fileName.endsWith("node_modules.zip")));
    //console.log('%j', files);
  });
});
