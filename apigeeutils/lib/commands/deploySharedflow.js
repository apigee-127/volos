/* jshint node: true  */
"use strict";

const util = require("util"),
  path = require("path"),
  async = require("async"),
  fs = require("fs"),
  mustache = require("mustache");

const defaults = require("../defaults"),
  fsutils = require("../fsutils"),
  options = require("../options"),
  ziputils = require("../ziputils"),
  parseDeployments = require("./parseDeployments");

const SharedFlowBase = "sharedflowbundle",
  XmlExp = /(.+)\.xml$/i,
  DeploymentDelay = 60;

var descriptor = defaults.defaultDescriptor({
  name: {
    name: "SharedFlow Name",
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
  "import-only": {
    name: "Import Only",
    shortOption: "i",
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
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("deploysharedflow: %j", opts);
  }
  var request = defaults.defaultRequest(opts);

  // Run each function in series, and collect an array of results.
  async.series(
    [
      function (done) {
        getDeploymentInfo(opts, request, done);
      },
      function (done) {
        createSharedFlowBundle(opts, request, done);
      },
      function (done) {
        uploadResources(opts, request, done);
      },
      function (done) {
        uploadPolicies(opts, request, done);
      },
      function (done) {
        uploadSharedFlows(opts, request, done);
      },
      function (done) {
        deploySharedFlow(opts, request, done);
      }
    ],
    function (err, results) {
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

          var deployment = parseDeployments.parseDeploymentResult(result); // FIXME SF deployment would be different
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
    }
  );
};

function getDeploymentInfo(opts, request, done) {
  // Find out if the root directory is a directory
  var ds;
  try {
    ds = fs.statSync(path.join(opts.directory, SharedFlowBase));
  } catch (e) {
    done(
      new Error(
        util.format(
          "SharedFlow base directory %s does not exist",
          opts.directory
        )
      )
    );
    return;
  }
  if (!ds.isDirectory()) {
    done(
      new Error(
        util.format(
          "SharedFlow base directory %s is not a directory",
          opts.directory
        )
      )
    );
    return;
  }

  // Find out which revision we should be creating
  request.get(
    util.format(
      "%s/v1/o/%s/sharedflows/%s",
      opts.baseuri,
      opts.organization,
      opts.name
    ),
    function (err, req, body) {
      if (err) {
        done(err);
      } else if (req.statusCode === 404) {
        opts.deployNewApi = true;
        opts.deploymentVersion = 1;
        if (opts.verbose) {
          console.log(
            "SharedFlow %s does not exist. Going to create revision 1",
            opts.name
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
            "Going to create revision %d of SharedFlow %s",
            opts.deploymentVersion,
            opts.name
          );
        }
        done();
      } else {
        done(
          new Error(
            util.format(
              "Get SharedFlow info returned status %d",
              req.statusCode
            )
          )
        );
      }
    }
  );
}

function createSharedFlowBundle(opts, request, done) {
  // Is there a single XML file in the root directory?
  // If not, then create one
  var rootDoc;
  var rootEntryName;

  var pd = path.join(opts.directory, SharedFlowBase);
  var topFiles = fsutils.readdirSyncFilesOnly(pd);
  if (topFiles.length === 1) {
    var fn = path.join(pd, topFiles[0]);
    rootEntryName = topFiles[0];
    if (opts.verbose) {
      console.log("Using %s as the root file", fn);
    }
    rootDoc = fs.readFileSync(fn);
  } else {
    rootEntryName = opts.name + ".xml";
    rootDoc = mustache.render('<SharedFlowBundle name="{{name}}"/>', opts);
  }

  var uri = util.format(
    "%s/v1/o/%s/sharedflows?action=import&validate=false&name=%s",
    opts.baseuri,
    opts.organization,
    opts.name
  );
  if (opts.debug) {
    console.log("Calling %s", uri);
  }
  if (opts.verbose) {
    console.log(
      "Creating revision %d of SharedFlow %s",
      opts.deploymentVersion,
      opts.name
    );
  }

  ziputils
    .makeOneFileZip(SharedFlowBase, rootEntryName, rootDoc)
    .then((zipBuf) => {
      // For debugging
      //fs.writeFileSync('./test.zip', zipBuf);
      request(
        {
          uri: uri,
          headers: { "Content-Type": "application/octet-stream" },
          json: false,
          method: "POST",
          body: zipBuf
        },
        function (err, req, body) {
          sharedFlowCreationDone(err, req, body, opts, done);
        }
      );
    });
}

function sharedFlowCreationDone(err, req, body, opts, done) {
  if (err) {
    done(err);
  } else if (req.statusCode === 200 || req.statusCode === 201) {
    done();
  } else {
    if (opts.verbose) {
      console.error("SharedFlowBundle creation error:", body);
    }
    done(
      new Error(
        util.format(
          "SharedFlowBundle creation failed. Status code %d",
          req.statusCode
        )
      )
    );
  }
}

function uploadResources(opts, request, done) {
  var resBaseDir = path.join(opts.directory, SharedFlowBase, "resources");
  // Produce a list of entries to either ZIP or upload.
  var entries;
  try {
    entries = ziputils.enumerateResourceDirectory(resBaseDir, opts.remoteNpm);
  } catch (e) {
    if (e.code === "ENOENT") {
      if (opts.verbose) {
        console.error("No resources found");
      }
      done();
    } else {
      done(e);
    }
    return;
  }

  async.eachLimit(
    entries,
    opts.asynclimit,
    function (entry, entryDone) {
      var uri = util.format(
        "%s/v1/o/%s/sharedflows/%s/revisions/%d/resources?type=%s&name=%s",
        opts.baseuri,
        opts.organization,
        opts.name,
        opts.deploymentVersion,
        entry.resourceType,
        entry.resourceName
      );
      if (entry.directory) {
        // ZIP up all directories, possibly with additional file prefixes
        ziputils.zipDirectory(
          entry.fileName,
          entry.zipEntryName,
          function (err, zipBuf) {
            if (err) {
              console.log(err);
              entryDone(err);
            } else {
              if (opts.verbose) {
                console.log(
                  "Uploading %s resource %s",
                  entry.resourceType,
                  entry.resourceName
                );
              }
              request(
                {
                  uri: uri,
                  method: "POST",
                  json: false,
                  headers: { "Content-Type": "application/octet-stream" },
                  body: zipBuf
                },
                function (err, req, body) {
                  handleUploadResult(err, req, entryDone);
                }
              );
            }
          }
        );
      } else {
        if (opts.verbose) {
          console.log(
            "Uploading %s resource %s",
            entry.resourceType,
            entry.resourceName
          );
        }
        var httpReq = request(
          {
            uri: uri,
            method: "POST",
            json: false,
            headers: { "Content-Type": "application/octet-stream" }
          },
          function (err, req, body) {
            handleUploadResult(err, req, entryDone);
          }
        );

        var fileStream = fs.createReadStream(entry.fileName);
        fileStream.pipe(httpReq);
      }
    },
    function (err) {
      done(err);
    }
  );
}

function handleUploadResult(err, req, itemDone) {
  if (err) {
    itemDone(err);
  } else if (req.statusCode === 200 || req.statusCode === 201) {
    itemDone();
  } else {
    itemDone(
      new Error(util.format("Error uploading resource: %d", req.statusCode))
    );
  }
}

function uploadPolicies(opts, request, done) {
  var baseDir = path.join(opts.directory, SharedFlowBase, "policies");
  var fileNames;
  try {
    fileNames = fs.readdirSync(baseDir);
  } catch (e) {
    if (e.code === "ENOENT") {
      if (opts.verbose) {
        console.log("No policies found");
      }
      done();
    } else {
      done(e);
    }
    return;
  }

  async.eachLimit(
    fileNames,
    opts.asynclimit,
    function (fileName, itemDone) {
      var rp = path.join(baseDir, fileName);
      var stat = fs.statSync(rp);
      if (!XmlExp.test(fileName)) {
        if (opts.verbose) {
          console.log("Skipping file %s which is not an XML file", rp);
        }
        return itemDone();
      }
      if (!stat.isFile()) {
        if (opts.verbose) {
          console.log("Skipping file %s which is not a regular file", rp);
        }
        return itemDone();
      }

      if (opts.verbose) {
        console.log("Uploading policy %s", fileName);
      }
      var uri = util.format(
        "%s/v1/o/%s/sharedflows/%s/revisions/%d/policies",
        opts.baseuri,
        opts.organization,
        opts.name,
        opts.deploymentVersion
      );
      var postReq = request(
        {
          uri: uri,
          headers: { "Content-Type": "application/xml" },
          json: false,
          method: "POST"
        },
        function (err, req, body) {
          if (err) {
            itemDone(err);
          } else if (req.statusCode === 200 || req.statusCode === 201) {
            itemDone();
          } else {
            itemDone(
              new Error(
                util.format("Error uploading policy: %s", req.statusCode)
              )
            );
          }
        }
      );

      var rf = fs.createReadStream(rp);
      rf.pipe(postReq);
    },
    function (err) {
      done(err);
    }
  );
}

function uploadSharedFlows(opts, request, done) {
  var baseDir = path.join(opts.directory, SharedFlowBase, "sharedflows");
  var fileNames;
  try {
    fileNames = fs.readdirSync(baseDir);
  } catch (e) {
    if (e.code === "ENOENT") {
      if (opts.verbose) {
        console.log("No sharedflows found");
      }
      done();
    } else {
      done(e);
    }
    return;
  }

  async.eachLimit(
    fileNames,
    opts.asynclimit,
    function (fileName, itemDone) {
      var rp = path.join(baseDir, fileName);
      var stat = fs.statSync(rp);
      var isXml = XmlExp.exec(fileName);
      if (!isXml) {
        if (opts.verbose) {
          console.log("Skipping file %s which is not an XML file", rp);
        }
        return itemDone();
      }
      if (!stat.isFile()) {
        if (opts.verbose) {
          console.log("Skipping file %s which is not a regular file", rp);
        }
        return itemDone();
      }

      if (opts.verbose) {
        console.log("Uploading sharedflows %s", isXml[1]);
      }
      var uri = util.format(
        "%s/v1/o/%s/sharedflows/%s/revisions/%d/sharedflows?name=%s",
        opts.baseuri,
        opts.organization,
        opts.name,
        opts.deploymentVersion,
        isXml[1]
      );
      var postReq = request(
        {
          uri: uri,
          headers: { "Content-Type": "application/xml" },
          json: false,
          method: "POST"
        },
        function (err, req, body) {
          if (err) {
            itemDone(err);
          } else if (req.statusCode === 200 || req.statusCode === 201) {
            itemDone();
          } else {
            itemDone(
              new Error(
                util.format("Error uploading sharedflow: %s", req.statusCode)
              )
            );
          }
        }
      );

      var rf = fs.createReadStream(rp);
      rf.pipe(postReq);
    },
    function (err) {
      done(err);
    }
  );
}

function deploySharedFlow(opts, request, done) {
  if (opts["import-only"]) {
    if (opts.verbose) {
      console.log("Not deploying the sharedflow right now");
    }
    done();
    return;
  }

  if (opts.verbose) {
    console.log(
      "Deploying revision %d of %s to %s",
      opts.deploymentVersion,
      opts.name,
      opts.environments
    );
  }

  var environments = opts.environments.split(",");

  function deployToEnvironment(environment, done) {
    var uri = util.format(
      "%s/v1/o/%s/e/%s/sharedflows/%s/revisions/%d/deployments",
      opts.baseuri,
      opts.organization,
      environment,
      opts.name,
      opts.deploymentVersion
    );
    if (opts.debug) {
      console.log("Going to POST to %s", uri);
    }

    var deployCmd = util.format(
      "action=deploy&override=true&delay=%d",
      DeploymentDelay
    );
    if (opts["base-path"]) {
      deployCmd = util.format("%s&basepath=%s", deployCmd, opts["base-path"]);
    }
    if (opts.debug) {
      console.log("Going go send command %s", deployCmd);
    }

    request(
      {
        uri: uri,
        method: "POST",
        json: false,
        body: deployCmd,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        }
      },
      function (err, req, body) {
        if (err) {
          return done(err);
        }

        var jsonBody = body ? JSON.parse(body) : null;

        if (req.statusCode === 200) {
          if (opts.verbose) {
            console.log("Deployment on %s successful", environment);
          }
          if (opts.debug) {
            console.log("%j", jsonBody);
          }
          return done(undefined, jsonBody);
        }

        if (opts.verbose) {
          console.error("Deployment on %s result: %j", environment, body);
        }
        var errMsg;
        if (jsonBody && jsonBody.message) {
          errMsg = jsonBody.message;
        } else {
          errMsg = util.format(
            "Deployment on %s failed with status code %d",
            environment,
            req.statusCode
          );
        }
        done(new Error(errMsg));
      }
    );
  }

  var tasks = {};
  environments.forEach(function (env) {
    tasks[env] = deployToEnvironment.bind(this, env);
  });

  async.parallel(tasks, done);
}
