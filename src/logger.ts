import { createLogger, LogLevel } from "bunyan";
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

export type BunyanLogger = ReturnType<typeof createUnobtaniumLogger>;

export function isLogLevel(input: string | number): input is LogLevel {
  return (
    typeof input === "number" ||
    ["trace", "debug", "info", "warn", "error", "fatal"].includes(input)
  );
}

export function logLevelOr(
  input: string | number,
  defaultLevel: LogLevel
): LogLevel {
  if (isLogLevel(input)) {
    return input;
  }
  return defaultLevel;
}
