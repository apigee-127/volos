# volos-management-common

This module includes management functions for volos modules including managing developers and applications.
Currently this is only depended upon by the OAuth modules.

## Modules

This module does not do anything on its own -- it depends on an implementation which stores the cache in a particular
place. Current implementations are:

* volos-management-apigee: Apigee backend.
* volos-management-redis: Redis backend.

## Example

    var Management = require('volos-management-redis');
    var mgmt = cm.create({}); // include any redis options that are not default
    mgmt.createDeveloper({ firstName: 'Joe', lastName: 'Schmoe', email: 'joe@schmoe.com', userName: 'joeschmoe' }, cb);

## Reference

### Object structures

#### Developer

    developer: {
      email (string)
      id: (string)
      userName: (string)
      firstName: (string)
      lastName: (string)
      status: (string)
      attributes: (hash)
    }

#### Application

    application: {
      name: (string)
      id: (string)
      status: (string)
      callbackUrl: (string)
      developerId: (string)
      attributes: (hash)
      credentials: [(credentials)],
      defaultScope: (string),
      scopes: (string) or [(string)]
    }

#### Credentials

    credentials: {
      key: (string)
      secret: (string)
      status: (string)
      attributes: (object)
    }


### Functions

#### Management.createDeveloper(developer, callback)

Create a Developer.

* developer (required): Developer structure
* callback (required): The result of the call is returned via callback: function(err, developer)

#### Management.getDeveloper(uuid, callback)

Retrieve a Developer.

* uuid (required): The uuid of the Developer.
* callback (required): The result of the call is returned via callback: function(err, developer)

#### Management.updateDeveloper(developer, callback)

Update a Developer.

* developer (required): Developer structure
* callback (required): The result of the call is returned via callback: function(err, developer)

#### Management.deleteDeveloper(uuid, callback)

Delete a Developer.

* uuid (required): The uuid of the Developer.
* callback (required): The result of the call is returned via callback: function(err)

#### Management.createApp(application, callback)

Create an Application.

* application (required): Application structure
* callback (required): The result of the call is returned via callback: function(err, application)

#### Management.getApp(uuid, callback)

Retrieve an Application.

* uuid (required): The uuid of the Application.
* callback (required): The result of the call is returned via callback: function(err, application)

#### Management.getDeveloperApp(developerEmail, applicationName, callback)

Retrieve an Application given the developer's email and application name.

* developerEmail (required): The developer email.
* applicationName (required): The name of the application.
* callback (required): The result of the call is returned via callback: function(err, application)

#### Management.deleteApp(uuid, callback)

Delete an Application.

* uuid (required): The uuid of the Application.
* callback (required): The result of the call is returned via callback: function(err)

#### Management.updateApp(application, callback)

Update an Application.

* application (required): Application structure
* callback (required): The result of the call is returned via callback: function(err, application)
