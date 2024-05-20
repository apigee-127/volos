const util = require("util"),
  path = require("path"),
  async = require("async"),
  fs = require("fs-extra"),
  mustache = require("mustache"),
  tmp = require("tmp");

tmp.setGracefulCleanup();

const defaults = require("../defaults"),
  options = require("../options"),
  ziputils = require("../ziputils"),
  parseDeployments = require("./parseDeployments"),
  fetchProxy = require("./fetchProxy"),
  deployProxy1 = require("./deployProxy"),
  createApiProxy = require("../deploycommon").createApiProxy,
  createProxy = require("../deploycommon").createProxy,
  deployProxy2 = require("../deploycommon").deployProxy,
  unzipProxy = require("../deploycommon").unzipProxy,
  copyFile = require("../deploycommon").copyFile,
  handleUploadResult = require("../deploycommon").handleUploadResult,
  usePackedSource = require("../deploycommon").usePackedSource,
  uploadSource = require("../deploycommon").uploadSource;

const APP_YAML = "app.yaml";

var descriptor = defaults.defaultDescriptor({
  api: {
    name: "API Name",
    shortOption: "n",
    required: true
  },
  environments: {
    name: "Environments",
    shortOption: "e",
    required: true
  },
  directory: {
    name: "Directory",
    shortOption: "d",
    required: false
  },
  virtualhosts: {
    name: "Virtual Hosts",
    shortOption: "v"
  },
  "base-path": {
    name: "Base Path",
    shortOption: "b"
  },
  "import-only": {
    name: "Import Only",
    shortOption: "i",
    toggle: true
  },
  "preserve-policies": {
    name: "Preserve policies from previous revision",
    shortOption: "P",
    toggle: true
  },
  "bundled-dependencies": {
    name: "Upload dependencies from bundledDependencies",
    toggle: true
  },
  "upload-modules": {
    name: "Upload Modules",
    shortOption: "U",
    toggle: true
  }
});
module.exports.descriptor = descriptor;

module.exports.format = function (r) {
  var result = "";
  r.forEach(function (e) {
    result = result + parseDeployments.formatDeployment(e);
  });
  return result;
};

module.exports.run = function (opts, cb) {
  if (!opts.directory) {
    opts.directory = process.cwd();
  }

  descriptor.api.required = true;
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("deployhostedtarget: %j", opts);
  }

  try {
    fs.statSync(path.join(opts.directory, APP_YAML));
  } catch (err) {
    return cb(new Error("missing required 'app.yaml'"));
  }

  var request = defaults.defaultRequest(opts);

  getDeploymentInfo(opts, request, function (err) {
    if (err) {
      return cb(err);
    }

    // if preserve-policies, we do something entirely different...
    if (opts["preserve-policies"] && opts.deploymentVersion > 1) {
      return preservePoliciesRun(opts, cb);
    }

    opts.remoteNpm = true;
    if (opts["upload-modules"] && opts["upload-modules"] === true) {
      opts.remoteNpm = false;
    }

    var steps = [
      function (done) {
        createApiProxy(opts, request, done);
      }
    ];

    if (opts["bundled-dependencies"]) {
      opts.remoteNpm = false;

      steps.push(function (done) {
        usePackedSource(opts.directory, opts, function (err, packedDirectory) {
          // set the target directory to upload to the packed directory
          opts.directory = packedDirectory;
          return done(err);
        });
      });
    }

    steps = steps.concat([
      function (done) {
        uploadSource(opts.directory, "hosted", opts, request, done);
      },
      function (done) {
        createTarget(opts, request, done);
      },
      function (done) {
        createProxy(opts, request, done);
      },
      function (done) {
        deployProxy2(opts, request, done);
      }
    ]);

    // Run each function in series, and collect an array of results.
    async.series(steps, function (err, results) {
      if (err) {
        return cb(err);
      }
      if (opts.debug) {
        console.log("results: %j", results);
      }

      async.map(
        Object.values(results[results.length - 1]),
        function (result, cb) {
          if (opts.debug) {
            console.log("result: %j", result);
          }

          var deployment = parseDeployments.parseDeploymentResult(result);
          if (deployment) {
            // Look up the deployed URI for user-friendliness
            parseDeployments.getPathInfo([deployment], opts, function (err) {
              // Ignore this error because deployment worked
              if (err && opts.verbose) {
                console.log("Error looking up deployed path: %s", err);
              }
              cb(undefined, deployment);
            });
          } else {
            // Probably import-only -- do nothing
            cb(undefined, {});
          }
        },
        cb
      );
    });
  });
};

