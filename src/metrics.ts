import { Db } from "mongodb";
import { Gauge } from "prom-client";

export class Metrics {
  public static hashCollisions = new Gauge<string>({
    name: "hash_collisions",
    help: "Number of hash collisions that have occurred",
  });

  public static urlsShortened = new Gauge<string>({
    name: "urls_shortened",
    help: "Total number of URLs shortened",
  });

  public static timeToShortenMs = new Gauge<string>({
    name: "time_to_shorten_ms",
    help: "Time taken to shorten one URL (ms)",
  });

  public static timeToRetrieveMs = new Gauge<string>({
    name: "time_to_retrieve_ms",
    help: "Time taken to retrieve a full URL from a shortened URL",
  });

  public static cacheHits = new Gauge<string>({
    name: "cache_hits",
    help: "Total number of cache hits when retrieving a full URL from a shortened URL",
  });

  public static dbHits = new Gauge<string>({
    name: "db_hits",
    help: "Total number of database hits when retrieving a full URL from a shortened URL",
  });

  static async incrementMetric(db: Db, gauge: Gauge<string>, metric: string) {
    await db
      .collection("counters")
      .updateOne({ metric: metric }, { $inc: { count: 1 } }, { upsert: true });

    const res = await db.collection("counters").findOne({ metric: metric });
    gauge.set(res?.count);

    return res?.count;
  }
}
