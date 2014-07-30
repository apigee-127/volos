#!/bin/sh

# This script will package up Volos and its dependencies into an
# Apigee proxy that runs the tests in Mocha.

root=$PWD
dest=./apigee

if [ `basename $PWD` != 'serversidetests' ]
then
  echo 'The tests must be run inside the "serversidetests" directory'
  exit 99
fi

rm -rf ${dest}
mkdir ${dest}

nodedest=${dest}/apiproxy/resources/node
mkdir -p ${nodedest}

# Copy each node module into a ZIP in the appropriate place

for pn in ../node_modules/*
do
  mn=`basename $pn`
  (cd ..; zip -qr ${root}/${nodedest}/node_modules_${mn}.zip node_modules/${mn})
done

# Copy each individual module into node_modules as if it was packaged using NPM.
# Do this so all the "require" stuff works, and also because we don't
# want to do symlinks.
packModule() {
  pf=`(cd $2; npm pack)`
  tar xzf $2/$pf
  mkdir ./node_modules
  mv package ./node_modules/$1
  zip -qr ${nodedest}/node_modules_$1.zip ./node_modules
  rm $2/$pf
  rm -rf ./node_modules
}

packModule volos-management-common ../management/common
packModule volos-management-redis ../management/redis
packModule volos-management-apigee ../management/apigee

packModule volos-cache-common ../cache/common
packModule volos-cache-memory ../cache/memory
packModule volos-cache-redis ../cache/redis
packModule volos-cache-apigee ../cache/apigee

packModule volos-oauth-common ../oauth/common
packModule volos-oauth-redis ../oauth/redis
packModule volos-oauth-apigee ../oauth/apigee

packModule volos-quota-common ../quota/common
packModule volos-quota-memory ../quota/memory
packModule volos-quota-redis ../quota/redis
packModule volos-quota-apigee ../quota/apigee

# Also copy the whole directory structure -- the tests
# depend on it all over the place

copyDir() {
  mkdir -p $2
  (cd $1; tar cf - .) | (cd $2; tar xf -)
}

copyDir '../cache' "./volos/cache"
copyDir '../quota' "./volos/quota"
copyDir '../oauth' "./volos/oauth"
copyDir '../management' "./volos/management"
copyDir '../testconfig' "./volos/testconfig"

zip -qr ${nodedest}/volos.zip ./volos
rm -rf ./volos

cp ./servers/*.js ${nodedest}

# Copy the proxy base stuff
(cd proxybase; tar cf - .) | (cd ${dest}; tar xf -)
