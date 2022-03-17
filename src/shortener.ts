import * as redis from "redis";
import { Db } from "mongodb";
import * as crypto from "crypto";

type RedisClientType = ReturnType<typeof redis.createClient>;

export class Shortener {
  rdb: RedisClientType;
  db: Db;

  constructor(_rdb: RedisClientType, _db: Db) {
    this.rdb = _rdb;
    this.db = _db;
  }

  async shortenUrl(longUrl: string): Promise<string> {
    console.log(`Shortening url ${longUrl}...`);

    let salt = 0;
    let hash = "";
    let existsAlready = false;

    do {
      hash = crypto
        .createHash("md5")
        .update(longUrl + salt.toString())
        .digest("hex");

      console.log(`Hashed URL ${longUrl} with salt ${salt.toString()}`)
      const result = await this.db.collection("urls").findOne({
        hash: hash,
      });

      if (result) {
        console.log(`Hash already exists in db: ${hash}`);
        if (result.url !== longUrl) {
          console.log(`Collision detected! Salting the input and regenerating hash...`)
          existsAlready = true;
          salt++;
        } else {
          console.log(`URL provided matches URL in the database-- returning the existing hash`)
        }
      } else {
        console.log(`Inserting URL and hash into db: ${longUrl} : ${hash}`)
        await this.db.collection("urls").insertOne({
          hash: hash,
          url: longUrl,
        });
      }
    } while (existsAlready === true);

    return hash;
  }

  async retrieveUrl(shortUrl: string): Promise<string> {
    console.log(shortUrl);
    return "bar";
  }
}