function preservePoliciesRun(opts, cb) {
  // download the proxy to a temporary zip file
  tmp.file(function (err, fetchedProxyZip) {
    if (err) {
      return cb(err);
    }

    opts.revision = opts.deploymentVersion - 1;
    opts.file = fetchedProxyZip;

    if (opts.verbose) {
      console.log("Downloading proxy %s revision %d", opts.name, opts.revision);
    }
    fetchProxy.run(opts, function (err) {
      if (err) {
        return cb(err);
      }

      // set up temporary project dir
      tmp.dir({ unsafeCleanup: false }, function (err, tmpDir) {
        if (err) {
          return cb(err);
        }

        unzipProxy(opts, tmpDir, "apiproxy/resources/hosted", function (err) {
          if (err) {
            return cb(err);
          }

          // copy hosted files to tmpDir hosted directory
          var sourcesDir = path.resolve(tmpDir, "apiproxy/resources/hosted");
          copySources(opts, sourcesDir, function (err) {
            if (err) {
              return cb(err);
            }

            // deploy proxy at tmpDir
            opts.directory = tmpDir;
            deployProxy1.run(opts, cb);
          });
        });
      });
    });
  });
}

function copySources(opts, targetDir, cb) {
  if (opts.verbose) {
    console.log("Copying sources into proxy");
  }

  // Get a list of entries, broken down by which are directories
  ziputils.enumerateDirectory(
    opts.directory,
    "hosted",
    opts.remoteNpm,
    function (err, entries) {
      if (err) {
        return cb(err);
      }

      if (opts.debug) {
        console.log("Directories to copy: %j", entries);
      }

      function copyResource(entry, done) {
        if (entry.directory) {
          // ZIP up all directories, possibly with additional file prefixes
          if (opts.verbose) {
            console.log("Zipping: %s", entry.fileName);
          }
          ziputils.zipDirectory(
            entry.fileName,
            entry.zipEntryName,
            function (err, zipBuf) {
              if (err) {
                return done(err);
              }

              // write zipBuf -> file
              var zipFileName = path.resolve(targetDir, entry.resourceName);

              if (opts.verbose) {
                console.log("Writing zip file: %s", zipFileName);
              }
              fs.writeFile(zipFileName, zipBuf, done);
            }
          );
        } else {
          // entry.file
          var targetFileName = path.resolve(targetDir, entry.resourceName);
          if (opts.verbose) {
            console.log("copy %s %s", entry.fileName, targetDir);
          }
          copyFile(entry.fileName, targetFileName, done);
        }
      }

      async.each(entries, copyResource, cb);
    }
  );
}

function getDeploymentInfo(opts, request, done) {
  // Find out if the root directory is a directory
  var ds;
  try {
    ds = fs.statSync(opts.directory);
  } catch (e) {
    done(
      new Error(
        util.format("Proxy base directory %s does not exist", opts.directory)
      )
    );
    return;
  }
  if (!ds.isDirectory()) {
    done(
      new Error(
        util.format(
          "Proxy base directory %s is not a directory",
          opts.directory
        )
      )
    );
    return;
  }

  // Find out which revision we should be creating
  request.get(
    util.format(
      "%s/v1/o/%s/apis/%s",
      opts.baseuri,
      opts.organization,
      opts.api
    ),
    function (err, req, body) {
      if (err) {
        done(err);
      } else if (req.statusCode === 404) {
        opts.deployNewApi = true;
        opts.deploymentVersion = 1;
        if (opts.verbose) {
          console.log(
            "API %s does not exist. Going to create revision 1",
            opts.api
          );
        }
        done();
      } else if (req.statusCode === 200) {
        // get the next revision
        opts.deploymentVersion =
          body.revision
            .map((v) => parseInt(v))
            .reduce((a, b) => (a > b ? a : b), 0) + 1;

        if (opts.verbose) {
          console.log(
            "Going to create revision %d of API %s",
            opts.deploymentVersion,
            opts.api
          );
        }
        done();
      } else {
        done(
          new Error(
            util.format("Get API info returned status %d", req.statusCode)
          )
        );
      }
    }
  );
}

// Create a target endpoint that references the Hosted Target target
function createTarget(opts, request, done) {
  var targetDoc = mustache.render(
    '<TargetEndpoint name="default">' +
      '<PreFlow name="PreFlow"/>' +
      '<PostFlow name="PostFlow"/>' +
      "<HostedTarget/>" +
      "</TargetEndpoint>",
    opts
  );

  var uri = util.format(
    "%s/v1/o/%s/apis/%s/revisions/%d/targets?name=default",
    opts.baseuri,
    opts.organization,
    opts.api,
    opts.deploymentVersion
  );
  if (opts.verbose) {
    console.log("Creating the target endpoint");
  }

  request(
    {
      uri: uri,
      method: "POST",
      json: false,
      headers: { "Content-Type": "application/xml" },
      body: targetDoc
    },
    function (err, req, body) {
      handleUploadResult(err, req, "targets/default.xml", done);
    }
  );
}
