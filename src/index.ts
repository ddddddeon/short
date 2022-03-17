import { Server } from "./server";

const port = process.env.PORT ?? "9000";
const mongoUri =
  "mongodb://" +
  (process.env.MONGO_HOST ?? "localhost") +
  ":" +
  (process.env.MONGO_PORT ?? "27017");

const redisUri =
  "redis://" +
  (process.env.REDIS_HOST ?? "localhost") +
  ":" +
  (process.env.REDIS_PORT ?? "6379");

new Server("0.0.0.0", port, mongoUri, redisUri).start();
