/* jshint node: true  */
'use strict';

var fs = require('fs');
var path = require('path');

module.exports.readdirSyncFilesOnly = function(p) {
  var allFiles = fs.readdirSync(p);
  var files = [];
  for (var f in allFiles) {
    var fn = path.join(p, allFiles[f]);
    var s = fs.statSync(fn);
    if (s.isFile()) {
      files.push(allFiles[f]);
    }
  }
  return files;
};
