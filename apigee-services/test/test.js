var assert = require('assert');

var svc = require('..');

describe('apigee-services',  function() {
  it('empty registry', function() {
    assert.equal(svc.locate('NotFound'), undefined);
  });

  it('insert one only', function() {
    var s = 'AA';
    svc.register('typeA', 'providerA', s);
    assert.equal(svc.locate('typeA'), s);
  });

  it('Default at front', function() {
    var s = 'BB';
    svc.register('typeB', 'providerB', s, true);
    svc.register('typeB', 'providerC', 'CC', false);

    assert.equal(svc.locate('typeB', s));
  });

  it('Default at end', function() {
    var s = 'CC';
    svc.register('typeC', 'providerD', 'DD', false);
    svc.register('typeC', 'providerC', s, true);

    assert.equal(svc.locate('typeC', s));
  });

  it('No default', function() {
    var s = 'DD';
    svc.register('typeD', 'providerE', 'EE');
    svc.register('typeD', 'providerD', s);

    assert.equal(svc.locate('typeD'), s);
  });

  it('Specific provider', function() {
    var s = 'EE';
    svc.register('typeE', 'providerE', 'EEE');
    svc.register('typeE', 'providerF', s);
    svc.register('typeE', 'providerG', 'GG');

    assert.equal(svc.locate('typeE', 'providerF'), s);
  });

  it('Provider not found', function() {
    svc.register('typeF', 'providerE', 'EEE');
    svc.register('typeF', 'providerF', 'FF');
    svc.register('typeF', 'providerG', 'GG');

    assert.equal(svc.locate('typeF', 'providerA'), undefined);
  });
});
