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
ApiDnaData.prototype.getApp = function(uuid, cb) {
  this.database.getApp(uuid, cb);
};

/*
 * Retrieve an application by key. If not found, then error will be undefined and so will
 * the application -- error will only be set on a true error.
 */
ApiDnaData.prototype.getAppByKey = function(key, cb) {
  this.database.getAppByKey(key, cb);
};
