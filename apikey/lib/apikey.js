/*
 * This module validates API calls by API key. It depends on the "apidna-data" module, which in turn plugs
 * in to a back end for data storage and retrieval. To use this package, first instantiate an "ApiDnaData"
 * object, then use it here.
 */

function ApiKey(options) {
  if (!options.data) {
    throw new Error('Options must include "data" pointing to an ApiDnaData object');
  }
  this.data = options.data;
}
module.exports.ApiKey = ApiKey;

/*
 * Validate an API key, and call "cb" when validation is complete. "cb" will have two parameters: first is an
 * Error object if the validation fails for some reason. Second is the application record, as defined
 * in ApiDnaData.
 *
 * If "options" is specified, then it can have two options:
 *   getDeveloper: Whether to include "developer" information with the result. Default false.
 *   getAttributes: Whether to include application attributes with the result. Default true.
 *   (See the "apidna-data" package for a definition of these options as well.)
 *
 * The callback has two options: an error and a result.
 *
 * If the API key is valid, then "cb" will be called with (undefined, result).
 *   "result" will contain a field called "application" which will contain the app's name and attributes.
 * If the API key is not valid, then "cb" will be called with (undefined, result)
 *   "result" will contain a field called "error" which will contain two attributes: "code" and "message"
 * If there is another error, then "cb" will be called with (error, undefined)
 *   "Error" in this case will be an "Error" object
 */
ApiKey.prototype.verify = function(key, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = undefined;
  }
  this.data.getAppByKey(key, options, function(err, app) {
    if (err) {
      // Some sort of error
      cb(err);
    } else if (app) {
      // Valid API key
      cb(undefined, { application: app });
    } else {
      // Invalid API key
      cb(undefined, { error: { code: 'InvalidAPIKey', message: 'API key is not valid' }});
    }
  });
};
