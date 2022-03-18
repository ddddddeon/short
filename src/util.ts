import { Db } from "mongodb";
import { Gauge } from "prom-client";

export class Util {
  static async incrementMetric(db: Db, gauge: Gauge<string>, metric: string) {
    await db
      .collection("counters")
      .updateOne({ metric: metric }, { $inc: { count: 1 } }, { upsert: true });

    const res = await db.collection("counters").findOne({ metric: metric });
    gauge.set(res?.count);

    return res?.count;
  }
}
