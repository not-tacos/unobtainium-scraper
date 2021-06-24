"use strict";

import { startApi } from "../src/local-backend-proxy";

const _ = require("dotenv").config();

let blackList = [];
startApi(3000);

(async () => {
  const start = async () => {
    try {
      // console.log('Starting Web Scraping Process');
      const crawler = require("./unobtainiumCrawler");

      const options = {
        batchSize: process.env.CRAWLER_BATCH_SIZE || 2,
        throttle: process.env.CRAWLER_THROTTLE || 5,
      };
      blackList = await crawler.init(
        "dev",
        "http://localhost:3000/",
        blackList
      );
      await crawler.startWithOptions(options);

      // console.log('Process finished, restarting..');
      return start();
    } catch (e) {
      console.log("server status error: ", e);
      setTimeout(start, 3000);
    }
  };

  return setTimeout(start);
})();
