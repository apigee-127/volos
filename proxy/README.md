Apigee Proxy Setup
==================

1. Install Apigee Platform Tools
--------------------------------
The easiest way to provision the proxy to Apigee and to use the Node.js functionality is to use the
platform tools:

    git clone https://github.com/apigee/api-platform-tools.git
    cd api-platform-tools
    sudo python setup.py install

This will install them on your local system so that you can run "apigeetool" from your path at any time. 
(If you do not have python, however, you will need to install it first.)

2. Create an Apigee Account
---------------------------
If you don't have your own installation of Apigee Enterprise, or don't have an Apigee Edge Account, 
then [go to Apigee Enterprise](http://enterprise.apigee.com) and make one. You'll need to know three things:

* Your user name (typically your email address)
* Your password
* Your organization name

3. Create an Apigee Application
-------------------------------
While you're in the Apigee UI, it's a great time to create the application in which you'll install the Volos proxy 
adapter. You do it like this:

### a. Create an API Product

An API product controls how a specific API is exposed to developers. For now we will create the simplest one possible:

1. In the UI, click on "Publish...Products" in the menu bar
2. Click on the "+ Product" button
3. Enter a name
4. Click on "Save"

### b. Create a Developer

Developers create apps, so you need to create a developer first.

1. In the UI, click on "Publish...Developers" in the menu bar
2. Click on the "+ Developer" button
3. Enter a first name, last name, and email address
4. Click on "Save"

### c. Create an Application

Now we can create an app:

1. In the UI, click on "Publish...Developer Apps" in the menu bar
2. Click on the "+ Developer App" button
3. Enter a "Display Name"
4. Select a developer from the drop-down
5. Click on the "+ Product" button
6. Select an API product from the drop-down
7. Click on the little "checkbox" so that it works
8. Click on "Save"

Once the app has been created, you'll need the "Consumer Key" and "Consumer Secret" to run the proxy. You can view them 
in the console -- click the 'show' button to reveal the information.

4. Deploy the Proxy
-------------------

By deploying an adapter to Apigee, you can run code locally that communicates with Apigee in the cloud. To do this, you 
deploy a special API proxy to the cloud, which gives you a dedicated API that your local server can use to communicate 
about API keys and OAuth tokens.

You can now deploy the proxy to your "test" environment like this:

    apigeetool deployproxy -o ORGANIZATION -e test -u USERNAME -p PASSWORD -n adapterproxy -d ../proxy

(Replace ORGANIZATION, USERNAME, and PASSWORD with your Apigee account info)

Once the proxy had been deployed, then you can invoke the proxy at the URL:

    https://ORGANIZATION-test.apigee.net/adapterproxy
    
(Replace ORGANIZATION with your Apigee organization name)

If you access this URL right now, you should get a 401 (Unauthorized) error because you didn't
supply an API key. (If deployment failed, you will get a 404.)

5. Install the modules
----------------------
If you haven't already, run "npm" in the Volos root directory in order to install and link dependencies:

    cd ..
    npm update

6. Give it a try!
-----------------
Check out the [samples](../samples/README.md) directory.
