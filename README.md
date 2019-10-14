node-redis-stream
---
A simple library that converts Redis 5 streams into Node streams.

# Usage
```javascript
const redis = require('redis');
require('redis-stream2')(redis);

const cli = redis.createClient();
const st = cli.readFromStream('stream:test');
st.on('data', console.log);

const st2 = cli.writeToStream('stream:test');
st2.write({"data": "hello_world"});
```

# API

This package exports a function which takes the `redis` library as an argument, and adds the following functions to every Redis client:

## readFromStream(key, options)
Create a Node stream that reads from the Redis stream with key `key`.

Supported options:
* `id`: The start ID to read from. Defaults to `0`.
* `timeout`: The timeout to pass to `XREAD` command, in milliseconds. Defaults to `60000`.
* `count`: The count to pass to `XREAD` command, i.e. the maximum number of entries to fetch per command. Defaults to `100`.

Every entry will be an object, with the ID of the entry in the `_id` key.

## writeToStream(key)
Create a Node stream that writes to the Redis stream with key `key`. Currently there isn't anything to configure.

The stream accepts objects with the same format as `readFromStream`. If the `_id` key is present, it will be sent in the `XADD` command as the expected ID of the entry, otherwise Redis will generate the ID. The `_id` key will be overwritten with the returned value after the write is acknowledged.
