const assert = require('assert'),
      fs = require('fs'),
      fsutils = require('../lib/fsutils');

describe('Test File Stuff', function() {
  it('Test List Files', function() {
    var files = fs.readdirSync('./test/fixtures/data');
    assert(files.length >= 1);
  });

  it('Test List Files and Dirs', function() {
    var files = fs.readdirSync('./test/fixtures');
    assert(files.length >= 1);
  });

  it('Test readdirsyncFilesOnly', function() {
    var allFiles = fs.readdirSync('./test/fixtures');
    var fileMap = arrayToMap(allFiles);

    var filesOnly = fsutils.readdirSyncFilesOnly('./test/fixtures');
    assert(filesOnly.length > 1);
    for (var fn in filesOnly) {
      assert(fileMap[filesOnly[fn]]);
    }
  });
});

function arrayToMap(a) {
  var m = {};
  for (var i in a) {
    m[a[i]] = true;
  }
  return m;
}
