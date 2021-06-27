import crawler from "./unobtainium-crawler";

import { CrawlerOptions } from "./options";

let blackList = [];

/**
 * This aims to use the cralwer code the same way as
 * https://github.com/BCDel89/unobtainium-nodejs-scraper
 */
export function crawlRepeatedly(
  env: string,
  apiUrl: string,
  options: CrawlerOptions
) {
  const start = async () => {
    try {
      // console.log('Starting Web Scraping Process');
      blackList = await crawler.init(env, apiUrl, blackList);
      await crawler.startWithOptions(options);

      // console.log('Process finished, restarting..');
      return start();
    } catch (e) {
      console.log("server status error: ", e);
      setTimeout(start, 3000);
    }
  };

  return setTimeout(start);
}
