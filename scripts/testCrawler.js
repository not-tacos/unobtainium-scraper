'use strict';
const _ = require('dotenv').config();
const env = 'dev';
const apiUrl = process.env.API_URL || 'https://unobtainium.app/';
const unobtainiumCrawlerUrl = apiUrl + 'public/unobtainiumCrawler.js';

let bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'server'});
const {filter} = require('lodash');

const productListUrl = '../public/productList.json';
const testProductListUrl = '../public/productListTest.json';
let productList = null;

try {
  productList = require(testProductListUrl);
} catch (e) {
  productList = require(productListUrl);
}

let blackList = [];

(async () => {

  const start = async () => {
    try {
      // console.log('Starting Web Scraping Process');
      // console.log('loading crawler from local');
      if (productList && productList.length) {
        const cpr = process.env.CRAWLER_PRODUCT_RESTRICTIONS || false;
        if (cpr) productList = filter(productList, product => (product.productName.toLowerCase() === cpr));
        log.info('loading local product list... ', productList.length);
      }

      const crawler = require('./unobtainiumCrawler');

      // console.log('Process started, scraping..');

      const options = {batchSize: process.env.CRAWLER_BATCH_SIZE || 2, throttle: process.env.CRAWLER_THROTTLE || 5};
      blackList = await crawler.init(env, apiUrl, blackList, productList);
      await crawler.startWithOptions(options);

      // console.log('Process finished, restarting..');

      return start();

    } catch (e) {
      console.log('server status error: ', e);
      setTimeout(start, 3000);
    }
  };

  return setTimeout(start);

})();
