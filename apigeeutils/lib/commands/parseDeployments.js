'use strict';

/*
 * This module is not so much a command as a utility that is used by
 * many commands. It looks at a deployed API proxy and figures out which
 * URI to use in order to invoke it.
 */

const async = require('async'),
      defaults = require('../defaults'),
      url = require('url'),
      util = require('util');

/*
 * Given a deployment record (as shown below) return a pretty-printed string.
 */
module.exports.formatDeployment = function(d) {
  var s = '';
  s += util.format('"%s" Revision %d\n', d.name, d.revision);
  s += util.format('  %s\n', d.state);
  s += util.format('  environment = %s\n', d.environment);
  if (d.basePath) { // basePath is undefined for sharedflow
    s += util.format('  base path = %s\n', d.basePath);
  }
  if (d.uris) {
    d.uris.forEach(function(uri) {
      s += util.format('  URI = %s\n', uri);
    });
  }
  if (d.partialResults) {
    d.partialResults.forEach(function(r) {
      s += util.format('Partial Failure: %j', r);
    });
  }
  return s;
};

/*
 * Parse the result from a "deploy" or "undeploy" API call and figure out which revision
 * actually got deployed. The result may be passed to "getPathInfo"
 */
module.exports.parseDeploymentResult = function(d) {
  if (!(d && (d.aPIProxy || d.sharedFlow))) {
    // Not even a proxy (or a sharedFlow)
    return null;
  }

  var r = {
    name: d.aPIProxy || d.sharedFlow
  };

  var deployed;
  if (d.environment && Array.isArray(d.environment)) {
    // Multiple result. Find the first environment result that has state "deployed"
    deployed = d.environment.find(e => (e.state === 'deployed'));

    if (!deployed) {
      // None, so take the highest revision number
      deployed = d.environment.reduce(
        (a, b) => (parseInt(a.revision) >= parseInt(b.revision) ? a : b), {});
    }
  } else {
    deployed = d;
  }

  addDeploymentInfo(r, deployed);
  return r;
};

function addDeploymentInfo(r, deployed) {
  r.environment = deployed.environment;
  r.revision = parseInt(deployed.revision);
  r.state = deployed.state;
  r.basePath = (deployed.configuration &&
    deployed.configuration.basePath) ? deployed.configuration.basePath : 'N/A';

  // Now figure out if there are partial failures
  deployed.server.forEach(s => {
    // Add partial failure info
    if (s.status !== r.state) {
      if (!r.partialResults) {
        r.partialResults = [];
      }
      r.partialResults.push(s);
    }
  });
}

/*
 * Parse the deployments from the other commands to get URIs. The "deployments"
 * must be an array of objects, and each must contain the following
 * fields:
 *   name
 *   environment
 *   revision (number)
 *   state (such as 'deployed')
 *   basePath
 * This function will add a "uris" array to each deployment that lists all
 * the valid URIs for the specified deployment.
 */
module.exports.getPathInfo = function(deployments, opts, cb) {
  var request = defaults.defaultRequest(opts);
  /*deployments = deployments.filter(function( d){
       return d.state === 'deployed'
   })*/
  async.eachLimit(deployments, opts.asynclimit, function(item, done) {
    fillInProxies(item, opts, request, done);
  }, function(err) {
    if (opts.debug) {
      console.log('Final result: err = %j for deployments = %j', err, deployments);
    }
    cb(err);
  });
};

function fillInProxies(deployment, opts, request, done) {
  if (deployment.state !== 'deployed') {
      if (opts.debug) {
          console.log ('API %s for env %s is not in deployed state so not going to get more details', deployment.name, deployment.environment);
      }
      return done();
  }
  deployment.uris = [];
  var vhosts = {};

  // First get the list of proxies
  var uri = util.format('%s/v1/o/%s/apis/%s/revisions/%d/proxies',
                        opts.baseuri, opts.organization, deployment.name,
                        deployment.revision);
  if (opts.debug) {
    console.log('GET %s', uri);
  }
  request.get(uri, function(err, req, body) {
      if (err) {
        done(err);
      } else {
        if (req.statusCode === 200) {
          // At this point we should have an array of proxy names
          if (opts.debug) {
            console.log('Got proxy list: %j', body);
          }
          async.eachSeries(body, function(item, itemDone) {
            fillInProxy(deployment, vhosts, item, opts, request, itemDone);
          }, done);
        } else {
          done(new Error(util.format('HTTP Error getting proxies: %d', req.statusCode)));
        }
      }
    }
  );
}

