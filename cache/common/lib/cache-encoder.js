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
var debug = require('debug')('cache');
var stream = require('stream');
var util = require('util');
var http = require('http');

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

    var size = 4;
    var pair;
    var pairs = _.pairs(headers);
    for (var i = 0; i < pairs.length; i++) {
      pair = pairs[i];
      size += Buffer.byteLength(pair[0]);
      if (typeof pair[1] !== 'string') { pair[1] = pair[1].toString(); }
      size += Buffer.byteLength(pair[1]);
      size += 4;
    }
    if (content) { size += Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content); }

    buffer = new Buffer(size);
    var pos = 0;
    buffer.writeUInt16LE(statusCode, pos); pos+=2;
    buffer.writeUInt16LE(pairs.length.valueOf(), pos); pos+=2; // # pairs
    for (i = 0; i < pairs.length; i++) {
      pair = pairs[i];
      buffer.writeUInt16LE(pair[0].length.valueOf(), pos); pos+=2; // key
      pos += buffer.write(pair[0], pos, pair[0].length, 'utf8');
      buffer.writeUInt16LE(pair[1].length.valueOf(), pos); pos+=2; // value
      pos += buffer.write(pair[1], pos, pair[1].length, 'utf8');
    }
    if (content) {
      if (Buffer.isBuffer(content)) {
        content.copy(buffer, pos, 0);
      } else {
        buffer.write(content, pos, size, 'utf8');
      }
    }
  }
  cb(null, buffer);
};

exports.setFromCache = function(buffer, resp) {
  var pos = 0;
  var statusCode = buffer.readUInt16LE(pos); pos+=2;
  resp.statusCode = statusCode;
  var numHeaders = buffer.readUInt16LE(pos); pos+=2;
  for (var i = 0; i < numHeaders; i++) {
    var keyLen = buffer.readUInt16LE(pos); pos+=2;
    var key = buffer.toString('utf8', pos, pos + keyLen); pos += keyLen;
    var valLen = buffer.readUInt16LE(pos); pos+=2;
    var value = buffer.toString('utf8', pos, pos + valLen); pos += valLen;
    if (!resp.getHeader(key)) {
      resp.setHeader(key, value);
    }
  }
  new BufferStream(buffer.slice(pos)).pipe(resp);
};


function BufferStream(source) {

  if (!Buffer.isBuffer(source)) {
    throw(new Error('Source must be a buffer.'));
  }

  stream.Readable.call(this);

  this._source = source;

  this._offset = 0;
  this._length = source.length;

  this.on('end', this._destroy);
}
util.inherits(BufferStream, stream.Readable);


BufferStream.prototype._destroy = function() {
  this._source = null;
  this._offset = null;
  this._length = null;
};


BufferStream.prototype._read = function(size) {

  if (this._offset < this._length) {
    this.push(this._source.slice(this._offset, (this._offset + size)));
    this._offset += size;
  }

  // if we've consumed the entire source buffer, close the readable stream
  if (this._offset >= this._length) {
    this.push(null);
  }
};
