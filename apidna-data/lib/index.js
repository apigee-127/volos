/* This package provides a basic database capability for API DNA. It loads the appropriate
 * database based on a configuration file.
 *
 * Data structure:
 *
 * Each application is represented by the following JSON structure:
 * {
 *   name: string,
 *   uuid: string,
 *   displayName: string,
 *   key: string,
 *   secret: string,
 *   developer: {
 *     uuid: string,
 *     email: string,
 *     fullName: string
 *     },
 *   attributes: {
 *     name: value,
 *     name2: value2
 *   }
 * }
 *
 * Callback:
 *
 * A completion callback is made for each function. It is always called with two parameters. The first
 * is an Error object if the call failed, and undefined if it was successful. The second is a data
 * object as shown above.
 *
 * Options:
 *
 * A few calls take "options" to define what is retrieved. If set, then they are as follows:
 *
 *   options.getDeveloper: If true, retrieve information about the developer as well as the app. Default false.
 *   options.getAttributes: If true, retrieve the applications attributes as well as the app. Default true.
 */

var uuid = require('uuid');

/*
 * TODO: Pass in your own implementation of the interface
 */

function ApiDnaData(options) {
  if (options.database === 'postgres') {
    if (!options.postgres) {
      throw new Error('postgres options must be specified');
    }
    var pg = require('./postgres');
    this.database = new pg.Postgres(options.postgres);

  } else {
    throw new Error('Invalid database ' + options.database);
  }
}
module.exports.ApiDnaData = ApiDnaData;

/*
 * Create a new developer. The object must contain the fields "fullName" and "email".
 */
ApiDnaData.prototype.insertDeveloper = function(data, cb) {
  if (data.uuid) {
    cb(new Error('uuid field must not be set -- it will be generated'));
  }

  data.uuid = uuid.v4();
  this.database.insertDeveloper(data, cb);
};

/*
 * Remove a developer by UUID.
 */
ApiDnaData.prototype.deleteDeveloper = function(uuid, cb) {
  this.database.deleteDeveloper(uuid, cb);
};

/**
 * Retrieve a developer by UUID.
 */
ApiDnaData.prototype.getDeveloper = function(uuid, cb) {
  this.database.getDeveloper(uuid, cb);
};

/*
 * Create a new application. All the fields above must be filled out except for "uuid" of the application --
 * this will be assigned later.
 */
ApiDnaData.prototype.insertApp = function(data, cb) {
  if (data.uuid) {
    cb(new Error('uuid field must not be set -- it will be generated'));
  }

  data.uuid = uuid.v4();
  this.database.insertApp(data, cb);
};

/*
 * Remove an application by UUID. The deleted field is not automatically returned -- the only argument
 * to the callback is the error, or undefined if there was no error.
 */
ApiDnaData.prototype.deleteApp = function(uuid, cb) {
  this.database.deleteApp(uuid, cb);
};

/*
 * Retrieve an application by UUID. If not found, then error will be undefined and so will
 * the application -- error will only be set on a true error.
 */
ApiDnaData.prototype.getApp = function(uuid, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = undefined;
  }
  options = defaultOptions(options);
  this.database.getApp(uuid, options, cb);
};

/*
 * Retrieve an application by key. If not found, then error will be undefined and so will
 * the application -- error will only be set on a true error.
 */
ApiDnaData.prototype.getAppByKey = function(key, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = undefined;
  }
  options = defaultOptions(options);
  this.database.getAppByKey(key, options, cb);
};

var DefaultOptions = {
  getDeveloper: false,
  getAttributes: true
};

function defaultOptions(options) {
  if (!options) {
    return DefaultOptions;
  }
  if (options.getDeveloper === undefined) {
    options.getDeveloper = DefaultOptions.getDeveloper;
  }
  if (options.getAttributes === undefined) {
    options.getAttributes = DefaultOptions.getAttributes;
  }
  return options;
}
