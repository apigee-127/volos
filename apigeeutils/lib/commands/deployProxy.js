/* jshint node: true  */
'use strict';

const constants = require('constants'),
      util = require('util'),
      path = require('path'),
      async = require('async'),
      fs = require('fs'),
      mustache = require('mustache');

var defaults = require('../defaults');
var fsutils = require('../fsutils');
var options = require('../options');
var ziputils = require('../ziputils');
var parseDeployments = require('./parseDeployments');
var usePackedSource = require('../deploycommon').usePackedSource;
var uploadSource = require('../deploycommon').uploadSource;
var cleanResults = require('../utils').cleanResults;

const ProxyBase = 'apiproxy',
      XmlExp = /(.+)\.xml$/i,
      DeploymentDelay = 60,
      BASE_PATH_REGEXP = /<BasePath[^>]*>(.*?)<\/BasePath>/;

// By default, do not run NPM remotely
const DefaultResolveModules = false;
// used when bundled-dependencies is active to potentially force remoteNPM
var noNodeSource = false;

var descriptor = defaults.defaultDescriptor({
  api: {
    name: 'API Name',
    shortOption: 'n',
    required: true
  },
  environments: {
    name: 'Environments',
    shortOption: 'e',
    required: true
  },
  directory: {
    name: 'Directory',
    shortOption: 'd',
    required: false
  },
  'base-path': {
    name: 'Base Path',
    shortOption: 'b'
  },
  'import-only': {
    name: 'Import Only',
    shortOption: 'i',
    toggle: true
  },
  'resolve-modules': {
    name: 'Resolve Modules',
    shortOption: 'R',
    toggle: true
  },
  'upload-modules': {
    name: 'Upload Modules',
    shortOption: 'U',
    toggle: true
  },
  'bundled-dependencies' : {
    name: 'Upload dependencies from bundledDependencies',
    toggle: true
  },
  'wait-after-import': {
    name: 'Wait N seconds after importing proxy before deploying',
    shortOption: 'W',
    required: false
  }
});
module.exports.descriptor = descriptor;

module.exports.format = function(r) {
  var result = '';
  r.forEach(function(e) {
    result = result + parseDeployments.formatDeployment(e);
  });
  return result;
};

module.exports.run = function(opts, cb) {
  // Setup Delay for after import if set
  opts.waitAfterImportDelay = 0;
  if (opts['wait-after-import'] !== undefined) {
    opts.waitAfterImportDelay = parseInt(opts['wait-after-import']);
    if (isNaN(opts.waitAfterImportDelay)) {
      console.error('invalid int for wait-after-import');
      process.exit(1);
    }
  }

  if (!opts.directory) {
    opts.directory = process.cwd();
  }
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log('deployproxy: %j', opts);
  }
  var request = defaults.defaultRequest(opts);

  // Run each function in series, and collect an array of results.
  async.series([
    (done) => checkBasePath(opts, done),
    (done) => getDeploymentInfo(opts, request, done),
    (done) => createApiProxy(opts, request, done),
    (done) => uploadResources(opts, request, done),
    (done) => uploadPolicies(opts, request, done),
    (done) => uploadTargets(opts, request, done),
    (done) => uploadProxies(opts, request, done),
    (done) => runNpm(opts, request, done),
    (done) => deployProxy(opts, request, done)
  ],
    function(err, results) {
      if (err) { return cb(err); }

      // clean out all null result values
      results = cleanResults(results);

      if (opts.debug) { console.log('results: %j', results); }

      // don't attempt to "parse" an undeployed proxy, just return basic info
      if (opts['import-only']) {
        return cb(undefined, results);
      }

      async.map(Object.values(results[results.length - 1]),
        function(result, cb) {

          if (opts.debug) { console.log('result: %j', result); }

          var deployment = parseDeployments.parseDeploymentResult(result);
          if (deployment) {
            // Look up the deployed URI for user-friendliness
            parseDeployments.getPathInfo([ deployment ], opts, function(err) {
              // Ignore this error because deployment worked
              if (err && opts.verbose) { console.log('Error looking up deployed path: %s', err); }
              cb(undefined, deployment);

            });
          } else {
            // Probably import-only -- do nothing
            cb(undefined, {});
          }
        },
        cb);
    });
};

