const apigeeutils = require('..'),
      assert = require('assert'),
      async = require('async'),
      path = require('path'),
      fs = require('fs'),
      request = require('postman-request'),
      util = require('util'),
      stream = require('stream'),
      faker = require('faker');

const config = require('./testconfig');

const REASONABLE_TIMEOUT = 25000;

const nameGen = {
        proxy: (s) => `apigeeutils-test-proxy-${s}`,
        nodeProxy: (s) => `apigeeutils-test-nodeproxy-${s}`,
        htProxy: (s) => `apigeeutils-test-htproxy-${s}`,
        product:(s) =>`apigeeutils-test-product-${s}`,
        privateProduct: (s) => `apigeeutils-test-privproduct-${s}`,
        devEmail : (s) => `apigeeutilstest+${s}@apigee.com`,
        app: (s) => `apigeeutils-test-app-${s}`,
        basePath: (s) => `/${s}`,
        cache1: (s) => `apigeeutils-test-cache1-${s}`,
        cache2: (s) => `apigeeutils-test-cache2-${s}`,
        targetServer: (s) => `apigeeutils-test-server-${s}`,
        kvm1: (s) => `apigeeutils-test-kvm1-${s}`,
        kvm2: (s) => `apigeeutils-test-kvm2-${s}`,
        sf: (s) => `apigeeutils-test-sf-${s}`,
        role: (s) => `apigeeutils-test-role-${s}`
      };

const marker = faker.random.alphaNumeric(12);

const verbose = config.verbose || false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// Run all using: mocha remotetests
// Run all "describe" tests using: mocha remotetests --grep "SharedFlows and FlowHooks"
// Run one "it" test using: mocha remotetests --grep "fetchSharedFlow"
// To see tests use 'grep "  it" remotetest.j'

