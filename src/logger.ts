import { createLogger } from "bunyan";
import _ from "lodash";

export { LogLevel } from "bunyan";

export type Logger = {
  trace: typeof console.log;
  error: typeof console.log;
  info: typeof console.log;
  debug: typeof console.log;
  warn: typeof console.log;
};

export const nopLogger: Logger = {
  trace: _.noop,
  debug: _.noop,
  error: _.noop,
  info: _.noop,
  warn: _.noop,
};

export const consoleLogger: Logger = {
  trace: _.noop,
  debug: _.noop,
  info: console.log,
  warn: console.log,
  error: console.log,
};

export const createUnobtaniumLogger = () =>
  createLogger({
    name: "unobtainiumCrawler",
    hostname: "xxx",
    streams: [{ stream: process.stdout, level: "info" }],
  });
