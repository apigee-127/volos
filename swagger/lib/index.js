module.exports = {
  auth: require('./auth-middleware'),
  app: require('./app-middleware'),
  init: function(config) {
    require('./helpers').init(config);
  }
};
