Basic Samples
=============

Setup
-----

### Install The Apigee Proxy

See [apigee proxy installation](../../proxy/README.md)

### Install the modules

If you didn't run "npm" in the parent directory in order to install the dependencies required by
these modules, now is a great time:

    cd ../..
    npm install

### Create config.js

Copy the file "sampleconfig.js" to a file called "config.js" and enter in the Apigee
provisioning information from your Apigee deployment. For instance, when done, your config.js might look like this:

    module.exports = {
      organization: 'ORGANIZATION',
      uri: 'https://ORGANIZATION-test.apigee.net/volos-proxy'
      key: 'CONSUMER KEY',
      secret: 'CONSUMER SECRET'
    };

Just fill in your organization name from the first step, as well as the Consumer Key and Consumer Secret that you got when you created the app. (If you don't have it, go to the Publish...Developer Apps on [Apigee Edge](enterprise.apigee.com), select your app and click the 'show' buttons next to your Product values.)

Try it
------

### OAuth
Start the oauth example:

    node oauth.js

Open another terminal and get a token using the simplest grant type, "client credentials":

    $ curl -u KEY:SECRET http://localhost:10010/accesstoken -d 'grant_type=client_credentials'

Scan the output for the value of "access_token" and then replace TOKEN with that value in the next step:

    $ curl -H "Authorization: Bearer TOKEN" http://localhost:10010/foobar

You should get back "Hello, World!"