function checkBasePath(opts, cb) {
  if (!opts['base-path']) { return cb(); }
  return cb();
  //
  // basepath works  with multiple proxy endpoints.

  // findProxies(opts, function(err, files) {
  //   if (files.length !== 1) {
  //     return cb(new Error('Cannot specify base-path option when more than one ProxyEndpoint'));
  //   }
  //   fs.readFile(files[0], 'utf8', function(err, data) {
  //     if (err) { return cb(err); }
  //     var match = data.match(BASE_PATH_REGEXP);
  //     if (match && match[1] !== opts['base-path']) {
  //       return cb(new Error(util.format('Cannot override ProxyEndpoint BasePath: %s', match[1])));
  //     }
  //     cb();
  //   });
  // });
}

function getDeploymentInfo(opts, request, done) {
  // Find out if the root directory is a directory
  var ds;
  try {
    ds = fs.statSync(path.join(opts.directory, ProxyBase));
  } catch (e) {
    done(new Error(util.format('Proxy base directory %s does not exist',
                   opts.directory)));
    return;
  }
  if (!ds.isDirectory()) {
    done(new Error(util.format('Proxy base directory %s is not a directory',
                   opts.directory)));
    return;
  }

  // Check out some specific parameters that aren't caught by the generic stuff
  opts.remoteNpm = DefaultResolveModules;
  if (opts['upload-modules'] && (opts['upload-modules'] === true)) {
    opts.remoteNpm = false;
  }
  if (opts['resolve-modules'] && (opts['resolve-modules'] === true)) {
    opts.remoteNpm = true;
  }
  if (opts.debug) {
    console.log('Resolve NPM modules = %s', opts.remoteNpm);
  }

  // Find out which revision we should be creating
  request.get(util.format('%s/v1/o/%s/apis/%s',
               opts.baseuri, opts.organization, opts.api),
  function(err, req, body) {
      if (err) {
        done(err);
      } else if (req.statusCode === 404) {
        opts.deployNewApi = true;
        opts.deploymentVersion = 1;
        if (opts.verbose) {
          console.log('API %s does not exist. Going to create revision 1',
                      opts.api);
        }
        done();
      } else if (req.statusCode === 200) {
        // get the next revision
        opts.deploymentVersion =
          body.revision
          .map(v => parseInt(v))
          .reduce((a, b) => ((a>b)?a:b), 0) + 1;

        if (opts.verbose) {
          console.log('Going to create revision %d of API %s',
                      opts.deploymentVersion, opts.api);
        }
        done();
      } else {
        done(new Error(util.format('Get API info returned status %d', req.statusCode)));
      }
  });
}

