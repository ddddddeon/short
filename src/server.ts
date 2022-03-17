const express = require("express");
import * as redis from "redis";
import * as mongodb from "mongodb";

export class Server {
  interface: string;
  port: string;
  mongoUri: string;
  redisUri: string;

  constructor(
    _interface: string,
    _port: string,
    _mongoUri: string,
    _redisUri: string
  ) {
    this.interface = _interface;
    this.port = _port;
    this.mongoUri = _mongoUri;
    this.redisUri = _redisUri;
  }

  async start() {
    const client = new mongodb.MongoClient(this.mongoUri);
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      console.log("Connected successfully to server");
    } catch (err) {
      console.log(err);
      process.exit(1);
    } finally {
      await client.close();
    }

    let rdb;
    try {
      rdb = redis.createClient({
        url: this.redisUri,
      });
      await rdb.connect();
    } catch (err) {
      console.log(err);
      process.exit(1);
    }

    const app = express();
    app.get("/", (req: any, res: any) => {
      res.json({
        chris: "is cool",
      });
    });

    await rdb.set("chris", "cool");
    const res = await rdb.get("chris");
    console.log(res);

    app.listen(this.port);
    console.log("server listening on port", this.port);
  }
}
