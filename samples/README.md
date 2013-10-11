# Samples

## Setup

### Get Apigee Platform Tools

The easiest way to provision the proxy to Apigee and to use the Node.js functionality is to use the
platform tools:

    git clone https://github.com/apigee/api-platform-tools.git
    cd api-platform-tools
    sudo python setup.py install

This will install them on your local system so that you can run "apigeetool" from your path at any time.
(If you do not have python, however, you will need to install it first.)

### Create an Apigee Account

If you don't have your own installation of Apigee Enterprise, or don't have an account at enterprise.apigee.com,
then go there and make one. Once you do, you'll need to know three things:

* Your user name (typically your email address)
* Your password
* Your organization name

### Create an Application

While you're in the Apigee UI, now is a great time to create an application that you will use to run the
"adapter," and also for testing of OAuth. You do it like this:

#### Create an API Product

An API product controls how a specific API is exposed to developers. For now we will create the simplest one
possible:

1) In the UI, click on "Publish...Products" in the menu bar
2) Click on the "+ Product" button
3) Enter a name
4) Click on "Save"

#### Create a Developer

Developers create apps, so you need to create a developer first.

1) In the UI, click on "Publish...Developers" in the menu bar
2) Click on the "+ Developer" button
3) Enter a first name, last name, and email address
4) Click on "Save"

#### Create an Application

Now we can create an app:

1) In the UI, click on "Publish...Developer Apps" in the menu bar
2) Click on the "+ Developer App" button
3) Enter a "Display Name"
4) Select a developer from the drop-down
5) Select an API product from the drop-down
6) Click on the little "check" box so that it works
7) Click on "Save"

Once the app has been created, you'll need the "public key" and "secret key" to run the proxy. You can
view them in the API, although they're not shown by default -- you have to press a button to do so.

### Deploy the Proxy

By deploying an adapter to Apigee, you can run code locally that communicates with Apigee in the cloud. To do this,
you deploy a special API proxy to the cloud, which gives you a dedicated API that your local server can use
to communicate about API keys and OAuth tokens.

The proxy is located in the "proxy" directory of this project (one directory above this one).

Once you have created the proxy, you will

Once "apigeetool" is deployed, you can deploy the proxy to your "test" environment like this:

    apigeetool deployproxy -o ORGANIZATION -e test -u USERNAME -p PASSWORD \
                           -n adapterproxy -d ../proxy

(Of course, replace ORGANIZATION, USERNAME, and PASSWORD) with the stuff that you gathered above.

Once you have run this script, then you can invoke the proxy at the URL:

    https://ORGANIZATION-test.apigee.net/adapterproxy

If you call this URL right now, you should get a 401 (Unauthorized) error because you didn't
supply an API key. If deployment failed, however, then you will get a 404.

### Copy the Files

The samples could run with "real" modules from NPM, but to run them from this repo, run "sync.sh."
That copies files from elsewhere in the repo into "node_modules" so that you can run them directly.

### Create config.js

Second, copy the file "sampleconfig.js" to a file called "config.js" and enter in the Apigee
provisioning information from your Apigee deployment. For instance, when done, your config.js might look like this.
You'll need to know your organization name from the first step, as well as the keys that you got when you
created the app.

    module.exports = {
      organization: 'ORGANIZATION',
      uri: 'https://ORGANIZATION-test.apigee.net/adapterproxy'
      key: 'PUBLIC KEY',
      secret: 'SECRET KEY'
    };

### Done

Now you can run the samples!

## OAuth

    node oauth.js

Get a token using the simplest grant type, "client credentials":

    $ curl -u KEY:SECRET http://localhost:10010/accesstoken -d 'grant_type=client_credentials'

Scan the output for the value of "access_token" and then remember it for the next step:

    $ curl -H "Authorization: Bearer TOKEN" http://localhost:10010/foobar

You should get back "Hello, World!"
