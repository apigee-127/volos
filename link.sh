#!/bin/sh

# Run from the Volos root directory after running 'npm install'. Instead of using
# 'node link' to install the various modules of Volos as global modules, this will
# simply symlink the local modules in the Volos node_modules directory so all modules
# under this directory can find each other.

pushd node_modules
ln -s ../management/apigee volos-management-apigee
ln -s ../management/redis volos-management-redis

ln -s ../oauth/common volos-oauth-common
ln -s ../oauth/apigee volos-oauth-apigee
ln -s ../oauth/redis volos-oauth-redis

ln -s ../quota/common volos-quota-common
ln -s ../quota/apigee volos-quota-apigee
ln -s ../quota/memory volos-quota-memory

ln -s ../cache volos-cache-memory
popd
