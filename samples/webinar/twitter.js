/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2013 Apigee Corporation

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
var Twit = require('twit');
var twitConfig = require('./config').twitter; // this is just a hash of credentials
var T = new Twit(twitConfig);

exports.search = search;
exports.cachedSearch = cachedSearch;

/*** straight search against Twitter ***/

function search(query, cb) {
  console.log('running twitter search: ' + JSON.stringify(query));

  T.get('search/tweets', query, function(err, reply) {

    if (err) { return cb(err); }

    var result = _.map(reply.statuses, function(status) {
      var created = new Date(status.created_at);
      return { user: status.user.screen_name, created: created, text: status.text };
    });

    cb(err, result);
  });
}


/*** wrap Twitter search with a cache ***/

var volos = require('./volos');
var cache = volos.Cache.create('twitter', { ttl: 5000, encoding: 'utf8' });

function cachedSearch(query, cb) {
  var key = JSON.stringify(query);

  cache.get(key, function(err, reply) {

    if (reply) {
      console.log('returning response from cache');
      cb(null, reply, true);

    } else {

      search(query, function(err, reply) {
        if (!err) { cache.set(key, JSON.stringify(reply)); }
        cb(err, reply);
      });
    }
  });
}
