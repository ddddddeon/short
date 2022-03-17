import * as redis from "redis";
import { Db } from "mongodb";
import * as crypto from "crypto";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

type RedisClientType = ReturnType<typeof redis.createClient>;

export class Shortener {
  rdb: RedisClientType;
  db: Db;
  hostname: string;
  port: string;

  constructor(
    _rdb: RedisClientType,
    _db: Db,
    _hostname: string,
    _port: string
  ) {
    this.rdb = _rdb;
    this.db = _db;
    this.hostname = _hostname;
    this.port = _port;
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

      console.log(`Hashed URL ${longUrl} with salt ${salt.toString()}`);

      for (let i = 0; i < hash.length - 1; i += 2) {
        const idx = parseInt(`0x${hash[i]}${hash[i + 1]}`);
        encoded += BASE58[idx % BASE58.length];
      }

      encoded = encoded.substring(0, 7);
      const shortUrl =
        this.hostname +
        (this.port === "443" || this.port === "80" ? "" : ":" + this.port) +
        "/" +
        encoded;

      console.log(`Generated short URL: ${shortUrl}`);
      const result = await this.db.collection("urls").findOne({
        shortUrl: shortUrl,
      });

      if (result) {
        console.log(`Short URL already exists in db: ${result.shortUrl}`);
        if (result.longUrl !== longUrl) {
          console.log(
            `Collision detected! Salting the input and regenerating hash...`
          );
          existsAlready = true;
          salt++;
        } else {
          console.log(
            `Long URL provided matches long URL in the database-- returning the existing hash`
          );
        }
      } else {
        const cached = await this.rdb.set(shortUrl, longUrl);
        if (cached !== "OK") {
          console.log(`Error writing to cache: ${cached}`);
        } else {
          console.log(`Inserted URL and hash into cache`);
        }

        console.log(`Inserting URL and hash into db: ${longUrl} : ${shortUrl}`);
        await this.db.collection("urls").insertOne({
          shortUrl: shortUrl,
          longUrl: longUrl,
        });
      }
    } while (existsAlready === true);

    return shortUrl;
  }

  async retrieveUrl(shortUrl: string): Promise<string> {
    console.log(shortUrl);
    return "bar";
  }
}
