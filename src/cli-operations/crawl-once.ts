import { startApi } from "../local-backend-proxy";
import { CrawlerOptions } from "../options";

export async function crawlOnce() {
  const _api = startApi(3000);

  const crawler = require("../../scripts/unobtainiumCrawler");

  const options: CrawlerOptions = {};

  const _blackList = await crawler.init("dev", "http://localhost:3000/", []);

  await crawler.startWithOptions(options);

  console.log("all done!");
}
