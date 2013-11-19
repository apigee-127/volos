#!/bin/sh

# Used by link.sh. You may also exec directly to remove node_modules symlinks to volos modules.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR/node_modules"

rm volos-management-apigee
rm volos-management-redis

rm volos-oauth-common
rm volos-oauth-apigee
rm volos-oauth-redis

rm volos-quota-common
rm volos-quota-apigee
rm volos-quota-memory

rm volos-cache-common
rm volos-cache-memory
rm volos-cache-redis

popd
