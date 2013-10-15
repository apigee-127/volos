function Quota(options) {
  // options.type (String) default = rollingwindow
  //    We may want to support "calendar," maybe "flexi". Only in cloud?
  // options.startTime (Date, Number, or String date) default = now
  // options.timeUnit ("hours", "minutes", or "days") default = minutes
  // options.interval (Number) default = 1
  // options.allow (Number) default = 1
  // Should we allow distributed or synchronous?
}

Quota.prototype.apply = function(options, cb) {
  // options.identifier (Non-object) required
  // options.weight (Number) default = 1
  // options.allow (Number) default = whatever was set in policy setup
  // cb is invoked with first parameter error, second whether it was allowed, third stats on the quota
  // stats.allowed = setting of "allow"
  // stats.used = current value
};
