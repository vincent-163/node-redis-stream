const { Readable, Writable } = require("stream");

module.exports = function(redis) {
  redis.RedisClient.prototype.readFromStream = function(key, options) {
    return new RedisReadStream(this, key, options);
  };
  redis.RedisClient.prototype.writeToStream = function(key) {
    return new RedisWriteStream(this, key);
  };
};

class RedisReadStream extends Readable {
  constructor(redisClient, key, options) {
    super({
      objectMode: true
    });
    this.redisClient = redisClient;
    this.key = key;
    options = options || {};
    this._id = options.id || "0";
    this._timeout = options.timeout || 60000;
    this._count = options.count || 100;
    this._queue = {};
    this._lowMark = 0;
    this._client = redisClient.duplicate();
  }
  _read(n) {
    if (this._running) return;
    this._fetch();
  }
  _fetch() {
    this._running = true;
    this._client.xread(
      "COUNT",
      this._count,
      "BLOCK",
      this._timeout || 60000,
      "STREAMS",
      this.key,
      this._id,
      (err, replies) => {
        try {
          if (err) throw err;
          else if (!replies) this._fetch(n);
          else {
            if (replies.length !== 1) throw new Error("invalid XREAD reply");
            const reply = replies[0];
            if (reply[0] !== this.key) throw new Error("invalid XREAD reply");
            let blocked = false;
            reply[1].forEach(entry => {
              this._id = entry[0];
              let obj = { _id: entry[0] };
              const pairs = entry[1];
              let len = pairs.length;
              for (let i = 0; i < len; i += 2) {
                obj[pairs[i]] = pairs[i + 1];
              }
              if (!this.push(obj)) blocked = true;
            });
            if (blocked) {
              this._running = false;
            } else {
              this._fetch();
            }
          }
        } catch (err) {
          this.destroy(err);
        }
      }
    );
  }
  _destroy(err, callback) {
    if (this._client) {
      this._client.quit(callback);
    } else {
      callback(err);
    }
  }
}

class RedisWriteStream extends Writable {
  constructor(redisClient, key) {
    super({
      objectMode: true
    });
    this.redisClient = redisClient;
    this.key = key;
  }
  _write(chunk, encoding, callback) {
    let cmd = [this.key];
    if (chunk._id) {
      cmd.push(chunk._id);
    } else {
      cmd.push("*");
    }
    for (let key in chunk) {
      if (key === "_id") continue;
      cmd.push(key);
      cmd.push(chunk[key]);
    }
    this.redisClient.xadd(cmd, function(err, reply) {
      if (!err) chunk._id = reply;
      callback(err);
    });
  }
}
