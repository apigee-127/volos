/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2014 Apigee Corporation

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
'use strict';

var _ = require('underscore');
var debug = require('debug')('spikearrest');

function SpikeArrestConnect(spikeArrest, options) {
  if (!(this instanceof SpikeArrestConnect)) {
    return new SpikeArrestConnect(spikeArrest, options);
  }

  this.spikeArrest = spikeArrest;
  this.options = options || {};
}
module.exports = SpikeArrestConnect;

// applies spikeArrest and returns (503) error on exceeded
// options contains:
// key may be a string or a function that takes the request and generates a string id
// weight may be a number or a function that takes the request and generates a number
SpikeArrestConnect.prototype.apply = function(options) {
  var self = this;
  return function(req, resp, next) {
    var opts = calcOptions(req, options);
    applySpikeArrest(self, opts, resp, next);
  };
};

function calcOptions(req, opts) {
  var options = _.extend({}, opts); // clone
  if (_.isFunction(options.key)) { options.key = options.key(req); }
  if (_.isFunction(options.weight)) { options.weight = options.weight(req); }
  return options;
}

function applySpikeArrest(self, options, resp, next) {
  if (debug.enabled) { debug('SpikeArrest check: ' + options.key); }
  self.spikeArrest.apply(
    options,
    function(err, reply) {
      if (err) { return next(err); }
      if (!reply.isAllowed) {
        if (debug.enabled) { debug('SpikeArrest engaged: ' + options.key); }
        resp.statusCode = 503;
        err = new Error('SpikeArrest engaged');
        err.status = resp.statusCode;
      }
      next(err);
    }
  );
}
