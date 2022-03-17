import * as redis from "redis";
import { Db } from "mongodb";
import * as crypto from "crypto";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

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
    let encoded = "";
    let existsAlready = false;

    do {
      hash = crypto
        .createHash("md5")
        .update(longUrl + salt.toString())
        .digest("hex");

      for (let i = 0; i < hash.length - 1; i += 2) {
        const idx = parseInt(`0x${hash[i]}${hash[i + 1]}`);
        encoded += BASE58[idx % BASE58.length];
      }

      encoded = encoded.substring(0, 7);

      console.log(`Base58-encoded hash: ${encoded}`);

      console.log(`Hashed URL ${longUrl} with salt ${salt.toString()}`)
      const result = await this.db.collection("urls").findOne({
        hash: encoded,
      });

      if (result) {
        console.log(`Hash already exists in db: ${result.hash}`);
        if (result.url !== longUrl) {
          console.log(`Collision detected! Salting the input and regenerating hash...`)
          existsAlready = true;
          salt++;
        } else {
          console.log(`URL provided matches URL in the database-- returning the existing hash`)
        }
      } else {
        console.log(`Inserting URL and hash into db: ${longUrl} : ${encoded}`)
        await this.db.collection("urls").insertOne({
          hash: encoded,
          url: longUrl,
        });
      }
    } while (existsAlready === true);

    return encoded;
  }

  async retrieveUrl(shortUrl: string): Promise<string> {
    console.log(shortUrl);
    return "bar";
  }
}
