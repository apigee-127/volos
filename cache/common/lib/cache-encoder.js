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

// buffer format:
// statusCode
// # headers
//  # header key size
//  header key
//  # header value size
//  header value
// content
exports.cache = function(statusCode, headers, content, cb) {
  var buffer;
  if (statusCode && statusCode !== 500 && (headers || content)) {

    var size = 2;
    var pair;
    var pairs = _.pairs(headers);
    for (var i = 0; i < pairs.length; i++) {
      pair = pairs[i];
      size += Buffer.byteLength(pair[0]);
      if (typeof pair[1] !== 'string') { pair[1] = pair[1].toString(); }
      size += Buffer.byteLength(pair[1]);
      size += 2;
    }
    if (content) { size += Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content); }

    buffer = new Buffer(size);
    var pos = 0;
    buffer.writeUInt8(statusCode, pos++);
    buffer.writeUInt8(pairs.length.valueOf(), pos++); // # pairs
    for (i = 0; i < pairs.length; i++) {
      pair = pairs[i];
      buffer.writeUInt8(pair[0].length.valueOf(), pos++); // key
      buffer.write(pair[0], pos);
      pos += Buffer._charsWritten;
      buffer.writeUInt8(pair[1].length.valueOf(), pos++); // value
      buffer.write(pair[1], pos);
      pos += Buffer._charsWritten;
    }
    if (content) {
      if (Buffer.isBuffer(content)) {
        content.copy(buffer, pos, 0);
      } else {
        buffer.write(content, pos);
      }
    }
  }
  cb(null, buffer);
};

exports.setFromCache = function(buffer, resp) {
  var pos = 0;
  var statusCode = buffer.readUInt8(pos++);
  resp.statusCode = statusCode;
  var numHeaders = buffer.readUInt8(pos++);
  for (var i = 0; i < numHeaders; i++) {
    var keyLen = buffer.readUInt8(pos++);
    var key = buffer.toString('utf8', pos, pos + keyLen); pos += keyLen;
    var valLen = buffer.readUInt8(pos++);
    var value = buffer.toString('utf8', pos, pos + valLen); pos += valLen;
    if (!resp.getHeader(key)) {
      resp.setHeader(key, value);
    }
  }
  var content = buffer.toString('utf8', pos);
  resp.end(content);
};
