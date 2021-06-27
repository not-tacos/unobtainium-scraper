import { LogLevel } from "./logger";

export type CrawlerOptions = {
  countries?: string[];
  logLevel?: LogLevel;
  logDir?: string;
  batchSize?: number;
  limit?: number;
  throttle?: number;
  logHtml?: boolean;
  disableBatchExecution?: boolean;
  disableProductList?: boolean;
};

export function getCountries() {
  let countries = null;
  try {
    countries = JSON.parse(process.env.COUNTRIES_ENABLED);
  } catch (e) {}
  if (countries == null || countries.length == 0) {
    countries = ["US"];
  }
  return countries;
}