function fillInProxy(deployment, vhosts, proxyName, opts, request, done) {
  // Get the proxy info
  var uri = util.format('%s/v1/o/%s/apis/%s/revisions/%d/proxies/%s',
                        opts.baseuri, opts.organization, deployment.name,
                        deployment.revision, proxyName);
  if (opts.debug) {
    console.log('GET %s', uri);
  }
  request.get(uri, function(err, req, body) {
        if (err) {
          done(err);
        } else {
          if (req.statusCode === 200) {
            // At this point we have the definition of the proxy
            var proxyBasePath = body.connection.basePath;
            if (body.connection && body.connection.virtualHost) {
              async.eachSeries(body.connection.virtualHost, function(item, itemDone) {
                fillInVirtualHost(deployment, vhosts, item, proxyBasePath, opts, request, itemDone);
              }, done);
            } else {
              // Don't recognize what we got back so keep on trucking
              done();
            }
          } else {
            done(new Error(util.format('Error getting proxy %s, status code %d', proxyName, req.statusCode)));
          }
        }
      }
  );
}

function fillInVirtualHost(deployment, vhosts, vhostName, proxyBasePath, opts, request, done) {
  if (vhosts[vhostName]) {
    // we already looked up this virtual host -- short-circuit
    addProxyUri(deployment, vhosts[vhostName], proxyBasePath);
    done();
  } else {
    var uri = util.format('%s/v1/o/%s/e/%s/virtualhosts/%s',
                          opts.baseuri, opts.organization, deployment.environment,
                          vhostName);
    if (opts.debug) {
      console.log('GET for virtualHost %s', uri);
    }
    request.get(uri, function(err, req, body) {
        if (err) {
          done(err);
        } else {
          if (req.statusCode === 200) {
            // Now we should have a virtual host object. cache it too.
            vhosts[vhostName] = body;
            addProxyUri(deployment, body, proxyBasePath);
            if (opts.debug) {
              console.log('Uris: %j', deployment.uris);
            }
            done();
          } else {
            done(new Error(util.format('Error getting virtual host: %s for proxy %s , status code %d', vhostName, deployment.name, req.statusCode)));
          }
        }
      }
    );
  }
}

function addProxyUri(deployment, vhost, proxyBasePath) {
  var protocol;
  if (vhost.sSLInfo && vhost.sSLInfo.enabled) {
    protocol = 'https';
  } else {
    protocol = 'http';
  }
  if (vhost.hostAliases && vhost.hostAliases.length > 0) {
    vhost.hostAliases.forEach(item =>
                              finishProxyUri(deployment, protocol, vhost.port, proxyBasePath, item));

  } else {
    finishProxyUri(deployment, protocol, vhost.port, proxyBasePath, 'ROUTER_HOST');
  }
}

function finishProxyUri(deployment, protocol, port, proxyBasePath, hostAlias) {
  let uriparts = {
    protocol: protocol,
    hostname: hostAlias,
    pathname: deployment.basePath
  };
  if (((protocol === 'http') && (port != 80)) ||
      ((protocol === 'https') && (port != 443))) {
    uriparts.port = port;
  }

  var uri = url.format(uriparts);
  if (/^\/.+/.test(proxyBasePath)) {
    // Proxy base path starts with a slash and is not just a slash
    // Don't double-slash!
    if (/.*\/$/.test(uri)) {
      uri += proxyBasePath.substring(1);
    } else {
      uri += proxyBasePath;
    }
  }
  deployment.uris.push(uri);
}
