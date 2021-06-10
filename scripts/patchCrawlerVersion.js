'use strict';

const fs = require('fs');

const filePath = 'scripts/unobtainiumCrawler.js';
const crawler = fs.readFileSync(filePath).toString();
const versionRegexp = /const CRAWLER_VERSION \= .*;/g;

const version = parseInt(crawler
  .match(versionRegexp)[0]
  .split(' = ')[1]
  .replace(';', ''));
const newVersion = version + 1;

console.log('version: ', version);
console.log('patchVersion: ', newVersion);

const crawlerVersionStr = 'const CRAWLER_VERSION = ' + newVersion + ';';
const patchedCrawler = crawler.replace(versionRegexp, crawlerVersionStr);

fs.writeFileSync(filePath, patchedCrawler);