describe('Product/Dev/App Tests', function() {
  this.timeout(REASONABLE_TIMEOUT);
  this.slow(1500);
  const PROXY_NAME = nameGen.proxy(marker) + '-1',
        PRODUCT_NAME = nameGen.product(marker),
        PRIVATE_PRODUCT_NAME = nameGen.privateProduct(marker),
        DEVELOPER_EMAIL = nameGen.devEmail(marker),
        APP_NAME = nameGen.app(marker);

  let deployedRevision;

  it('Deploy Apigee Proxy', function(done) {
    let opts = baseOpts();
    opts.api = PROXY_NAME;
    opts.directory = path.join(__dirname, '../test/fixtures/passthrough1');

    apigeeutils.getPromiseSDK()
      .deployProxy(opts)
      .then(result => {

        if(Array.isArray(result)) {
          result = result[0];
        }
        assert.equal(result.name, PROXY_NAME);
        assert.equal(result.environment, config.environment);
        assert.equal(result.state, 'deployed');
        assert.equal(result.uris.length, 1);
        assert(typeof result.revision === 'number');
        deployedRevision = result.revision;
        done();
      })
      .catch (e => done(e));
  });

  it('Create Product', function(done) {
    let opts = baseOpts() ;
    let displayName = 'custom name';
    opts.productName = PRODUCT_NAME;
    opts.productDesc = 'abc123';
    opts.displayName = displayName;
    opts.proxies = PROXY_NAME;
    opts.quota = '1';
    opts.quotaInterval = '1';
    opts.quotaTimeUnit = 'minute';
    opts.approvalType = "auto";

    apigeeutils.getPromiseSDK()
      .createProduct(opts)
      .then(result => {
        try {
          assert.equal(result.displayName, displayName);
          done();
        } catch (e) {
          done(e);
        }
      })
      .catch(e => done(e));
  });

  it('Create Private Product', done => {
    let opts = baseOpts() ;
    var displayName = 'custom name';
    opts.productName = PRIVATE_PRODUCT_NAME;
    opts.productDesc = 'abc123';
    opts.displayName = displayName;
    opts.proxies = PROXY_NAME;
    opts.quota = '1';
    opts.quotaInterval = '1';
    opts.quotaTimeUnit = 'minute';
    opts.attributes = [ {"name": "access", "value": "private"} ];
    opts.approvalType = "auto";

    apigeeutils.getPromiseSDK()
      .createProduct(opts)
      .then(function(result){
        try {
          assert.equal(result.displayName, displayName);
          assert.equal(result.attributes.length, 1);
          assert.equal(result.attributes[0].name, 'access');
          assert.equal(result.attributes[0].value, 'private');
          done();
        } catch (e) {
          done(e);
        }
      })
      .catch(e => done(e));
  });

  it('Create Developer', done => {
    let opts = baseOpts();
    opts.email = DEVELOPER_EMAIL;
    opts.firstName = 'Test';
    opts.lastName = 'Test1';
    opts.userName = 'runningFromTest123';

    apigeeutils.getPromiseSDK()
      .createDeveloper(opts)
      .then(r => done())
      .catch(e => done(e));
  });

  it('Create App', done => {
    let opts = baseOpts();
    opts.name = APP_NAME;
    opts.apiProducts = PRODUCT_NAME;
    opts.email = DEVELOPER_EMAIL;

    apigeeutils.getPromiseSDK()
      .createApp(opts)
      .then( r => done())
      .catch(e => done(e));
  });

  it('Delete App', done => {
    let opts = baseOpts();
    opts.email = DEVELOPER_EMAIL;
    opts.name = APP_NAME;
    apigeeutils.getPromiseSDK()
      .deleteApp(opts)
      .then(r => done())
      .catch(e => done(e));
  });

  it('Delete Developer', done => {
    let opts = baseOpts();
    opts.email = DEVELOPER_EMAIL;
    apigeeutils.getPromiseSDK()
      .deleteDeveloper(opts)
      .then(r => done())
      .catch(e => done(e));
  });

  it('Delete API Product', done => {
    let opts = baseOpts() ;
    opts.productName = PRODUCT_NAME;

    apigeeutils.getPromiseSDK()
      .deleteProduct(opts)
      .then(result => done())
      .catch(e => done(e));
  });

  it('Delete API private Product', done => {
    let opts = baseOpts();
    opts.productName = PRIVATE_PRODUCT_NAME;

    apigeeutils.getPromiseSDK()
      .deleteProduct(opts)
      .then(result => done())
      .catch(e => done(e));
  });

  it('Undeploy Apigee Proxy With Revision', function(done) {
    assert(deployedRevision);
    let opts = baseOpts();
    opts.api = PROXY_NAME;
    opts.revision = deployedRevision;

    apigeeutils.undeploy(opts, function(err, result) {
      if (verbose) {
        console.log('Undeploy result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          assert.equal(result.name, PROXY_NAME);
          assert.equal(result.environment, config.environment);
          assert.equal(result.state, 'undeployed');
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('Delete the API Proxy', function(done) {
    let opts = baseOpts();
    opts.api = PROXY_NAME;
    apigeeutils.delete(opts, done);
  });

});

describe('List Tests', function() {
  this.timeout(REASONABLE_TIMEOUT);
  this.slow(2000);

  it('Lists Proxies', done => {
    let opts = baseOpts();
    apigeeutils.listProxies(opts, (e, result) => {
      assert(! e);
      assert(result);
      assert(result.length);
      assert(result.length > 2);
      done();
    });
  });

  it('Lists Sharedflows', done => {
    let opts = baseOpts();
    apigeeutils.listSharedflows(opts, (e, result) => {
      assert(! e);
      assert(result);
      assert(result.length);
      assert(result.length > 2);
      done();
    });
  });

});

describe('API Deployment Tests', function() {
  this.timeout(REASONABLE_TIMEOUT);
  this.slow(8000);
  const PROXY_NAME = nameGen.proxy(marker)+ '-2';
  let deployedUri, deployedRevision;

  it('Deploy Apigee Proxy', function(done) {
    let opts = baseOpts();
    opts.api = PROXY_NAME;
    opts.directory = path.join(__dirname, '../test/fixtures/loopback-1');
    apigeeutils.deployProxy(opts, function(err, result) {
      if (verbose) {
        console.log('Deploy result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          if(Array.isArray(result)) {
            result = result[0];
          }
          assert.equal(result.name, PROXY_NAME);
          assert.equal(result.environment, config.environment);
          assert.equal(result.state, 'deployed');
          assert.equal(result.uris.length, 1);
          assert(typeof result.revision === 'number');
          deployedRevision = result.revision;
          deployedUri = result.uris[0];
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('Verify deployed URI - 1', function(done) {
    if (verbose) {
      console.log('Testing %s', deployedUri);
    }
    request(`${deployedUri}/t1`, function(err, resp) {
      if (err) {
        done(err);
      } else {
        try {
          assert.equal(resp.statusCode, 200);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('List Deployments by proxyname', function(done) {
    assert(deployedRevision);
    let opts = baseOpts();
    delete opts.environment;
    opts.api = PROXY_NAME;
    opts.long = true;
    //opts.debug = true;

    apigeeutils.listDeployments(opts, function(err, result) {
      if (verbose) {
        console.log('List result = %j', result);
      }
      if (err) {
        done(err);
      }
      else {
        let deployment =
          result.deployments
          .find(d => (d.name === PROXY_NAME));

        try {
          assert.equal(deployment.name, PROXY_NAME);
          assert.equal(deployment.environment, config.environment);
          assert.equal(deployment.state, 'deployed');
          assert.equal(deployment.revision, deployedRevision);
          assert.equal(deployment.uris.length, 1);
          assert.equal(deployment.uris[0], deployedUri);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('List Deployments by environment', function(done) {
    assert(deployedRevision);
    let opts = baseOpts();
    // environment is set in opts
    apigeeutils.listDeployments(opts, function(err, result) {
      if (verbose) {
        console.log('List result = %j', result);
      }
      if (err) {
        done(err);
      }
      else {
        let deployment =
          result.deployments
          .find(d => (d.name === PROXY_NAME));

        try {
          assert.equal(deployment.name, PROXY_NAME);
          assert.equal(deployment.environment, config.environment);
          assert.equal(deployment.state, 'deployed');
          assert.equal(deployment.revision, deployedRevision);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('Undeploy Apigee Proxy With Revision - A', function(done) {
    assert(deployedRevision);
    let opts = baseOpts();
    opts.api = PROXY_NAME;
    opts.revision = deployedRevision;

    apigeeutils.undeploy(opts, function(err, result) {
      if (verbose) {
        console.log('Undeploy result = %j', result);
      }
      if (err) {
        done(err);
      }
      else {
        try {
          assert.equal(result.name, PROXY_NAME);
          assert.equal(result.environment, config.environment);
          assert.equal(result.state, 'undeployed');
          sleep(3000).then(done); // delay a bit before continuing
          deployedUri = null;
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('Deploy Apigee Proxy with basepath prefix', function(done) {
    deployedUri = null;
    const PROXY_BASE_PATH = nameGen.basePath(marker); // a random basepath
    let opts = baseOpts();
    opts.api = PROXY_NAME;
    //opts.debug = true;
    opts.directory = path.join(__dirname, '../test/fixtures/loopback-1');
    opts['base-path'] = PROXY_BASE_PATH;

    sleep(4000) // the prior undeploy may take some time.
      .then(_ => apigeeutils.getPromiseSDK().deployProxy(opts))
      .then(result => {
        if (verbose) {
          console.log('Deploy result = %j', result);
        }
        try {
          if (Array.isArray(result)) result = result[0];
          assert.equal(result.name, PROXY_NAME);
          assert.equal(result.environment, config.environment);
          assert.equal(result.state, 'deployed');
          assert.equal(result.uris.length, 1);
          assert(typeof result.revision === 'number');
          deployedRevision = result.revision;
          deployedUri = result.uris[0];
          done();
        } catch (e) {
          done(e);
        }
      })
      .catch(e => done(e));

  });

  it('Verify deployed URI - 2', function(done) {
    assert(deployedUri);
    if (verbose) {
      console.log('Testing %s', deployedUri);
    }
    request(`${deployedUri}/t1`, function(err, resp) {
      if (err) {
        done(err);
      } else {
        try {
          assert.equal(resp.statusCode, 200);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  // 20220505-1430
  // proxies with ScriptTarget are no longer supported in Apigee Edge.
  //
  /*

  it('Deploy Apigee Proxy with base path and run NPM remotely', function(done) {
    let opts = baseOpts();
    opts.api = PROXY_NAME;
    opts.directory = path.join(__dirname, '../test/fixtures/employees');
    opts['resolve-modules'] = true;
    opts['base-path'] = PROXY_BASE_PATH;

    apigeeutils.deployProxy(opts, function(err, result) {
      if (verbose) {
        console.log('Deploy result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          if(Array.isArray(result)) result = result[0]
          assert.equal(result.name, PROXY_NAME);
          assert.equal(result.environment, config.environment);
          assert.equal(result.state, 'deployed');
          assert.equal(result.uris.length, 1);
          assert(typeof result.revision === 'number');
          deployedRevision = result.revision;
          deployedUri = result.uris[0];
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('Verify deployed URI', function(done) {
    if (verbose) {
      console.log('Testing %s', deployedUri);
    }
    request(deployedUri, function(err, resp) {
      if (err) {
        done(err);
      } else {
        try {
          assert.equal(resp.statusCode, 200);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });
  */

  it('Undeploy Apigee Proxy With Revision - B', function(done) {
    assert(deployedRevision);
    let opts = baseOpts();
    opts.api = PROXY_NAME;
    opts.revision = deployedRevision;

    apigeeutils.undeploy(opts, function(err, result) {
      if (verbose) {
        console.log('Undeploy result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          assert.equal(result.name, PROXY_NAME);
          assert.equal(result.environment, config.environment);
          assert.equal(result.state, 'undeployed');
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('Fetch proxy', function(done) {
    assert(deployedRevision);
    let opts = baseOpts();
    opts.api = PROXY_NAME;
    opts.revision = deployedRevision;

    apigeeutils.fetchProxy(opts, function(err, result) {
      if (verbose) {
        console.log('Fetch proxy result = %j', util.format(result));
      }
      if (err) {
        done(err);
        return;
      }

      assert(result.filename);
      assert(fs.existsSync(result.filename));
      fs.unlinkSync(result.filename);
      done();

    });
  });

  it('Delete proxy', function(done) {
    let opts = baseOpts();
    opts.api = PROXY_NAME;

    apigeeutils.delete(opts, function(err, result) {
      if (verbose) {
        console.log('Delete proxy result = %j', result);
      }
      if (err) { done(err); }
      else { done(); }
    });
  });

});

  // 20220505-1430
  // proxies with ScriptTarget are no longer supported in Apigee Edge.
  //

// describe('Node.js Apps', function() {
//   this.timeout(REASONABLE_TIMEOUT);
//   const NODE_PROXY_NAME = nameGen.nodeProxy(marker);

//   it('Deploy Node.js App', function(done) {
//     let opts = baseOpts();
//     opts.api = NODE_PROXY_NAME;
//     opts.directory = path.join(__dirname, '../test/fixtures/employeesnode');
//     opts.main = 'server.js';
//     opts['base-path'] = '/apigeeutils-node-test';
//
//     apigeeutils.deployNodeApp(opts, function(err, result) {
//       if (verbose) {
//         console.log('Deploy result = %j', result);
//       }
//       if (err) {
//         done(err);
//       } else {
//         try {
//           if (Array.isArray(result)) result = result[0];
//           assert.equal(result.name, NODE_PROXY_NAME);
//           assert.equal(result.environment, config.environment);
//           assert.equal(result.state, 'deployed');
//           //it will be 2 for remote testing public cloud/ http & https
//           assert.equal(result.uris.length, 2);
//           assert(typeof result.revision === 'number');
//           deployedRevision = result.revision;
//           deployedUri = result.uris[0];
//           done();
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('Verify deployed URI', function(done) {
//     if (verbose) {
//       console.log('Testing %s', deployedUri);
//     }
//     request(deployedUri, function(err, resp) {
//       if (err) {
//         done(err);
//       } else {
//         try {
//           assert.equal(resp.statusCode, 200);
//           done();
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('Check logs from deployed URI', function(done) {
//     let opts = baseOpts();
//     opts.api = NODE_PROXY_NAME;
//
//     var logStream = new stream.PassThrough();
//     logStream.setEncoding('utf8');
//     opts.stream = logStream;
//
//     apigeeutils.getLogs(opts, function(err) {
//       assert(!err);
//
//       var allLogs = '';
//       logStream.on('data', function(chunk) {
//         allLogs += chunk;
//       });
//       logStream.on('end', function() {
//         try {
//           assert(/Listening on port/.test(allLogs));
//           done();
//         } catch (e) {
//           done(e);
//         }
//       });
//     });
//   });
//
//   it('Deploy Node.js App and run NPM remotely', function(done) {
//     let opts = baseOpts();
//     opts.api = NODE_PROXY_NAME;
//     opts.directory = path.join(__dirname, '../test/fixtures/employeesnode');
//     opts.main = 'server.js';
//     opts['resolve-modules'] = true;
//     opts['base-path'] = '/apigeeutils-node-test';
//
//     apigeeutils.deployNodeApp(opts, function(err, result) {
//       if (verbose) {
//         console.log('Deploy result = %j', result);
//       }
//       if (err) {
//         done(err);
//       } else {
//         try {
//           if(Array.isArray(result)) result=result[0]
//           assert.equal(result.name, NODE_PROXY_NAME);
//           assert.equal(result.environment, config.environment);
//           assert.equal(result.state, 'deployed');
//           assert.equal(result.uris.length, 2);
//           assert(typeof result.revision === 'number');
//           deployedRevision = result.revision;
//           deployedUri = result.uris[0];
//           done();
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('Verify deployed URI', function(done) {
//     if (verbose) {
//       console.log('Testing %s', deployedUri);
//     }
//     request(deployedUri, function(err, resp) {
//       if (err) {
//         done(err);
//       } else {
//         try {
//           assert.equal(resp.statusCode, 200);
//           done();
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('List Deployments by app', function(done) {
//     let opts = baseOpts();
//     delete opts.environment;
//     opts.api = NODE_PROXY_NAME;
//     opts.long = true;
//
//     apigeeutils.listDeployments(opts, function(err, result) {
//       if (verbose) {
//         console.log('List result = %j', result);
//       }
//       if (err) {
//         done(err);
//       } else {
//         let deployment =
//           result.deployments
//           .find(d => (d.name === NODE_PROXY_NAME));
//
//         try {
//           assert.equal(deployment.name, NODE_PROXY_NAME);
//           assert.equal(deployment.environment, config.environment);
//           assert.equal(deployment.state, 'deployed');
//           assert.equal(deployment.revision, deployedRevision);
//           assert.equal(deployment.uris.length, 2);
//           assert.equal(deployment.uris[0], deployedUri);
//           done();
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('Undeploy Node.js App Without Revision', function(done) {
//     let opts = baseOpts();
//     opts.api = NODE_PROXY_NAME;
//
//     apigeeutils.undeploy(opts, function(err, result) {
//       if (verbose) {
//         console.log('Undeploy result = %j', result);
//       }
//       if (err) {
//         done(err);
//       } else {
//         try {
//           assert.equal(result.name, NODE_PROXY_NAME);
//           assert.equal(result.environment, config.environment);
//           assert.equal(result.state, 'undeployed');
//           assert.equal(result.revision, deployedRevision);
//           done();
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('Delete node proxy', function(done) {
//     let opts = baseOpts();
//     opts.api = NODE_PROXY_NAME;
//
//     apigeeutils.delete(opts, function(err, result) {
//       if (verbose) {
//         console.log('Delete node proxy result = %j', result);
//       }
//       if (err) { done(err); } else { done(); }
//     });
//   });
//
// }); // End Node.js Apps


// 20220505-1626
// This interface (deploying an AppEngine app with no proxy) is not supported.

// describe('Hosted Target', function() {
//   this.timeout(REASONABLE_TIMEOUT);
//   this.slow(10000);
//   const HOSTED_TARGETS_PROXY_NAME = nameGen.htProxy(marker);
//   let deployedUri, deployedRevision;
//
//   it('Deploy Hosted Targets App', function(done) {
//     let opts = baseOpts();
//     opts.api = HOSTED_TARGETS_PROXY_NAME;
//     opts.directory = path.join(__dirname, '../test/fixtures/hellohostedtargets');
//     opts.main = 'index.js';
//     opts['base-path'] = '/apigeeutils-hostedtargets-test';
//
//     apigeeutils.deployHostedTarget(opts, function(err, result) {
//       if (verbose) {
//         console.log('Deploy result = %j', result);
//       }
//       if (err) {
//         done(err);
//       } else {
//         try {
//           if(Array.isArray(result)) result = result[0];
//           assert.equal(result.name, HOSTED_TARGETS_PROXY_NAME);
//           assert.equal(result.environment, config.environment);
//           assert.equal(result.state, 'deployed');
//           // it will be 2 for remote testing public cloud/ http & https
//           assert.equal(result.uris.length, 2);
//           assert(typeof result.revision === 'number');
//           deployedRevision = result.revision;
//           deployedUri = result.uris[0];
//           setTimeout(done, 10000);
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('List Deployments by API', function(done) {
//     let opts = baseOpts();
//     delete opts.environment;
//     opts.api = HOSTED_TARGETS_PROXY_NAME;
//     opts.long = true;
//
//     apigeeutils.listDeployments(opts, function(err, result) {
//       if (verbose) {
//         console.log('List result = %j', result);
//       }
//       if (err) {
//         done(err);
//       } else {
//         let deployment =
//           result.deployments
//           .find(d => (d.name === HOSTED_TARGETS_PROXY_NAME));
//
//         try {
//           assert.equal(deployment.name, HOSTED_TARGETS_PROXY_NAME);
//           assert.equal(deployment.environment, config.environment);
//           assert.equal(deployment.state, 'deployed');
//           assert.equal(deployment.revision, deployedRevision);
//           assert.equal(deployment.uris.length, 2);
//           assert.equal(deployment.uris[0], deployedUri);
//           done();
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('Verify deployed URI', function(done) {
//     if (verbose) {
//       console.log('Testing %s', deployedUri);
//     }
//     request(deployedUri, function(err, resp, body) {
//       if (err) {
//         console.error(err, resp.statusCode, body);
//         done(err);
//       } else {
//         try {
//           assert.equal(resp.statusCode, 200);
//           done();
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('Check build logs from deployed URI', function(done) {
//     let opts = baseOpts();
//     opts['hosted-build'] = true;
//     opts.api = HOSTED_TARGETS_PROXY_NAME;
//
//     var logStream = new stream.PassThrough();
//     logStream.setEncoding('utf8');
//     opts.stream = logStream;
//     apigeeutils.getLogs(opts, function(err) {
//       assert.ifError(err);
//
//       var allLogs = '';
//       logStream.on('data', function(chunk) {
//         allLogs += chunk;
//       });
//       logStream.on('end', function() {
//         assert(/DONE/.test(allLogs));
//         done();
//       });
//     });
//   });
//
//   it('Check runtime logs from deployed URI', function(done) {
//     let opts = baseOpts();
//     opts['hosted-runtime'] = true;
//     opts.api = HOSTED_TARGETS_PROXY_NAME;
//
//     var logStream = new stream.PassThrough();
//     logStream.setEncoding('utf8');
//     opts.stream = logStream;
//
//     apigeeutils.getLogs(opts, function(err) {
//       assert.ifError(err);
//
//       var allLogs = '';
//       logStream.on('data', function(chunk) {
//         allLogs += chunk;
//       });
//       logStream.on('end', function() {
//         //Validate runtime logs
//         assert(/Node HTTP server is listening/.test(allLogs));
//         done();
//       });
//     });
//   });
//
//   it('Undeploy Hosted Targets App Without Revision', function(done) {
//     let opts = baseOpts();
//     opts.api = HOSTED_TARGETS_PROXY_NAME;
//
//     apigeeutils.undeploy(opts, function(err, result) {
//       if (verbose) {
//         console.log('Undeploy result = %j', result);
//       }
//       if (err) {
//         done(err);
//       } else {
//         try {
//           assert.equal(result.name, HOSTED_TARGETS_PROXY_NAME);
//           assert.equal(result.environment, config.environment);
//           assert.equal(result.state, 'undeployed');
//           assert.equal(result.revision, deployedRevision);
//           done();
//         } catch (e) {
//           done(e);
//         }
//       }
//     });
//   });
//
//   it('Delete hosted target proxy', function(done) {
//     let opts = baseOpts();
//     opts.api = HOSTED_TARGETS_PROXY_NAME;
//
//     apigeeutils.delete(opts, function(err, result) {
//       if (verbose) {
//         console.log('Delete hosted target proxy result = %j', result);
//       }
//       if (err) { done(err); } else { done(); }
//     });
//   });
//
// }); // end hosted target tests


describe('Caches', function() {
  const CACHE1_NAME = nameGen.cache1(marker),
        CACHE2_NAME = nameGen.cache2(marker);
  this.slow(1100);

  it('Create a Cache Resource', done => {
    let opts = baseOpts();
    opts.cache = CACHE1_NAME;
    apigeeutils.createCache(opts,function(err,result) {
      if (verbose) {
        console.log('Create Cache result = %j', result);
      }
      if (err) {
        done(err);
      }
      else {
        done();
      }
    });
  });

  it('Get Cache Resource', (done) => {
    let opts = baseOpts();
    opts.cache = CACHE1_NAME;
    apigeeutils.getCache(opts, (err,result) => {
      if (verbose) {
        console.log('Get Cache result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });

  it('Clear Cache', (done) => {
    let opts = baseOpts();
    opts.cache = CACHE1_NAME;
    apigeeutils.clearCache(opts, (err,result) => {
      if (verbose) {
        console.log('Clear Cache result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });

  it('Delete Cache Resource', (done) => {
    let opts = baseOpts();
    opts.cache = CACHE1_NAME;
    apigeeutils.deleteCache(opts, (err,result) => {
      if (verbose) {
        console.log('Delete Cache result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });

  it('Create an Cache Resource with description and expiry in date', done => {
    let opts = baseOpts();
    opts.cache = CACHE2_NAME;
    opts.description = 'sample cache';
    opts.cacheExpiryByDate = '12-31-2025';
    apigeeutils.createCache(opts,function(err,result) {
      if (verbose) {
        console.log('Create Cache result = %j', result);
      }
      if (err) {
        done(err);
      }
      else {
        apigeeutils.deleteCache(opts,function(delete_err,delete_result) {
          if (verbose) {
            console.log('Delete Cache result = %j', delete_result);
          }
          if (delete_err) {
            done(delete_err);
          }
          else {
            done();
          }
        });
      }
    });
  });

  it('Create an Cache Resource with description and expiry in secs', done => {
    let opts = baseOpts();
    opts.cache = CACHE2_NAME;
    opts.description = 'description two';
    opts.cacheExpiryInSecs = '5000';
    apigeeutils.createCache(opts, function(err,result) {
      if (verbose) {
        console.log('Create Cache result = %j', result);
      }
      if (err) {
        done(err);
      }
      else {
        apigeeutils.deleteCache(opts,function(delete_err,delete_result) {
          if (verbose) {
            console.log('Delete Cache result = %j', delete_result);
          }
          if (delete_err) {
            done(delete_err);
          }
          else {
            done();
          }
        });
      }
    });
  });

  it('Create an Cache Resource with description and expiry in secs, date', done => {
    let opts = baseOpts();
    opts.cache = CACHE2_NAME;
    opts.description = 'more description here';
    opts.cacheExpiryByDate = '31-12-2025';
    opts.cacheExpiryInSecs = '5000';
    apigeeutils.createCache(opts, function(e,result) {
      if (verbose) {
        console.log('Create Cache result = %j', result);
      }
      done(e);
      // if (err) {
      //   done(err);
      // }
      // else {
      //   apigeeutils.deleteCache(opts,function(delete_err,delete_result) {
      //     if (verbose) {
      //       console.log('Delete Cache result = %j', delete_result);
      //     }
      //     if (delete_err) {
      //       done(delete_err);
      //     }
      //     else {
      //       done();
      //     }
      //   });
      // }
    });
  });

  it('List Cache Resources', (done) => {
    let opts = baseOpts();
    apigeeutils.listCaches(opts, (err,result) => {
      if (verbose) {
        console.log('List Cache result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        assert(result.length);
        // get just the caches that look like test caches.
        let testcaches = result.filter(name =>
                                       name.startsWith('apigeeutils-test-cache'));
        assert(testcaches.length);
        async.series(
          testcaches
            .map(name => {
              let opts = baseOpts();
              opts.cache = name;
              return function(done) { apigeeutils.deleteCache(opts, done);};
            }),
          function(e, results) {
            if (e) { return done(e);}
            if (verbose) {
              console.log('delete Cache result = %j', result);
            }
            done();
          });
      }
    });
  });


}); // end cache tests


describe('Target Servers', function() {
  this.timeout(REASONABLE_TIMEOUT);
  this.slow(600);
  const TARGET_SERVER_NAME = nameGen.targetServer(marker);

  it('Create Target Server', done => {
    let opts = baseOpts();
    opts.environment = config.environment;
    opts.targetServerName = TARGET_SERVER_NAME;
    opts.targetHost = 'localhost';
    opts.targetEnabled = true;
    opts.targetPort = 443;
    opts.targetSSL = true;

    apigeeutils.createTargetServer(opts, function(err, result) {
      if (verbose) {
        console.log('Create Target Server result = %j', result);
      }
      if (err) {
        done(err);
      }
      else {
        try {
          assert.equal(result.name,TARGET_SERVER_NAME);
          assert.equal(result.port,443);
          assert.equal(result.isEnabled,true);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('List Target Servers', done => {
    let opts = baseOpts();
    opts.environment = config.environment;
    apigeeutils.listTargetServers(opts, function(err, result) {
      if (verbose) {
        console.log('List Target Servers result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          assert.equal(result.includes(TARGET_SERVER_NAME),true);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('Get Target Server', done => {
    let opts = baseOpts();
    opts.environment = config.environment;
    opts.targetServerName = TARGET_SERVER_NAME;
    apigeeutils.getTargetServer(opts, function(err, result) {
      if (verbose) {
        console.log('Get Target Server result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          assert.equal(result.name,TARGET_SERVER_NAME);
          assert.equal(result.port,443);
          assert.equal(result.isEnabled,true);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('Update Target Server', done => {
    let opts = baseOpts();
    opts.environment = config.environment;
    opts.targetServerName = TARGET_SERVER_NAME;
    opts.targetEnabled = false;
    apigeeutils.updateTargetServer(opts, function(err, result) {
      if (verbose) {
        console.log('Get Target Server result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          assert.equal(result.name,TARGET_SERVER_NAME);
          assert.equal(result.port,443);
          assert.equal(result.isEnabled,false);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('Delete Target Server', done => {
    let opts = baseOpts();
    opts.environment = config.environment;
    opts.targetServerName = TARGET_SERVER_NAME;
    apigeeutils.deleteTargetServer(opts, function(err, result) {
      if (verbose) {
        console.log('Delete Target Server result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          assert.equal(result.name,TARGET_SERVER_NAME);
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });
}); // end target server tests


describe('KVM', function() {
  this.slow(1000);

  let kvm_entry_name = 'test-' + faker.random.alphaNumeric(8),
      kvm_entry_value = faker.random.alphaNumeric(68),
      updated_entry_value = "NEW VALUE " + faker.random.alphaNumeric(32),
      KVM1_NAME = nameGen.kvm1(marker),
      KVM2_NAME = nameGen.kvm2(marker);

  it('Create KVM', done => {
    let opts = baseOpts();
    opts.mapName = KVM1_NAME;
    opts.environment = config.environment;
    apigeeutils.getPromiseSDK()
      .createKVM(opts)
      .then(res => {
        if (verbose) {
          console.log('Create KVM result = %j', res);
        }
        done();
      })
      .catch(e => {
        console.log(e);
        done(e);
      });
  });

  it('Create Encrypted KVM', done => {
    let opts = baseOpts();
    opts.mapName = KVM2_NAME;
    opts.environment = config.environment;
    opts.encrypted = true;
    apigeeutils.getPromiseSDK()
      .createKVM(opts)
      .then( res => {
        if (!res.encrypted) {
          return done(new Error('Map was not encrypted'));
        } else if (verbose) {
          console.log('Create KVM result = %j', res);
        }
        done();
      })
      .catch(e => {
        console.log(e);
        done(e);
      });
  });

  it('Delete Encrypted KVM', done => {
    let opts = baseOpts();
    opts.mapName = KVM2_NAME;
    opts.environment = config.environment;
    apigeeutils.deleteKVM(opts, function(err,result) {
      if (verbose) {
        console.log('Delete Encrypted KVM result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });

  it('Add Entry to KVM', done => {
    let opts = baseOpts();
    opts.mapName = KVM1_NAME;
    opts.environment = config.environment;
    opts.entryName = kvm_entry_name;
    opts.entryValue = kvm_entry_value;
    apigeeutils.getPromiseSDK()
      .addEntryToKVM(opts)
      .then(res => {
        if (verbose) {
          console.log('Add Entry to KVM result = %j', res);
        }
        done();
      })
      .catch(e => {
        console.log(e);
        done(e);
      });
  });

  it('Get KVM Entry', function(done) {
    let opts = baseOpts();
    opts.mapName = KVM1_NAME;
    opts.environment = config.environment;
    opts.entryName = kvm_entry_name;
    apigeeutils.getPromiseSDK()
      .getKVMentry(opts)
      .then(body => {
        if (verbose) {
          console.log('Get KVM Entry result = %j', body);
        }
        assert.equal(body.value, kvm_entry_value);
        done();
      })
      .catch(e => {
        console.log(e);
        done(e);
      });

  });

  it('Update KVM Entry', function(done) {
    let opts = baseOpts();
    opts.mapName = KVM1_NAME;
    opts.environment = config.environment;
    opts.entryName = kvm_entry_name;
    opts.entryValue = updated_entry_value;
    let apigee = apigeeutils.getPromiseSDK();
    apigee.updateKVMentry(opts)
      .then(body => {
        if (verbose) {
          console.log('Update KVM Entry result = %j', body);
        }
        assert.equal(updated_entry_value, body.value);
        delete opts.entryValue;
        return apigee.getKVMentry(opts)
          .then(body => {
            if (verbose) {
              console.log('Get KVM Entry result = %j', body);
            }
            assert.equal(updated_entry_value, body.value);
            done();
          });
      })
      .catch(e => {
        console.log(e);
        done(e);
      });

  });

  it('Get KVM Map', function(done) {
    let opts = baseOpts();
    opts.mapName = KVM1_NAME;
    opts.environment = config.environment;
    apigeeutils.getPromiseSDK()
      .getKVMmap(opts)
      .then(function(body){
        if (verbose) {
          console.log('Get KVM Map result = %j', body);
        }
        assert.equal(body.entry.length, 1);
        done();
      })
      .catch(e => {
        console.log(e);
        done(e);
      });
  });

  it('Delete KVM Entry', function(done) {
    let opts = baseOpts();
    opts.mapName = KVM1_NAME;
    opts.environment = config.environment;
    opts.entryName = kvm_entry_name;
    apigeeutils.getPromiseSDK()
      .deleteKVMentry(opts)
      .then(function(body){
        if (verbose) {
          console.log('Get KVM Map result = %j', body);
        }
        assert.equal(updated_entry_value, body.value);
        done();
      })
      .catch(e => {
        console.log(e);
        done(e);
      });
  });

  it('Delete KVM', done => {
    let opts = baseOpts();
    opts.mapName = KVM1_NAME;
    opts.environment = config.environment;
    apigeeutils.deleteKVM(opts,function(err,result) {
      if (verbose) {
        console.log('Delete KVM result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });
}); // end KVM tests


describe('SharedFlows and FlowHooks', function() {
  this.timeout(REASONABLE_TIMEOUT);
  this.slow(3200);

  const SHARED_FLOW_NAME = nameGen.sf(marker);
  let originalPreProxyFh;

  it('Deploy SharedFlow', done => {
    let opts = baseOpts();
    opts.name = SHARED_FLOW_NAME;
    opts.directory = path.join(__dirname, '../test/fixtures/employees-sf');
    apigeeutils.deploySharedflow(opts, function (err, result) {
      if (verbose) {
        console.log('Deploy result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          if (Array.isArray(result)) {
            result = result[0];
          }
          assert.equal(result.name, SHARED_FLOW_NAME);
          assert.equal(result.environment, config.environment);
          assert.equal(result.state, 'deployed');
          assert(typeof result.revision === 'number');
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('listSharedFlowDeployments by SF name', function(done) {
    let opts = baseOpts();
    delete opts.environment;
    opts.name = SHARED_FLOW_NAME;
    opts.revision = 1;

    apigeeutils.listSharedflowDeployments(opts, function(err, result) {
      if (verbose) {
        console.log('listSharedFlowDeployments result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        try {
          result = result.deployments[0];
          assert.equal(result.name, SHARED_FLOW_NAME);
          assert.equal(result.environment, config.environment);
          assert.equal(result.state, 'deployed');
          assert(typeof result.revision === 'number');
          done();
        } catch (e) {
          done(e);
        }
      }
    });
  });

  it('fetchSharedFlow', function(done) {
    let opts = baseOpts();
    opts.name = SHARED_FLOW_NAME;
    opts.revision = 1;

    apigeeutils.fetchSharedflow(opts, function(err, result) {
      if (verbose) {
        console.log('fetchSharedFlow result: %j', util.format(result));
      }
      if (err) {
        done(err);
        return;
      }

      assert(result.filename);
      assert(fs.existsSync(result.filename));
      fs.unlinkSync(result.filename);
      done();

    });
  });

  it('get original PreProxy Flowhook', function(done) {
    let opts = baseOpts();
    opts.flowHookName = "PreProxyFlowHook";

    apigeeutils.getFlowHook(opts, function(err, result) {
      if (verbose) {
        console.log('original PreProxy flowhook result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        if( result.sharedFlow ) {
          originalPreProxyFh = result.sharedFlow;
        }
        done();
      }
    });
  });

  it('attachFlowHook', function(done) {
    let opts = baseOpts();
    opts.flowHookName = "PreProxyFlowHook";
    opts.sharedFlowName = SHARED_FLOW_NAME;

    apigeeutils.attachFlowHook(opts, function(err, result) {
      if (verbose) {
        console.log('attachFlowHook result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });

  it('detachFlowHook', function(done) {
    let opts = baseOpts();
    opts.flowHookName = "PreProxyFlowHook";

    apigeeutils.detachFlowHook(opts, function(err, result) {
      if (verbose) {
        console.log('detachFlowHook result = %j', result);
      }
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });

  it('re-attachFlowHook', function(done) {
    if( originalPreProxyFh ) {
      let opts = baseOpts();
      opts.flowHookName = "PreProxyFlowHook";
      opts.sharedFlowName = originalPreProxyFh;

      apigeeutils.attachFlowHook(opts, function(err, result) {
        if (verbose) {
          console.log('originalPreProxyFh ' + originalPreProxyFh );
          console.log('re-attachFlowHook result = %j', result);
        }
        if (err) {
          done(err);
        } else {
          done();
        }
      });
    } else {
      done();
    }
  });

  it('undeploySharedFlow', function(done) {
    let opts = baseOpts();
    opts.name = SHARED_FLOW_NAME;
    apigeeutils.undeploySharedflow(opts, function(err, result) {
      if (err) {
        done(err);
      } else { // If response is non-200 it throws an Error
        done();
      }
    });
  });

  it('deleteSharedFlow', function(done) {
    let opts = baseOpts();
    opts.name = SHARED_FLOW_NAME;
    apigeeutils.deleteSharedflow(opts, done);
  });

}); // end shared flow tests


describe('User Roles and Permissions', function() {
  this.timeout(REASONABLE_TIMEOUT);
  this.slow(1000);
  const ROLE_NAME = nameGen.role(marker);

  it('Create Role', done => {
    let opts = baseOpts();
    opts.roleName = ROLE_NAME;

    apigeeutils.createRole(opts, function (err, result) {
      if (verbose) {
        console.log('Create Role result = %j', result);
      }
      if (err) {
        done(err);
      }
      else {
        done();
      }
    });
  });

  it('Get Role', done => {
    let opts = baseOpts();
    opts.roleName = ROLE_NAME;

    apigeeutils.getRole(opts, function (err, result) {
      if (verbose) {
        console.log('Get Role result = %j', result);
      }
      if (err) { done(err); } else { done(); }
    });
  });

  it('List Roles', done => {
    let opts = baseOpts();

    apigeeutils.listRoles(opts, function (err, result) {
      if (verbose) {
        console.log('List Roles result = %j', result);
      }
      if (err) { done(err); } else {
        assert.equal( result.includes(ROLE_NAME), true );
        done();
      }
    });
  });

  it('Set Role Permissions', done => {
    let opts = baseOpts();
    opts.roleName = ROLE_NAME;
    opts.permissions = '[{"path":"/userroles","permissions":["get"]}]';

    apigeeutils.setRolePermissions(opts, function (err, result) {
      if (verbose) {
        console.log('Set Role Permissions result = %j', result);
      }
      if (err) { done(err); } else { done(); }
    });
  });

  it('Get Role Permissions', done => {
    let opts = baseOpts();
    opts.roleName = ROLE_NAME;

    apigeeutils.getRolePermissions(opts, function (err, result) {
      if (verbose) {
        console.log('Get Role Permissions result = %j', result);
      }
      if (err) { done(err); } else { done(); }
    });
  });

  it('Assign User to Role', done => {
    let opts = baseOpts();
    opts.roleName = ROLE_NAME;
    opts.email = config.useremail;

    apigeeutils.assignUserRole(opts, function (err, result) {
      if (verbose) {
        console.log('Assign User to Role result = %j', result);
      }
      if (err) { done(err); } else { done(); }
    });
  });

  it('Verify User in Role', done => {
    let opts = baseOpts();
    opts.roleName = ROLE_NAME;
    opts.email = config.useremail;

    apigeeutils.verifyUserRole(opts, function (err, result) {
      if (verbose) {
        console.log('Verify User in Role result = %j', result);
      }
      if (err) { done(err); } else {
        assert.equal( result.emailId, opts.email);
        done();
      }
    });
  });

  it('List Users in a Role', done => {
    let opts = baseOpts();
    opts.roleName = ROLE_NAME;
    opts.email = config.useremail;

    apigeeutils.listRoleUsers(opts, function (err, result) {
      if (verbose) {
        console.log('List Users in a Role result = %j', result);
      }
      if (err) { done(err); } else {
        assert.equal( result.includes(opts.email), true);
        done();
      }
    });
  });

  // 20220505-1458
  // This will not work with an Apigee Org with MFA
  // it('Verify access allowed', done => {
  //   let opts = baseOpts();
  //   opts.netrc = false;
  //   opts.username = config.useremail;
  //   opts.password = config.userpassword;
  //   apigeeutils.listRoles(opts, function (err, result) {
  //     if (verbose) {
  //       console.log('Verify access allowed for user %s result = %j', config.useremail, result);
  //     }
  //     if (err) { done(err); } else { done(); }
  //   });
  // });

  it('Remove User from Role', done => {
    let opts = baseOpts();
    opts.roleName = ROLE_NAME;
    opts.email = config.useremail;

    apigeeutils.removeUserRole(opts, function (err, result) {
      if (verbose) {
        console.log('Remove User from Role result = %j', result);
      }
      if (err) { done(err); } else { done(); }
    });
  });

  it('Delete Role', done => {
    let opts = baseOpts();
    opts.roleName = ROLE_NAME;

    apigeeutils.deleteRole(opts, function (err, result) {
      if (verbose) {
        console.log('Delete Role result = %j', result);
      }
      if (err) { done(err); } else { done(); }
    });
  });
}); // End User Roles and Permissions


function baseOpts() {
  var o = {
    organization: config.organization,
    username: config.username,
    password: config.password,
    environments: config.environment,
    verbose: config.verbose,
    debug: config.debug,
    environment: config.environment,
    token: config.token,
    netrc: config.netrc
  };
  if (config.baseuri) {
    o.baseuri = config.baseuri;
  }
  return o;
}