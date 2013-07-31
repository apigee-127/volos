// This is the default provider for caching. It is used if there are no other providers available.

function createCache(options) {
  return new Cache(options);
}
exports.createCache = createCache;

function Cache(options) {
  if (!(this instanceof Cache)) {
    return new Cache(options);
  }

  this.cache = {};
}

Cache.prototype.get = function(key, callback) {
  var val = this.cache[key];
  callback(undefined, val ? val.value : undefined);
};

Cache.prototype.set = function(key, value, options, callback) {
  var self = this;
  var timeout = setTimeout(function() {
    delete self.cache[key];
  }, options.ttl * 1000);

  var val = this.cache[key];
  if (val) {
    clearTimeout(val.timeout);
    val.value = value;
    val.timeout = timeout;
  } else {
    val = new Entry(value, timeout);
    this.cache[key] = val;
  }
  callback();
};

Cache.prototype.delete = function(key, callback) {
  delete this.cache[key];
  callback();
};

Cache.prototype.clear = function(callback) {
  this.cache = {};
  callback();
};

function Entry(value, timeout) {
  if (!(this instanceof Entry)) {
    return new Entry();
  }

  this.value = value;
  this.timeout = timeout;
}
