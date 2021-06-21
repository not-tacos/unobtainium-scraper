export type CrawlerOptions = {
  logLevel?: string; //todo: specific values
  logDir?: string;
  batchSize?: number;
  limit?: number;
  throttle?: number;
  logHtml?: boolean;
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
