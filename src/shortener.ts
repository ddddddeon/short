import * as redis from "redis";
import { Db } from "mongodb";
import * as crypto from "crypto";
import { Gauge } from "prom-client";

import { Metrics } from "./metrics";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

type RedisClientType = ReturnType<typeof redis.createClient>;

export class Shortener {
  rdb: RedisClientType;
  db: Db;
  hostname: string;
  port: string;
  proxyPort: string;

  constructor(
    _rdb: RedisClientType,
    _db: Db,
    _hostname: string,
    _port: string,
    _proxyPort: string
  ) {
    this.rdb = _rdb;
    this.db = _db;
    this.hostname = _hostname;
    this.port = _port;
    this.proxyPort = _proxyPort;
  }

  async shortenUrl(longUrl: string): Promise<string> {
    const start = Date.now();

    if (!longUrl.startsWith("http")) {
      longUrl = "https://" + longUrl;
    }
    console.log(`Shortening url ${longUrl}...`);

    let salt = 0;
    let shortened = { shortUrl: "", existsAlready: false };

    do {
      shortened = await this.generateShortenedUrl(longUrl, salt);
      salt++;
    } while (shortened.existsAlready);

    Metrics.timeToShortenMs.set(Date.now() - start);

    return shortened.shortUrl;
  }

  async retrieveUrl(hash: string): Promise<string> {
    const start = Date.now();

    const cachedResult = await this.rdb.get(hash);
    if (cachedResult) {
      await Metrics.incrementMetric(this.db, Metrics.cacheHits, "cache_hits");
      Metrics.timeToRetrieveMs.set(Date.now() - start);
      return cachedResult;
    }

    const dbResult = await this.db.collection("urls").findOne({
      hash: hash,
    });
    if (dbResult) {
      await Metrics.incrementMetric(this.db, Metrics.dbHits, "db_hits");
      Metrics.timeToRetrieveMs.set(Date.now() - start);
      return dbResult.longUrl;
    }

    Metrics.timeToRetrieveMs.set(Date.now() - start);

    // redirect to homepage if no result found in cache or db
    return this.hostname + (this.isHttpOrHttps() ? "" : ":" + this.proxyPort);
  }

  private isHttpOrHttps() {
    return (
      this.port === "443" ||
      this.port === "80" ||
      this.proxyPort === "443" ||
      this.proxyPort === "80"
    );
  }

  private constructUrlFromHash(hash: string) {
    return (
      this.hostname +
      (this.isHttpOrHttps() ? "" : ":" + this.proxyPort) +
      "/" +
      hash
    );
  }

  private async generateShortenedUrl(
    longUrl: string,
    salt: number
  ): Promise<any> {
    let existsAlready = false;

    const hash = crypto
      .createHash("md5")
      .update(longUrl + salt.toString())
      .digest("hex");

    console.log(`Hashed URL ${longUrl} with salt ${salt.toString()}`);

    // base58-encode the hash byte by byte and truncate to length of 7
    let encoded = "";
    for (let i = 0; i < hash.length - 1; i += 2) {
      const idx = parseInt(`0x${hash[i]}${hash[i + 1]}`);
      encoded += BASE58[idx % BASE58.length];
    }
    encoded = encoded.substring(0, 7);

    let shortUrl = this.constructUrlFromHash(encoded);
    console.log(`Generated short URL: ${shortUrl}`);

    const result = await this.db.collection("urls").findOne({
      hash: encoded,
    });

    if (result) {
      console.log(`Short URL hash already exists in db: ${result.hash}`);
      if (result.longUrl !== longUrl) {
        existsAlready = true;

        const hashCollisionCount = await Metrics.incrementMetric(
          this.db,
          Metrics.hashCollisions,
          "hash_collisions"
        );

        console.log(
          `Collision detected! (${hashCollisionCount} total) Salting the input and regenerating hash...`
        );
      } else {
        console.log(
          `Long URL provided matches long URL in the database-- returning the existing hash`
        );
      }
    } else {
      const cached = await this.rdb.set(encoded, longUrl);
      if (cached !== "OK") {
        console.log(`Error writing to cache: ${cached}`);
      } else {
        console.log(`Inserted URL and hash into cache`);
      }

      console.log(`Inserting URL and hash into db: ${longUrl} : ${encoded}`);
      await this.db.collection("urls").insertOne({
        hash: encoded,
        longUrl: longUrl,
      });

      await Metrics.incrementMetric(
        this.db,
        Metrics.urlsShortened,
        "urls_shortened"
      );
    }

    return { shortUrl: shortUrl, existsAlready: existsAlready };
  }
}