function createApiProxy(opts, request, done) {
  // Is there a single XML file in the root directory?
  // If not, then create one
  var rootDoc;
  var rootEntryName;

  var pd = path.join(opts.directory, ProxyBase);
  var topFiles = fsutils.readdirSyncFilesOnly(pd);
  if (topFiles.length === 1) {
    var fn = path.join(pd, topFiles[0]);
    rootEntryName = topFiles[0];
    if (opts.verbose) {
      console.log('Using %s as the root file', fn);
    }
    rootDoc = fs.readFileSync(fn);
  } else {
    rootEntryName = opts.api + '.xml';
    rootDoc = mustache.render('<APIProxy name="{{api}}"/>', opts);
  }

  var uri = util.format('%s/v1/o/%s/apis?action=import&validate=false&name=%s',
                    opts.baseuri, opts.organization, opts.api);
  if (opts.debug) {
    console.log('Calling %s', uri);
  }
  if (opts.verbose) {
    console.log('Creating revision %d of API %s', opts.deploymentVersion,
               opts.api);
  }

  ziputils.makeOneFileZip(ProxyBase, rootEntryName, rootDoc)
    .then(zipBuf => {
      // For debugging
      //fs.writeFileSync('./test.zip', zipBuf);
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

function proxyCreationDone(err, req, body, opts, done) {
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

function uploadResources(opts, request, done) {
  var resBaseDir = path.join(opts.directory, ProxyBase, 'resources');
  // Produce a list of entries to either ZIP or upload.
  var entries;
  try {
    entries = ziputils.enumerateResourceDirectory(resBaseDir, opts.remoteNpm);
  } catch (e) {
    if (e.code === 'ENOENT') {
      if (opts.verbose) {
        console.error('No resources found');
      }
      done();
    } else {
      done(e);
    }
    return;
  }

  async.eachLimit(entries, opts.asynclimit, function(entry, entryDone) {
    var uri =
      util.format('%s/v1/o/%s/apis/%s/revisions/%d/resources?type=%s&name=%s',
                  opts.baseuri, opts.organization, opts.api,
                  opts.deploymentVersion, entry.resourceType, entry.resourceName);
    if(opts['bundled-dependencies'] && (entry.resourceType === 'node' || entry.resourceType === 'hosted')) {
      // skip node/hosted files we will handle these special
      return entryDone();
    } else if (entry.directory) {
      // ZIP up all directories, possibly with additional file prefixes
      ziputils.zipDirectory(entry.fileName, entry.zipEntryName, function(err, zipBuf) {
        if (err) {
          console.log(err)
          entryDone(err);
        } else {
          if (opts.verbose) {
            console.log('Uploading %s resource %s', entry.resourceType, entry.resourceName);
          }
          request({
            uri: uri,
            method: 'POST',
            json: false,
            headers: { 'Content-Type': 'application/octet-stream' },
            body: zipBuf
          }, function(err, req, body) {
            handleUploadResult(err, req, entryDone);
          });
        }
      });
    } else {
      if (opts.verbose) {
        console.log('Uploading %s resource %s', entry.resourceType, entry.resourceName);
      }
      var httpReq = request({
        uri: uri,
        method: 'POST',
        json: false,
        headers: { 'Content-Type': 'application/octet-stream' }
      }, function(err, req, body) {
        handleUploadResult(err, req, entryDone);
      });

      var fileStream = fs.createReadStream(entry.fileName);
      fileStream.pipe(httpReq);
    }
  }, function(err) {
    if (opts['bundled-dependencies']) {
      var steps = [];

      // check for hosted resources
      var hostedDir = path.join(resBaseDir, 'hosted');
      if (fs.existsSync(hostedDir)) {
        steps.push(function(stepDone) {
          // package hosted resources and upload the packed directory
          usePackedSource(hostedDir, opts, function(err, packedDirectory) {
            if (err) {
              return stepDone(err);
            }

            uploadSource(packedDirectory, 'hosted', opts, request, stepDone)
          });
        });
      }

      // check for node resources
      var nodeDir = path.join(resBaseDir, 'node');
      if (fs.existsSync(nodeDir)) {
        steps.push(function(stepDone) {
          // package node resources and upload the packed directory
          usePackedSource(nodeDir, opts, function(err, packedDirectory) {
            if (err) {
              return stepDone(err);
            }

            uploadSource(packedDirectory, 'node', opts, request, stepDone)
          });
        });
      } else {
        // no node resources, so do not force remoteNPM
        noNodeSource = true;
      }

      return async.series(steps, done);
    }

    return done(err);
  });
}

function handleUploadResult(err, req, itemDone) {
  if (err) {
    itemDone(err);
  } else if ((req.statusCode === 200) || (req.statusCode === 201)) {
    itemDone();
  } else {
    itemDone(new Error(util.format('Error uploading resource: %d',
      req.statusCode)));
  }
}

function uploadPolicies(opts, request, done) {
  var baseDir = path.join(opts.directory, ProxyBase, 'policies');
  var fileNames;
  try {
    fileNames = fs.readdirSync(baseDir);
  } catch (e) {
    if (e.code === 'ENOENT') {
      if (opts.verbose) {
        console.log('No policies found');
      }
      done();
    } else {
      done(e);
    }
    return;
  }

  async.eachLimit(fileNames, opts.asynclimit, function(fileName, itemDone) {
    var rp = path.join(baseDir, fileName);
    var stat = fs.statSync(rp);
    if (!XmlExp.test(fileName)) {
      if (opts.verbose) {
        console.log('Skipping file %s which is not an XML file', rp);
      }
      return itemDone();
    }
    if (!stat.isFile()) {
      if (opts.verbose) {
        console.log('Skipping file %s which is not a regular file', rp);
      }
      return itemDone();
    }

    if (opts.verbose) {
      console.log('Uploading policy %s', fileName);
    }
    var uri = util.format('%s/v1/o/%s/apis/%s/revisions/%d/policies',
                opts.baseuri, opts.organization, opts.api,
                opts.deploymentVersion);
    var postReq = request({
      uri: uri,
      headers: { 'Content-Type': 'application/xml' },
      json: false,
      method: 'POST'
    }, function(err, req, body) {
      if (err) {
        itemDone(err);
      } else if ((req.statusCode === 200) || (req.statusCode === 201)) {
        itemDone();
      } else {
        itemDone(new Error(util.format('Error uploading policy %s: %s',fileName, body)));
      }
    });

    var rf = fs.createReadStream(rp);
    rf.pipe(postReq);

  }, function(err) {
    done(err);
  });
}

function uploadTargets(opts, request, done) {
  var baseDir = path.join(opts.directory, ProxyBase, 'targets');
  var fileNames;
  try {
    fileNames = fs.readdirSync(baseDir);
  } catch (e) {
    if (e.code === 'ENOENT') {
      if (opts.verbose) {
        console.log('No targets found');
      }
      done();
    } else {
      done(e);
    }
    return;
  }

  async.eachLimit(fileNames, opts.asynclimit, function(fileName, itemDone) {
    var rp = path.join(baseDir, fileName);
    var stat = fs.statSync(rp);
    var isXml = XmlExp.exec(fileName);
    if (!isXml) {
      if (opts.verbose) {
        console.log('Skipping file %s which is not an XML file', rp);
      }
      return itemDone();
    }
    if (!stat.isFile()) {
      if (opts.verbose) {
        console.log('Skipping file %s which is not a regular file', rp);
      }
      return itemDone();
    }

    if (opts.verbose) {
      console.log('Uploading target %s', isXml[1]);
    }
    var uri = util.format('%s/v1/o/%s/apis/%s/revisions/%d/targets?name=%s',
                opts.baseuri, opts.organization, opts.api,
                opts.deploymentVersion, isXml[1]);
    var postReq = request({
      uri: uri,
      headers: { 'Content-Type': 'application/xml' },
      json: false,
      method: 'POST'
    }, function(err, req, body) {
      if (err) {
        itemDone(err);
      } else if ((req.statusCode === 200) || (req.statusCode === 201)) {
        itemDone();
      } else {
        itemDone(new Error(util.format('Error uploading target: %s',
          req.statusCode)));
      }
    });

    var rf = fs.createReadStream(rp);
    rf.pipe(postReq);

  }, function(err) {
    done(err);
  });
}

function findProxies(opts, cb) {
  var baseDir = path.join(opts.directory, ProxyBase, 'proxies');
  var fileNames;
  try {
    fileNames = fs.readdirSync(baseDir);
  } catch (e) {
    if (e.code === 'ENOENT') {
      if (opts.verbose) { console.log('No proxies found'); }
      cb();
    } else {
      cb(e);
    }
    return;
  }

  let files = fileNames.map(fileName => {
      var rp = path.join(baseDir, fileName);
      var isXml = XmlExp.exec(fileName);
      if (!isXml) {
        if (opts.verbose) { console.log('Skipping file %s which is not an XML file', rp); }
        return false;
      }
        let stat = fs.statSync(rp);
      if (!stat.isFile()) {
        if (opts.verbose) { console.log('Skipping file %s which is not a regular file', rp); }
        return false;
      }
      return rp;
    });
  cb(null, files.filter(v => v));
}

function uploadProxies(opts, request, done) {

  findProxies(opts, function(err, filePaths) {
    if (err) { return done(err); }

    async.eachLimit(filePaths, opts.asynclimit, function(filePath, itemDone) {

      var proxyName = filePath.split(path.sep).pop().split('.')[0];
      if (opts.verbose) {
        console.log('Uploading proxy %s', proxyName);
      }
      var uri = util.format('%s/v1/o/%s/apis/%s/revisions/%d/proxies?name=%s',
        opts.baseuri, opts.organization, opts.api,
        opts.deploymentVersion, proxyName);
      var postReq = request({
        uri: uri,
        headers: { 'Content-Type': 'application/xml' },
        json: false,
        method: 'POST'
      }, function(err, req, body) {
        if (err) {
          itemDone(err);
        } else if ((req.statusCode === 200) || (req.statusCode === 201)) {
          itemDone();
        } else {
          if (opts.verbose) {
            console.error('Deployment result: %j', body);
          }
          var jsonBody;
          var errMsg;
          try {
            jsonBody = JSON.parse(body);
            if (jsonBody && (jsonBody.message)) {
              errMsg = jsonBody.message;
            } else {
              errMsg = util.format('Error uploading proxy: %d',
                req.statusCode);
            }
            itemDone(new Error(errMsg));
          } catch (jsonParseErr) {
            itemDone(jsonParseErr);
          }
        }
      });

      var rf = fs.createReadStream(filePath);
      rf.pipe(postReq);

    }, function(err) {
      done(err);
    });
  });
}

function runNpm(opts, request, done) {
  if (!opts.remoteNpm && (!opts['bundled-dependencies'] || noNodeSource)) {
    done();
  } else {
    if (opts.verbose) {
      console.log('Running "npm install" at Apigee. This may take several minutes.');
    }

    var body = {
      command: 'install'
    };
    if (opts.debug) {
      body.verbose = true;
    }

    request({
      uri: util.format('%s/v1/o/%s/apis/%s/revisions/%d/npm',
             opts.baseuri, opts.organization, opts.api, opts.deploymentVersion),
      method: 'POST',
      form: body,
      headers: {
        'Accept': 'text/plain'
      },
      json: false
    }, function(err, req, body) {
      if (err) {
        done(err);
      } else if (req.statusCode === 200) {
        if (opts.verbose) {
          console.log('NPM complete.');
          console.log(body);
        }
        done();
      } else {
        if (opts.verbose) {
          console.log('NPM failed with %d', req.statusCode);
          console.log(body);
        }
        done(new Error(util.format('NPM install failed with status code %d', req.statusCode)));
      }
    });
  }
}

function deployProxy(opts, request, done) {
  if (opts['import-only']) {
    if (opts.verbose) {
      console.log('Not deploying the proxy right now');
    }

    // return some basic info about the proxy
    done(undefined, {
      name: opts.api,
      revision: opts.deploymentVersion,
      state: 'undeployed',
      basePath: opts['base-path']
    });

    return;
  }

  if (opts.verbose) {
    console.log('Deploying revision %d of %s to %s', opts.deploymentVersion,
                opts.api, opts.environments);
  }

  var environments = opts.environments.split(',');

  function deployToEnvironment(environment, done) {

    var uri = util.format('%s/v1/o/%s/e/%s/apis/%s/revisions/%d/deployments',
      opts.baseuri, opts.organization, environment, opts.api, opts.deploymentVersion);
    if (opts.debug) { console.log('Going to POST to %s', uri); }

    var deployCmd = util.format('action=deploy&override=true&delay=%d', DeploymentDelay);
    if (opts['base-path']) {
      deployCmd = util.format('%s&basepath=%s', deployCmd, opts['base-path']);
    }
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

      var jsonBody;
      try {
        jsonBody = (body ? JSON.parse(body) : null);
      } catch(e) {
        // fall through -- error handling below will catch any error
      }

      if (req.statusCode === 200) {
        if (opts.verbose) { console.log('Deployment on %s successful', environment); }
        if (opts.debug) { console.log('%j', jsonBody); }
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

  if (opts.verbose) { console.log('Delaying deployment for %d seconds', opts.waitAfterImportDelay); }
  setTimeout(function () {
    async.parallel(tasks, done);
  }, opts.waitAfterImportDelay*1000);
}
