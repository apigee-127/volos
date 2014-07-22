// Volos Management providers

var VolosManagementRedis = require('volos-management-redis');
var VolosManagementApigee = require('volos-management-apigee');

// Volos OAuth providers

var VolosOAuthRedis = require('volos-oauth-redis');
var VolosOAuthApigee = require('volos-oauth-apigee');

// Volos Cache providers

var VolosCacheMemory = require('volos-cache-memory');
var VolosCacheRedis = require('volos-cache-redis');
var VolosCacheApigee = require('volos-cache-apigee');

// Volos Quota providers

var VolosQuotaMemory = require('volos-quota-memory');
var VolosQuotaRedis = require('volos-quota-redis');
var VolosQuotaApigee = require('volos-quota-apigee');


// Provider Configuration

var apigeeConfig = require('./apigee');
var redisConfig = require('./redis');


// Create provider sets

var memory = {
  cache: VolosCacheMemory,
  quota: VolosQuotaMemory
};

var redis = {
  management: VolosManagementRedis,
  oauth: VolosOAuthRedis,
  cache: VolosCacheRedis,
  quota: VolosQuotaRedis,
  config: redisConfig
};

var apigee = {
  management: VolosManagementApigee,
  oauth: VolosOAuthApigee,
  cache: VolosCacheApigee,
  quota: VolosQuotaApigee,
  config: apigeeConfig
};

// Exports

module.exports = {
  memory: memory,
  redis: redis,
  apigee: apigee,
  default: redis
};
