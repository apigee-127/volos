#!/bin/sh

md() {
  if [ ! -d $1 ]
  then
    mkdir $1
  fi
}

md node_modules
md node_modules/apigee-oauth
md node_modules/runtime-spi-apigee

(cd ../oauth; tar cf - .) | (cd node_modules/apigee-oauth; tar xvf -)
(cd ../runtime-spi-apigee; tar cf - .) | (cd node_modules/runtime-spi-apigee; tar xvf -)
