function SpikeArrest(options) {
  // options.timeUnit ("seconds", "hours", "minutes", or "days") default = seconds
  // options.interval (Number) default = 1
  // options.allow (Number) default = 1
}

SpikeArrest.prototype.apply = function(options, cb) {
  // options.identifier (Non-object) required
  // options.weight (Number) default = 1
  // options.allow (Number) default = whatever was set in policy setup
  // cb is invoked with first parameter error, second whether it was allowed, third stats on the quota
  // stats.allowed = setting of "allow"
  // stats.used = current value
};

function Valve(options) {
  // options.allow (Number) required
  // options.timeout (Number in seconds) default = 300
}

Valve.prototype.acquire = function(options, cb) {
  // options.identifer (Non-object) required
  // options.weight (Number) default = 1
  // returns an ID
};

Valve.prototype.release = function(id) {
  // Releases the valve and allows more traffic
};

// TODO
// Middleware for these things
// Should specify in configuration where "identifier," etc come from based on some function that you pass in.