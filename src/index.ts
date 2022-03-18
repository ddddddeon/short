import { Server } from "./server";

const hostname = process.env.APP_HOST ?? "http://localhost";
const port = process.env.APP_PORT ?? "9000";
const proxyPort = process.env.PROXY_PORT ?? "9000";

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

new Server("0.0.0.0", hostname, port, proxyPort, mongoUri, redisUri).start();
