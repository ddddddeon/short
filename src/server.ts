const express = require("express");
import * as redis from "redis";
import * as mongodb from "mongodb";
import { Shortener } from "./shortener";

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
    // connect to mongo
    const client = new mongodb.MongoClient(this.mongoUri);
    let db;
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      db = await client.db("shortdb");
      console.log(`Connected to ${this.mongoUri}`);
    } catch (err) {
      console.log(err);
      process.exit(1);
    }

    // connect to redis
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

    // expire least-recently used keys once 500mb limit is reached
    await rdb.configSet("maxmemory", "500mb");
    await rdb.configSet("maxmemory-policy", "allkeys-lru");

    const maxmemory = (await rdb.configGet("maxmemory")).maxmemory;
    const maxmemoryPolicy = (await rdb.configGet("maxmemory-policy"))[
      "maxmemory-policy"
    ];
    console.log(
      `Connected to ${this.redisUri} with maxmemory: ${maxmemory}, maxmemory-policy: ${maxmemoryPolicy}`
    );

    const shortener = new Shortener(rdb, db);

    // start app server
    const app = express();
    app.get("/shorten/:longUrl", async (req: any, res: any) => {
      const shortened = await shortener.shortenUrl(
        decodeURIComponent(req.params.longUrl)
      );

      res.json({
        testResponse: shortened,
      });
    });

    app.get("/:shortUrl", async (req: any, res: any) => {
      const retrieved = await shortener.retrieveUrl(
        decodeURIComponent(req.params.shortUrl)
      );

      res.json({
        testResponse: retrieved,
      });
    });

    app.listen(this.port);
    console.log("server listening on port", this.port);
  }
}
