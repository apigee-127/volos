/* jshint node: true  */
"use strict";

const util = require("util"),
  defaults = require("../defaults"),
  options = require("../options");

var descriptor = defaults.defaultDescriptor({
  productName: {
    name: "Product Name",
    required: true
  }
});

module.exports.descriptor = descriptor;

module.exports.run = function (opts, cb) {
  options.validateSync(opts, descriptor);
  if (opts.debug) {
    console.log("deleteProduct: %j", opts);
  }
  var request = defaults.defaultRequest(opts);
  deleteProduct(opts, request, function (err, results) {
    if (err) {
      cb(err);
    } else {
      if (opts.debug) {
        console.log("results: %j", results);
      }
      cb(undefined, results);
    }
  });
};

function deleteProduct(opts, request, done) {
  var uri = util.format(
    "%s/v1/o/%s/apiproducts/%s",
    opts.baseuri,
    opts.organization,
    opts.productName
  );
  request(
    {
      uri: uri,
      method: "DELETE",
      json: true
    },
    function (err, res, body) {
      var jsonBody = body;
      if (err) {
        if (opts.debug) {
          console.log("Error occured %s", err);
        }
        done(err);
      } else if (res.statusCode === 200) {
        if (opts.verbose) {
          console.log("Delete successful");
        }
        if (opts.debug) {
          console.log("%s", body);
        }
        done(undefined, jsonBody);
      } else {
        if (opts.verbose) {
          console.error("Delete Product result: %j", body);
        }
        var errMsg;
        if (jsonBody && jsonBody.message) {
          errMsg = jsonBody.message;
        } else {
          errMsg = util.format(
            "Delete Product failed with status code %d",
            res.statusCode
          );
        }
        done(new Error(errMsg));
      }
    }
  );
}
