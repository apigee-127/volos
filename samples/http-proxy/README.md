HTTP Proxy Sample
=================

Setup
-----

### Install the modules

    npm install

### Start the proxy

    npm start

Try it
------

### simple curl test

    curl localhost:8012

### Notes

Using the curl call (or browser refresh) repeatedly in quick succession to the proxy, this is what will happen:
1. The first call will be quota checked (ok), sent through proxy to the http server, and cached in memory.
2. The next calls will be returned by the cache in the proxy until it times out (1 second)
3. Once the cache expires, the next call will be quota checked (ok) and then send to http server.
4. The next calls will be again returned by the cache until it times out (1 second)
5. Once the cache expires, the next call will be quota checked and a quota exceeded error will be returned by the proxy.
