/*
 * This configures the test in this directory to use a remote instance
 * of Apigee. Copy it to "testconfig.js" and edit it for your environment.
 */
module.exports = {
    // Your Apigee organization name
    organization: '<org>',
    // The environment to deploy to for testing -- 'test' is good
    environment: '<env>',
    // The user name to authenticate with for the Apigee management API
    username: '<edgeuser>',
    // The password for that user name
    password: '<pass>',

    // comment the username and password and uncomment the following to use .netrc
    // netrc: true
    debug: false,
    verbose: false,

    // This USER must exist in the Apigee org before running tests. To test roles etc.
    useremail: 'someone+tester@google.com',
    // not sure we need the password.
    userpassword: 'Supersecret123'

    // Uncomment for the management API URI of your local Apigee environment
    // Leave commented to test using the Apigee cloud.
    //baseuri: 'http://mgmt:8080'
    // Uncomment if you want to use the Apigee access token instead of your username and password
    //token: 'your-apigee-access-token'
};