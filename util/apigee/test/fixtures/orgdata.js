module.exports = {
  org1: {
    apis: {
    },
    environments: {
      test: {
        virtualhosts: {
          'default': {
            port: 80,
            hostAliases: [ 'test-test.apigee.net' ]
          },
          'secure': {
            port: 443,
            hostAliases: [ 'test-test.apigee.net' ]
          }
        }
      },
      prod: {
        virtualhosts: {
          'default': {
            port: 80,
            hostAliases: [ 'test-prod.apigee.net' ]
          },
          'secure': {
            port: 443,
            hostAliases: [ 'test-prod.apigee.net' ]
          }
        }
      }
    }
  }
};
