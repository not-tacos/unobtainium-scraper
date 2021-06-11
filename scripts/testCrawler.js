'use strict';
const got = require('got');
const _ = require('dotenv').config();
const {filter} = require('lodash');
const express = require('express');
const app = express();

app.get('/api/Sites/getProductList', async (req, res) => res.redirect(301, 'https://unobtainium.app/api/Sites/getProductList'));
app.get('/api/Sites/getBatchList', async (req, res) => res.redirect(301, 'https://unobtainium.app/api/Sites/getBatchList'));
app.use('/*', (req, res) => res.send({}));

app.listen(3000);

let blackList = [];

(async () => {

  const start = async () => {
    try {
      // console.log('Starting Web Scraping Process');
      const crawler = require('./unobtainiumCrawler');

      const options = {batchSize: process.env.CRAWLER_BATCH_SIZE || 2, throttle: process.env.CRAWLER_THROTTLE || 5};
      blackList = await crawler.init('dev', 'http://localhost:3000/', blackList);
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
