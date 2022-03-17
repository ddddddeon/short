import * as redis from "redis";
import { MongoClient } from "mongodb";

type RedisClientType = ReturnType<typeof redis.createClient>;

export class Shortener {
  rdb: RedisClientType;
  db: MongoClient;

  constructor(_rdb: RedisClientType, _db: MongoClient) {
    this.rdb = _rdb;
    this.db = _db;
  }

  shorten(url: string): string {
    return "foo";
  }
}
