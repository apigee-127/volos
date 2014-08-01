'use strict';

var util = require('util');
var http = require('http');
var connect = require('connect');
var PORT = 9012;
var hitNum = 0;

http.createServer(function(req, res) {
  var resp = util.format('target: %d request: %s', ++hitNum, req.url);
  util.log(resp);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(resp);
}).listen(PORT);

util.log('target: started on port ' + PORT);

module.exports.port = PORT;
