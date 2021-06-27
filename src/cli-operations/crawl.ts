import { crawlRepeatedly } from "../crawl-repeatedly";
import { startLocalApi } from "../local-backend-proxy";
import { CrawlerOptions } from "../options";

export async function crawl() {
  startLocalApi(3000);

  return crawlRepeatedly("dev", "http://localhost:3000/", {});
}
