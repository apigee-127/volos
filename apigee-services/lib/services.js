//
// apigee-services
//
// This is a module that acts as a very simple service locator framework. It lets services be registered,
// and then lets clients look them up.

var util = require('util');

if (process.env.NODE_DEBUG && /apigee-services/.test(process.env.NODE_DEBUG)) {
  debug = function(msg) {
    console.log(msg);
  }
}

var registry = {};

// Register a service. "serviceType" is the key into the registry. "providerName" specifies who is
// providing the service. "service" is the object that actually implements the service.
// if "isDefault" is true, then the service will be returned as the result of any "locate"
// call that does not specifically request something.
// Newly-registered services will go on the front of the list, so that the most recently-registered
// service always has top priority.
function register(serviceType, providerName, service, isDefault) {
  if (!registry[serviceType]) {
    registry[serviceType] = new ServiceType(serviceType);
  }

  registry[serviceType].addProvider(providerName, service, isDefault);

  if (debug) {
    debug(util.format('Registered provider %s for %s default = %s', providerName, serviceType, isDefault));
  }
}
exports.register = register;

// Locate the first service that matches. If "providerName" is specified, then only return the service
// that matches the name. Otherwise, return the default provider, and if none is registered, then return
// the first service that is available.
// Otherwise, return undefined.
function locate(serviceType, providerName) {
  if (debug) {
    debug(util.format('Locating %s (%s)', serviceType, providerName));
  }
  var type = registry[serviceType];
  if (!type) {
    if (debug) {
      debug('Type not found');
    }
    return type;
  }

  if (providerName) {
    // Return only the first service that matches the provider
    for (p in type.providers) {
      if (providerName === type.providers[p].name) {
        if (debug) {
          debug(util.format('Returning %s for %s', providerName, serviceType));
        }
        return type.providers[p].service;
      }
    }
    if (debug) {
      debug(util.format('No provider found matching %s', providerName));
    }
    return undefined;
  }

  // Return the default provider otherwise
  if (type.defaultProvider) {
    if (debug) {
      debug(util.format('Returning the default provider'));
    }
    return type.defaultProvider.service;
  }

  // Or just return the first one
  if (type.providers.length > 0) {
    if (debug) {
      debug(util.format('Returning provider %s', type.providers[0].name));
    }
    return type.providers[0].service;
  }

  // Fall through
  return undefined;
}
exports.locate = locate;

function ServiceType(type) {
  if (!(this instanceof ServiceType)) {
    return new ServiceType(type);
  }

  this.type = type;
  this.providers = [];
}

ServiceType.prototype.addProvider = function(name, service, isDefault) {
  this.providers.unshift(new ServiceProvider(name, service));
  if (isDefault) {
    this.defaultProvider = service;
  }
};

function ServiceProvider(name, service) {
  if (!(this instanceof ServiceProvider)) {
    return new ServiceProvider(name, service);
  }

  this.name = name;
  this.service = service;
}


