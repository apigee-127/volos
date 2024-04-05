/* jshint node: true  */
'use strict';

const async = require('async'),
      util = require('util'),
      path = require('path'),
      fs = require('fs-extra'),
      tar = require('tar-fs'),
      zlib = require('zlib'),
      spawn = require('child_process').spawn,
      mustache = require('mustache'),
      unzip = require('node-unzip-2'),
      tmp = require('tmp');

tmp.setGracefulCleanup();

const ziputils = require('./ziputils');

const DeploymentDelay = 60;
const ProxyBase = 'apiproxy';

module.exports.createApiProxy = function(opts, request, done) {
  // Create a dummy "API proxy" file for the root of this thing.
  var rootDoc = mustache.render('<APIProxy name="{{api}}"/>', opts);
  var rootEntryName = opts.api + '.xml';

  var uri = util.format('%s/v1/o/%s/apis?action=import&validate=false&name=%s',
                        opts.baseuri, opts.organization, opts.api);
  if (opts.debug) {
    console.log('Calling %s', uri);
  }
  if (opts.verbose) {
    console.log('Creating revision %d of API %s', opts.deploymentVersion,
               opts.api);
  }
  // The only way to do this is to import a ZIP. What fun.
  ziputils
    .makeOneFileZip(ProxyBase, rootEntryName, rootDoc)
    .then(zipBuf => {
      // For debugging
      fs.writeFileSync('./test.zip', zipBuf);
      request({
        uri: uri,
        headers: { 'Content-Type': 'application/octet-stream' },
        json: false,
        method: 'POST',
        body: zipBuf
      }, function(err, req, body) {
        proxyCreationDone(err, req, body, opts, done);
      });
    });
}

module.exports.createProxy = function(opts, request, done) {
  let vhostStr = (opts.virtualhosts ? opts.virtualhosts : 'default,secure');
  let vhosts = vhostStr.split(',').map(name => ({name}));
  let basepath = (opts['base-path'] ? opts['base-path'] : '/');

  var targetDoc = mustache.render(
    '<ProxyEndpoint name="default">' +
    '<PreFlow name="PreFlow"/>' +
    '<PostFlow name="PostFlow"/>' +
    '<HTTPProxyConnection>' +
    '<BasePath>{{basepath}}</BasePath>' +
    '{{#vhosts}}<VirtualHost>{{name}}</VirtualHost>{{/vhosts}}' +
    '</HTTPProxyConnection>' +
    '<RouteRule name="default">' +
    '<TargetEndpoint>default</TargetEndpoint>' +
    '</RouteRule>' +
      '</ProxyEndpoint>',
        { vhosts, basepath });
  if (opts.debug) {
    console.log('vhosts = %j', vhosts);
    console.log('proxy = %s', targetDoc);
  }

  var uri = util.format('%s/v1/o/%s/apis/%s/revisions/%d/proxies?name=default',
              opts.baseuri, opts.organization, opts.api,
              opts.deploymentVersion);
  if (opts.verbose) {
    console.log('Creating the proxy endpoint');
  }

  request({
    uri: uri,
    method: 'POST',
    json: false,
    headers: { 'Content-Type': 'application/xml' },
    body: targetDoc
  }, function(err, req, body) {
    handleUploadResult(err, req, 'proxies/default.xml', done);
  });
}

module.exports.deployProxy = function(opts, request, done) {
  if (opts['import-only']) {
    if (opts.verbose) {
      console.log('Not deploying the proxy right now');
    }
    done();
    return;
  }

  if (opts.verbose) {
    console.log('Deploying revision %d of %s to %s', opts.deploymentVersion,
                opts.api, opts.environments);
  }

  var environments = opts.environments.split(',');

  function deployToEnvironment(environment, done) {

    var uri = util.format('%s/v1/o/%s/e/%s/apis/%s/revisions/%d/deployments',
      opts.baseuri, opts.organization, environment, opts.api,
      opts.deploymentVersion);

    if (opts.debug) { console.log('Going to POST to %s', uri); }

    // Unlike "deployproxy" command, ignore the base path here, because we baked it into the proxy definition.
    var deployCmd = util.format('action=deploy&override=true&delay=%d', DeploymentDelay);

    if (opts.debug) { console.log('Going go send command %s', deployCmd); }

    request({
      uri: uri,
      method: 'POST',
      json: false,
      body: deployCmd,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    }, function(err, req, body) {
      if (err) { return done(err); }

      var jsonBody = (body ? JSON.parse(body) : null);

      if (req.statusCode === 200) {
        if (opts.verbose) { console.log('Deployment on %s successful', environment); }
        if (opts.debug) { console.log('%s', body); }
        return done(undefined, jsonBody);
      }

      if (opts.verbose) { console.error('Deployment on %s result: %j', environment, body); }
      var errMsg;
      if (jsonBody && (jsonBody.message)) {
        errMsg = jsonBody.message;
      } else {
        errMsg = util.format('Deployment on %s failed with status code %d', environment, req.statusCode);
      }
      done(new Error(errMsg));
    });
  }

  var tasks = {};
  environments.forEach(function(env) {
    tasks[env] = deployToEnvironment.bind(this, env);
  });

  async.parallel(tasks, done);
}

module.exports.unzipProxy = function(opts, destDir, ignoreDir, cb) {

    if (opts.debug) { console.log('Extracting proxy to', destDir); }

    var count = 1;
    var called = false;
    function done(err) {
      if (!called) {
        count--;
        if (err || count === 0) { cb(err); }
      }
    }

    fs.createReadStream(opts.file)
      .pipe(unzip.Parse())
      .on('error', done)
      .on('close', done)
      .on('entry', function (entry) {
        if (entry.path.indexOf(ignoreDir) === 0) {
          if (opts.debug) { console.log('skipping', entry.path); }
          entry.autodrain(); // ignore all hosted resources
        } else {
          count++;
          if (opts.debug) { console.log('extracting', entry.path); }
          var destFile = path.resolve(destDir, entry.path);
          mkdirs(path.dirname(destFile), function(err) {
            if (err) { return cb(err); }

            entry
              .pipe(fs.createWriteStream(destFile))
              .on('error', done)
              .on('close', done);
          });
        }
      });
  }

module.exports.handleUploadResult = handleUploadResult;

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

function mkdirs(dirpath, cb) {

  var parts = dirpath.split(path.sep);
  var start = 1;
  if (dirpath[0] === path.sep) {
  parts[0] = '/';
  start = 2;
  }
  for (var i = start; i <= parts.length; i++) {
  try {
      var dir = path.join.apply(null, parts.slice(0, i));
      fs.mkdirSync(dir);
  } catch (err) {
      if (err.code !== 'EEXIST') { return cb(err); }
  }
  }
  cb();
}

module.exports.copyFile = function(source, target, cb) {

  let cbCalled = false;
  function cb1() {
    if ( ! cbCalled) {
      cb.apply(null, arguments);
      cbCalled = true;
    }
  }

  mkdirs(path.dirname(target), function(err) {
    if (err) { return cb1(err); }
    let ws = fs.createWriteStream(target)
        .on('error', cb1)
        .on('close', cb1);
    fs.createReadStream(source)
        .pipe(ws)
        .on('error', cb1);
  });

};

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

function proxyCreationDone (err, req, body, opts, done) {
  if (err) {
    done(err);
  } else if ((req.statusCode === 200) || (req.statusCode === 201)) {
    done();
  } else {
    if (opts.verbose) {
      console.error('Proxy creation error:', body);
    }
    done(new Error(util.format('Proxy creation failed. Status code %d',
                   req.statusCode)));
  }
}
