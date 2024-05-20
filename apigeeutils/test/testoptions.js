var assert = require('assert');
var util = require('util');

var options = require('../lib/options');
var defaults = require('../lib/defaults');
var fs = require('fs');
var request = require('postman-request');

describe('Options parsing test', function() {
  beforeAll(function () {
    spyOn(fs, 'readFileSync').and.returnValue(Buffer.from('abc'));
    spyOn(request, 'defaults');
  });

  afterEach(function () {
    fs.readFileSync.calls.reset();
    request.defaults.calls.reset();
  });
  
  it('Test no descriptor', function(done) {
    var desc = {};
    var opts = { foo: 1, bar: 'baz'};
    options.validate(opts, desc, function(err) {
      assert(!err);
      done();
    });
  });

  it('Test nothing wrong', function(done) {
    var desc = {
      foo: {},
      bar: { required:false }
    };
    var opts = { foo: 1, bar: 'baz'};
    options.validate(opts, desc, function(err) {
      assert(!err);
      done();
    });
  });

  it('Test missing option', function(done) {
    var desc = {
      foo: {},
      bar: { required: false, prompt: false },
      baz: { required: true, prompt: true }
    };
    var opts = { foo: 1, bar: 'baz'};
    options.validate(opts, desc, function(err) {
      assert(err);
      assert(/Missing required option/.test(err.message));
      done();
    });
  });

  it('Test nothing and missing stuff', function(done) {
    var desc = {
      foo: {},
      bar: { required: false, prompt: false },
      baz: { required: true, prompt: true }
    };
    options.validate({}, desc, function(err) {
      assert(err);
      assert(/Missing required option/.test(err.message));
      done();
    });
  });

  it('Test command-line nothing', function() {
    var desc = {
      foo: {},
      bar: { required: false },
      baz: { required: true }
    };
    var argv = [ 'node', 'foo' ];
    var opts = options.getopts(argv, 2, desc);
  });


  it('Test command-line happy path', function() {
    var desc = {
      foo: {},
      bar: { required: false },
      baz: { required: true }
    };
    var argv = [ 'node', 'foo', '--foo', 'bar', '--bar', 'baz' ];
    var opts = options.getopts(argv, 2, desc);
    assert.equal(opts.foo, 'bar');
    assert.equal(opts.bar, 'baz');
  });

  it('Test command-line short happy path', function() {
    var desc = {
      foo: { shortOption: 'f' },
      bar: { required: false, shortOption: 'b' },
      baz: { required: true }
    };
    var argv = [ 'node', 'foo', '-f', 'bar', '-b', 'baz', '--baz', 'biz' ];
    var opts = options.getopts(argv, 2, desc);
    assert.equal(opts.foo, 'bar');
    assert.equal(opts.bar, 'baz');
    assert.equal(opts.baz, 'biz');
  });

  it('Test command-line unknown', function() {
    var desc = {
      foo: {},
      bar: { required: false },
      baz: { required: true }
    };
    var argv = [ 'node', 'foo', '--foo', 'bar', '--biz', 'baz' ];
    assert.throws(function() {
      options.getopts(argv, 2, desc);
    });
  });

  it('Test command-line help', function() {
    var desc = {
      foo: { },
      ping: { name: 'Ping', required: false, prompt: false },
      pong: { name: 'Pong', required: true, prompt: false }
    };
    var opts = { ping: 1, pong: 'value'};
    var help = options.getHelp(desc);
    //console.log('Help is:' + help);
    assert.notEqual( help, undefined );
  });

  it('Test command-line toggle', function() {
    var desc = {
      foo: {},
      toggle: { shortOption: 't', toggle: true }
    };
    var argv = [ '--foo', 'bar', '--toggle' ];
    var opts = options.getopts(argv, 0, desc);
    assert.equal(opts.foo, 'bar');
    assert.equal(opts.toggle, true);
  });

  // the prior test demonstrates the ability to set any command
  // line switch, with a value or as a boolean; so, this test
  // will validate the switches are acted upon correctly
  it('Test setting the --keyfile/--certfile options', function() {
    // set up starting variables
    var desc = {
      keyfile: { shortOption: 'K', name: 'Key file' },
      certfile: { shortOption: 'C', name: 'Cert file' },
    };
    var argv = [ '-K', 'key.pem', '--certfile', 'cert.pem' ];
    // initiate spys
    // spyOn(fs, 'readFileSync').and.returnValue(Buffer.from('abc'));
    // spyOn(request, 'defaults');

    var opts = options.getopts(argv, 0, desc);
    // validate the short option is working
    assert.equal(opts.keyfile, 'key.pem');
    // validate the long option is working
    assert.equal(opts.certfile, 'cert.pem');

    // validate the changed defaults.js code reads the .pem files
    // and sets up the request options object with the file buffers
    var rqst = defaults.defaultRequest(opts);
    // validate the files is read when the options is set
    expect(fs.readFileSync).toHaveBeenCalledWith('key.pem');
    expect(fs.readFileSync).toHaveBeenCalledWith('cert.pem');
    // validate the request's default request object is constructed with key/cert buffers
    expect(request.defaults).toHaveBeenCalledWith(
      {          
        'auth': {},
        'json': true,
        'headers': {},
        'agentOptions': {},
        'key': Buffer.from('abc'),
        'cert': Buffer.from('abc')
      });
  });

  // negative case, i.e. the additional options are not included as
  // part of the command line switches
  it('Test omitting the --keyfile/--certfile options', function() {
    // set up starting variables
    var desc = {
      keyfile: { shortOption: 'K', name: 'Key file' },
      certfile: { shortOption: 'C', name: 'Cert file' },
    };
    var argv = [ ];
    // initiate spys
    // spyOn(fs, 'readFileSync').and.returnValue(Buffer.from('abc'));
    // spyOn(request, 'defaults');

    var opts = options.getopts(argv, 0, desc);
    // validate the options were not set
    assert.equal(opts.keyfile, undefined);
    assert.equal(opts.certfile, undefined);

    // validate the undefined options don't attempt a file read
    var rqst = defaults.defaultRequest(opts);
    // validate the files is read when the options is set
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('Test secure value', function() {
    var sv = new options.SecureValue('foobar');
    assert.notEqual(util.format('%s', sv), 'foobar');
    assert.notDeepEqual(util.format('%s', sv), 'foobar');
    assert.equal(sv.getValue(), 'foobar');
    assert(sv instanceof options.SecureValue);
  });

});
