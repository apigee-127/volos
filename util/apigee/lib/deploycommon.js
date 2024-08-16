/* jshint node: true  */
'use strict';

const async = require('async'),
      util = require('util'),
      path = require('path'),
      fs = require('fs-extra'),
      tar = require('tar-fs'),
      zlib = require('zlib'),
      spawn = require('child_process').spawn,
      tmp = require('tmp');

tmp.setGracefulCleanup();

const ziputils = require('./ziputils');


function handleUploadResult(err, req, fileName, itemDone) {
  if (err) {
    itemDone(err);
  } else if ((req.statusCode === 200) || (req.statusCode === 201)) {
    itemDone();
  } else {
    itemDone(new Error(util.format('Error uploading resource %s: %d\n%s',
      fileName, req.statusCode, req.body)));
  }
}


module.exports.uploadSource = function(sourceDir, type, opts, request, done) {
// Get a list of entries, broken down by which are directories
  ziputils.enumerateDirectory(sourceDir, type, opts.remoteNpm, function(err, entries) {
    if (err) { return done(err); }

    if (opts.debug) { console.log('Directories to upload: %j', entries); }

    async.eachLimit(entries, opts.asynclimit, function(entry, entryDone) {
      var uri =
        util.format('%s/v1/o/%s/apis/%s/revisions/%d/resources?type=%s&name=%s',
          opts.baseuri, opts.organization, opts.api,
          opts.deploymentVersion, type, entry.resourceName);
      if (entry.directory) {
        // ZIP up all directories, possibly with additional file prefixes
        ziputils.zipDirectory(entry.fileName, entry.zipEntryName, function(err, zipBuf) {
          if (err) {
            entryDone(err);
          } else {
            if (opts.verbose) {
              console.log('Uploading resource %s of size %d',  entry.resourceName, zipBuf.length);
            }
            request({
              uri: uri,
              method: 'POST',
              json: false,
              headers: { 'Content-Type': 'application/octet-stream' },
              body: zipBuf
            }, function(err, req, body) {
              handleUploadResult(err, req, entry.fileName, entryDone);
            });
          }
        });

      } else {
        if (opts.verbose) {
          console.log('Uploading resource %s', entry.resourceName);
        }
        var httpReq = request({
          uri: uri,
          method: 'POST',
          json: false,
          headers: { 'Content-Type': 'application/octet-stream' }
        }, function(err, req, body) {
          handleUploadResult(err, req, entry.fileName, entryDone);
        });

        var fileStream = fs.createReadStream(entry.fileName);
        fileStream.pipe(httpReq);
      }
    }, function(err) {
      done(err);
    });
  });
}

module.exports.usePackedSource = function(sourceDir, opts, cb) {
  if (opts.debug) {
    console.log('packaging bundled dependencies for upload')
  }

  tmp.dir(function(err, tempDir) {
    if (err) {
      return cb(err);
    }

    fs.copy(sourceDir, tempDir, function(err) {
      if (err) {
        return cb(err)
      }

      var cmd = 'npm' + (process.platform === 'win32' ? '.cmd' : '');
      var pack = spawn(cmd, ['pack'], {cwd: tempDir});
      pack.on('error', function(err) {
        return cb(err)
      });
      var packageName;

      pack.stdout.on('data', function(data) {
        packageName = data.toString().trim()
      });

      pack.on('close', function() {
        try {
          var packageArchive =  path.join(tempDir, packageName);
          fs.createReadStream(packageArchive).pipe(zlib.createGunzip()).pipe(tar.extract(tempDir)).on('finish', function() {
            fs.removeSync(packageArchive) // remove the pack archive so it doesn't show up in the proxy

            if (opts.debug) {
              console.log('bundled dependencies ready for upload')
            }

            // return path to packed directory
            return cb(undefined, path.join(tempDir, 'package'))
          }).on('error', function(err) {
            return cb(err);
          });
        } catch(err) {
          return cb(err)
        }
      });
    });
  });
}

