const express = require("express");

import * as redis from "redis";
import * as mongodb from "mongodb";
import * as prometheus from "prom-client";

import { Shortener } from "./shortener";

export class Server {
  interface: string;
  hostname: string;
  port: string;
  mongoUri: string;
  redisUri: string;

  constructor(
    _interface: string,
    _hostname: string,
    _port: string,
    _mongoUri: string,
    _redisUri: string
  ) {
    this.interface = _interface;
    this.hostname = _hostname;
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
    await rdb.configSet("maxmemory", "100mb");
    await rdb.configSet("maxmemory-policy", "allkeys-lru");

    const maxmemory = (await rdb.configGet("maxmemory")).maxmemory;
    const maxmemoryPolicy = (await rdb.configGet("maxmemory-policy"))[
      "maxmemory-policy"
    ];
    console.log(
      `Connected to ${this.redisUri} with maxmemory: ${maxmemory}, maxmemory-policy: ${maxmemoryPolicy}`
    );

    // set up prometheus instrumentation
    prometheus.collectDefaultMetrics();

    const shortener = new Shortener(rdb, db, this.hostname, this.port);
    const app = express();

    app.get("/metrics", async (req: any, res: any) => {
      res.set("Content-Type", prometheus.contentType);
      res.end(await prometheus.register.metrics());
    });

    app.get("/shorten/:longUrl", async (req: any, res: any) => {
      const shortened = await shortener.shortenUrl(
        decodeURIComponent(req.params.longUrl)
      );

      res.json({
        shortUrl: shortened,
      });
    });

    app.get("/:hash", async (req: any, res: any) => {
      const retrieved = await shortener.retrieveUrl(
        decodeURIComponent(req.params.hash)
      );

      res.json({
        longUrl: retrieved,
      });
    });

    app.listen(this.port);
    console.log("server listening on port", this.port);
  }
}
