const util = require("util"),
  path = require("path"),
  async = require("async"),
  fs = require("fs"),
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

var cleanResults = require("../utils").cleanResults;

var DeploymentDelay = 60;
var ProxyBase = "apiproxy";

// By default, do not run NPM remotely
var DefaultResolveModules = false;

var descriptor = defaults.defaultDescriptor({
  api: {
    name: "API Name",
    shortOption: "n",
    required: false
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
  main: {
    name: "Main Script",
    shortOption: "m",
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
  "resolve-modules": {
    name: "Resolve Modules",
    shortOption: "R",
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
  },
  "preserve-policies": {
    name: "Preserve policies from previous revision",
    shortOption: "P",
    toggle: true
  },
  "wait-after-import": {
    name: "Wait N seconds after importing proxy before deploying",
    shortOption: "W",
    required: false
  },
  production: {
    name: "Run resolve modules with npm install --production, default true",
    required: false
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
  // Setup Delay for after import if set
  opts.waitAfterImportDelay = 0;
  if (opts["wait-after-import"] !== undefined) {
    opts.waitAfterImportDelay = parseInt(opts["wait-after-import"]);
    if (isNaN(opts.waitAfterImportDelay)) {
      console.error("invalid int for wait-after-import");
      process.exit(1);
    }
  }

  if (!opts.directory) {
    opts.directory = process.cwd();
  }
  if (!opts.main || !opts.api) {
    try {
      var packageFile = path.resolve(opts.directory, "package.json");
      var packageObj = JSON.parse(fs.readFileSync(packageFile, "utf8"));
      if (!opts.main) {
        opts.main = packageObj.main;
      }
      if (!opts.api) {
        opts.api = packageObj.name;
      }
    } catch (err) {
      if (opts.debug) {
        console.error("unable to read package.json", err);
      }
    }
  }
  descriptor.main.required = true;
  descriptor.api.required = true;
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("deploynodeapp: %j", opts);
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
        uploadSource(opts.directory, "node", opts, request, done);
      },
      function (done) {
        createTarget(opts, request, done);
      },
      function (done) {
        createProxy(opts, request, done);
      },
      function (done) {
        runNpm(opts, request, done);
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

      results = cleanResults(results);

      if (opts.debug) {
        console.log("results: %j", results);
      }

      if (opts["import-only"]) {
        return cb(undefined, results);
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

        unzipProxy(opts, tmpDir, "apiproxy/resources/node", function (err) {
          if (err) {
            return cb(err);
          }

          // copy node files to tmpDir node directory
          var nodeResourceDir = path.resolve(tmpDir, "apiproxy/resources/node");
          copyNodeSource(opts, nodeResourceDir, function (err) {
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

function copyNodeSource(opts, targetDir, cb) {
  if (opts.verbose) {
    console.log("Copying node source into proxy");
  }

  // Get a list of entries, broken down by which are directories,
  // and with special handling for the node_modules directory.
  ziputils.enumerateDirectory(
    opts.directory,
    "node",
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

  if (!fs.existsSync(path.join(opts.directory, opts.main))) {
    // Main script might be an absolute path, so fix it up
    opts.main = path.relative(opts.directory, opts.main);
  }
  if (!fs.existsSync(path.join(opts.directory, opts.main))) {
    done(
      new Error(
        util.format("Main script file %s does not seem to exist", opts.main)
      )
    );
    return;
  }
  if (path.dirname(opts.main) !== ".") {
    done(
      new Error(
        util.format(
          "Main script file %s must be in the top level directory",
          opts.main
        )
      )
    );
    return;
  }

  // Check out some specific parameters that aren't caught by the generic stuff
  opts.remoteNpm = DefaultResolveModules;
  if (opts["upload-modules"] && opts["upload-modules"] === true) {
    opts.remoteNpm = false;
  }
  if (opts["resolve-modules"] && opts["resolve-modules"] === true) {
    opts.remoteNpm = true;
  }
  if (opts.debug) {
    console.log("Resolve NPM modules = %s", opts.remoteNpm);
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

// Create a target endpoint that references the Node.js script
function createTarget(opts, request, done) {
  var targetDoc = mustache.render(
    '<TargetEndpoint name="default">' +
      '<PreFlow name="PreFlow"/>' +
      '<PostFlow name="PostFlow"/>' +
      "<ScriptTarget>" +
      "<ResourceURL>node://{{main}}</ResourceURL>" +
      "</ScriptTarget>" +
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

function runNpm(opts, request, done) {
  if (!opts.remoteNpm && !opts["bundled-dependencies"]) {
    done();
  } else {
    if (opts.verbose) {
      console.log(
        'Running "npm install" at Apigee. This may take several minutes.'
      );
    }

    var installURI = util.format(
      "%s/v1/o/%s/apis/%s/revisions/%d/npm?command=install",
      opts.baseuri,
      opts.organization,
      opts.api,
      opts.deploymentVersion
    );

    if (opts.production === "false") {
      installURI = util.format("%s&production=false", installURI);
    }

    if (opts.debug) {
      installURI = util.format("%s&verbose=true", installURI);
    }

    request(
      {
        uri: installURI,
        method: "POST",
        headers: {
          Accept: "text/plain"
        },
        json: false
      },
      function (err, req, body) {
        if (err) {
          done(err);
        } else if (req.statusCode === 200) {
          if (opts.verbose) {
            console.log("NPM complete.");
            console.log(body);
          }
          done();
        } else {
          if (opts.verbose) {
            console.log("NPM failed with %d", req.statusCode);
            console.log(body);
          }
          done(
            new Error(
              util.format(
                "NPM install failed with status code %d",
                req.statusCode
              )
            )
          );
        }
      }
    );
  }
}
