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
 * If the API key is valid, then "cb" will be called with (undefined, app)
 * If the API key is not valid, then "cb" will be called with (undefined, undefined)
 * If there is another error, then "cb" will be called with (error, undefined)
 * TODO options:
 *   retrieveDeveloper
 *   retrieveAttributes
 *
 * argo.use(new ApiKey({queryParam: apikey, header: ApiKey, function: { return request.q.apiKey } }))
 */
ApiKey.prototype.verify = function(key, options, cb) {
  // Test for optional options
  data.getAppByKey(key, function(err, app) {
    if (err) {
      // Some sort of error
      cb(err);
    } else if (app) {
      // Valid API key
      cb(undefined, app);
    } else {
      // Invalid API key
      // TODO return an object that indicates that
      // { error: { foo }, app: { bar }}
      cb();
    }
  });
};
