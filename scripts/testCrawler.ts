"use strict";

import { startApi } from "../src/local-backend-proxy";
import { CrawlerOptions } from "../src/options";

const _ = require("dotenv").config();

let blackList = [];
startApi(3000);

import crawler from "./unobtainiumCrawler";

/**
 * This aims to use the cralwer code the same way as
 * https://github.com/BCDel89/unobtainium-nodejs-scraper
 */
(async () => {
  const start = async () => {
    try {
      // console.log('Starting Web Scraping Process');

      blackList = await crawler.init(
        "dev",
        "http://localhost:3000/",
        blackList
      );
      await crawler.startWithOptions({});

      // console.log('Process finished, restarting..');
      return start();
    } catch (e) {
      console.log("server status error: ", e);
      setTimeout(start, 3000);
    }
  };

  return setTimeout(start);
})();
