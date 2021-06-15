'use strict';
const CRAWLER_VERSION = 1;

import got from 'got';
import _ from 'lodash';
import cheerio from 'cheerio';

import { batchHostTimeouts, containerIsInStockNewegg, genericIsInStockEnglish, HostTimeouts, isInStockSiteDictionary, userAgentDictionary } from "./sites";
import { parseNumberEN, uuidv4 } from "./util";

const userAgent = new (require('user-agents'))({deviceCategory: 'desktop'});

let fs = null;
let bunyan = null;
let guid = null;

try {
  bunyan = require('bunyan');
} catch (e) {
  console.log();
}

/** Product {object} = {
 *   url: {string}
 *   price: {number}
 *   country: {string}
 *   productName: {string}
 * }
 */

/** ProductInfo {object} = {
 *   isInStock: {boolean}
 *   stock: {number}
 *   price: {number}
 *   isThirdParty: {boolean}
 * }
 */

/**
 * blackListHostDictionary: object = {
 *   hostname: string,
 *   expiry: number [the amount of time to expire the blacklist record]
 *   blackListedTime: date [time when blacklist record was added]
 * }
 */
const blackListHostDictionary = {
  default: 8 * 60 * 60 * 1000 + (1000 * 60), // 8 hours and 1 minute in ms
  // default: (1000 * 30), // TESTING: 30 seconds
};

const blackListStrikeDictionary = {};

module.exports = (() => {
  // ================================================
  // PRIVATE variables
  // ================================================

  const z = this;
  let env = 'dev';
  let apiUrl = env === 'dev' ? 'http://localhost:3009/' : 'https://unobtainium.app/';
  let productDictionary = null;
  let batchDictionary = null;
  let productList = null;
  let batchList = null;
  let blackList = [];
  let runOptions = {};
  let batchTimers = {};

  let logger = (() => {
    this.trace = this.debug = () => {
    };
    this.info = this.warn = this.error = console.log;
    return this;
  })();

  const loggerOptions = {
    name: 'unobtainiumCrawler',
    hostname: 'xxx',
    streams: [
      {stream: process.stdout, level: 'info'},
    ],
  };

  // ================================================
  // PUBLIC functions
  // ================================================

  z.init = async (_env, _apiUrl, _blackList = [], _productList, _batchList) => {
    env = _env || env;
    apiUrl = _apiUrl || apiUrl;
    blackList = createCrawlerBlackList(_blackList);
    productList = _productList || null;
    batchList = _batchList || null;
    guid = guid || uuidv4();

    logger = createLogger(loggerOptions);

    if (env === 'dev') {
      logger.info('init() - ================================================');
      logger.info('init() - DEVELOPMENT MODE - ', apiUrl);
      logger.info('init() - ================================================');
    } else {
      logger.info('init() - connecting to server - ', apiUrl);
    }
    logger.info('init() - ================================================');
    logger.info('init() - CRAWLER_VERSION: ', CRAWLER_VERSION);
    logger.info('init() - ================================================');

    productList = productList ? (await Promise.resolve(productList)) : await retrieveNewProductList();
    batchList = batchList ? (await Promise.resolve(batchList)) : await retrieveBatchList();
    logger.info('init() - loaded product list: ', productList.length);
    logger.info('init() - loaded batch list: ', batchList.length);
    buildDictionary();
    buildBatchDictionary();
    logger.info('init() - loaded product dictionary: ', productDictionary.length);

    return blackList;
  };

  /**
   *
   * @param _options
   * _options = {
   *   limit: number (default: 0)
   *   country: string (default: null)
   *   batchSize: number (default: 100)
   *   throttle: number (default: 0)
   * }
   * @returns {Promise<void>}
   */
  z.startWithOptions = async (_options = {}) => {
    if (!productList) await z.init();

    // logger.info('start() - startWithOptions: US only');
    const options = runOptions = new (function() {

      // limit countries to a single item and then filter the product dictionary
      // this.country = _options.country || false;
      // if (this.country) productDictionary = _.filter(productDictionary, p => p.product.country === this.country);

      // limit countries to following list and then filter the product dictionary
      try {
        this.countries = JSON.parse(process.env.COUNTRIES_ENABLED);
      } catch (e) { }
      if (!this.countries || !this.countries.length) this.countries = ['US'];

      productDictionary = _.filter(productDictionary, p => this.countries.includes(p.product.country));
      batchDictionary = _.filter(batchDictionary, b => this.countries.includes(b.country));

      this.logLevel = _options.logLevel || process.env.CRAWLER_LOG_LEVEL || 'info';
      this.logDir = _options.logDir || process.env.CRAWLER_LOG_DIR || null;
      this.batchSize = _options.batchSize || _options.limit || 10;
      this.limit = _options.limit || productDictionary.length;
      this.throttle = _options.throttle || 5;
      this.logHtml = process.env.CRAWLER_LOG_HTML || false;
    });

    if (options.logDir) {
      loggerOptions.streams[0] = {stream: process.stdout, level: options.logLevel};
      loggerOptions.streams.push({path: options.logDir + 'crawl.log', level: options.logLevel});
      logger = createLogger(loggerOptions);
    }

    logger.info('start() - startingWithOptions: ', options);
    logger.info('start() - startingWithOptions productDictionary', productDictionary.length);
    logger.info('start() - startingWithOptions batchDictionary', batchDictionary.length);

    let index = 0;
    let parsed = 0;
    let promises = [];
    let queue = [];

    if (process.env.DISABLE_BATCH_EXECUTION !== 'true') startBatchExecution();

    return new Promise((resolve, reject) => {

      const addToQueue = () => {
        promises = [];

        _.range(options.batchSize).forEach(i => {
          if (index < options.limit) {
            queue.push(productDictionary[index]);
            index += 1;
          }
        });

        logger.debug('start() - addToQueue() - added: ', options.batchSize);

        setTimeout(startExecution, options.throttle * 1000);
      };

      const startExecution = () => {
        pingServer();

        if (queue.length) {

          for (let i = queue.length - 1; i >= 0; i--) {
            const item = queue[i];
            logger.debug('start() - startExecution() - working: ', item.index, '-', item.product.country, '-', item.product.productName, '-', item.hostname);
            queue.pop();
            parsed += 1;
            if (parsed >= options.limit) return stopExecution();

            promises.push(item.parse());
          }

          Promise.all(promises).then(addToQueue);
        } else {
          if (index >= productDictionary.length) return stopExecution();
          if (index === 0) {
            addToQueue();
          }
        }
      };

      const stopExecution = () => {
        clearBatchTimers();
        return resolve();
      };

      // NOTE: turn this ON in the env file to better test batch parsing
      if (process.env.DISABLE_PRODUCTLIST === 'true') return;
      return addToQueue();
    });
  };

  // ================================================
  // PRIVATE functions
  // ================================================
  /**
   * startBatchExecution()
   * divides the batchDictionary by host, runs every host at once, then schedules the next run for every host according
   * to the batchHostTimeouts dictionary
   */
  const startBatchExecution = () => {
    const indexObj = {};
    let batchByHost = {};

    batchDictionary.forEach(item => {
      if (!batchByHost[item.hostname]) batchByHost[item.hostname] = [];
      batchByHost[item.hostname].push(item);
    });

    const startExecutionForHost = (batch, host, index) => {
      const hostItemLength = batch[host].length;
      index += 1;
      if (index >= hostItemLength) index = index % hostItemLength;
      indexObj[host] = index;

      const hostItem = batch[host][index];
      const timer = batchHostTimeouts[host] || 10000;

      hostItem.parse();

      batchTimers[host] = setTimeout(() => {
        const i = index + 1;
        startExecutionForHost(batch, host, i);
      }, timer);
    };

    Object.keys(batchByHost).forEach(host => {
      startExecutionForHost(batchByHost, host, -1);
    });
  };

  const clearBatchTimers = () => {
    logger.warn('ClearBatchTimers() - cleaning up');
    Object.keys(batchTimers).forEach(k => clearTimeout(batchTimers[k]));
  };

  const createCrawlerBlackList = (list) => {
    if (list.process) return list.process();
    const blm = this;
    blm.list = list;

    blm.getExpiry = (hostname) => {
      const expiry = blackListHostDictionary[hostname] || blackListHostDictionary['default'];
      logger.debug('blackList.getExpiry()', expiry);
      return expiry;
    };

    blm.isBlacklisted = (hostname) => {
      const foundHost = !!_.find(blm.list, item => item.hostname.toLowerCase() === hostname.toLowerCase());
      logger.debug('blackList.isBlacklisted()', foundHost);
      return foundHost;
    };

    blm.add = (hostname) => {
      const blackListRecord = {hostname, expiry: new Date().getTime() + this.getExpiry(hostname)};
      blm.list.push(blackListRecord);
      logger.debug('blackList.add()', blackListRecord);
      logger.warn('BLACKLISTING', hostname);
      return blackListRecord;
    };

    blm.process = () => {
      const filteredList = _.filter(blm.list, item => (new Date().getTime() < item.expiry));
      logger.debug('blackList.process() ', blm.list, filteredList);
      blm.list = filteredList;
      return blm;
    };

    blm.process();

    return blm;
  };

  const createLogger = (options) => {
    if (bunyan) return new bunyan(options);
    return logger;
  };

  const writeHtmlToFile = (fileName, html) => {
    if (!runOptions.logHtml) return true;
    try {
      fs = fs || require('fs');
      fs.writeFileSync(runOptions.logHtml + fileName, html);
    } catch (e) {
      logger.error('writeHtmlToFile() ERROR: ', e);
    }
  };

  /**
   * Helper function to resolve promise after a delay in MS
   * @param timeoutInMs
   * @returns {Promise<unknown>}
   */
  const delay = (timeoutInMs) => new Promise(resolve => setTimeout(resolve, timeoutInMs));

  /**
   * retrive the product list from the server
   * @return JSON list of Products
   */
  const retrieveProductList = async () => JSON.parse((await got(apiUrl + 'public/productList.json')).body);
  const retrieveNewProductList = async () => JSON.parse((await got(apiUrl + 'api/Sites/getProductList')).body);
  const retrieveBatchList = async () => JSON.parse((await got(apiUrl + 'api/Sites/getBatchList')).body);

  /**
   * notify the server of stock changes
   * @param parsedResults {object}
   * @param success {boolean} - if the update was a success (not becuase of an error, blacklist, etc.)
   * @param html {string} - if the server responds that this update caused a stock hit them upload the related html
   * @return Promise<response>
   */
  const notifyServer = async (parsedResults, success = false, html) => {
    parsedResults.version = CRAWLER_VERSION;

    try {
      if (success && parsedResults.siteName) blackListStrikeDictionary[parsedResults.siteName] = 0;
      const gotResults = await got.post(apiUrl + 'api/Sites/setAvailability', {json: parsedResults});
      const results = JSON.parse(gotResults.body);
      if (results && results.causedHit) {
        console.log('notifyServer() - CAUSED STOCK HIT');
        got.post(apiUrl + 'api/ScraperStocks/' + results.causedHit + '/submitHtml', {json: {html}});
      }
    } catch (e) {
      logger.error('notifyServer() ERROR', e);
    }
  };

  const notifyServerOfError = async (scraperError) => {
    try {
      scraperError.crawlerId = guid;
      scraperError.crawlerVersion = CRAWLER_VERSION;
      got.post(apiUrl + 'api/ScraperErrors', {json: scraperError});

      if (scraperError.hostname) {
        const host = scraperError.hostname;
        blackListStrikeDictionary[host] = (blackListStrikeDictionary[host] || 0) + 1;
        logger.info('notifyServerOfError() - ', host, 'has', blackListStrikeDictionary[host], 'strikes');
        if (blackListStrikeDictionary[host] >= 3) blackList.add(host);
      }

    } catch (e) {
      logger.error('notifyServerOfError() ERROR', e);
    }
  };

  const pingServer = async () => {
    try {
      logger.debug('ping [' + CRAWLER_VERSION + ']', guid);
      got.post(apiUrl + 'api/Crawlers/ping', {
        json: {
          id: guid,
          configuration: runOptions,
          version: CRAWLER_VERSION,
        },
      });
    } catch (e) {
      logger.error('notifyServerOfError() ERROR', e);
    }
  };

  /**
   * builds the parser that will query the product url and return an object of related product info
   * @param product {Product}
   * @return async () => ProductInfo
   */
  const buildParser = (product, siteName) => {
    return async function(retry = 0) {
      try {
        if (!product.url) throw ('ProductParser() - ERROR Invalid Product URL: ' + product.url);
        if (!product.productName) throw ('ProductParser() - ERROR Invalid Product Name: ' + product.productName);
        if (blackList.isBlacklisted(siteName)) {

          const updateInfo = {
            productName: product.productName,
            url: product.url,
            country: product.country,
            renderTime: new Date().getTime(),
          };

          notifyServer(updateInfo);
          return logger.warn('ProductParser() - TEMPORARILY BLACKLISTED: ' + siteName + '-' + product.productName);
        }

        // TODO: randomize
        // const ua = userAgent().toString();
        const ua = userAgent.toString();
        const html = await got(product.url, {
          timeout: HostTimeouts[siteName],
          headers: {'user-agent': userAgentDictionary[siteName] || ua},
        });

        const body = html.body;
        const renderTime = new Date().getTime();
        const productName = product.productName;
        const country = product.country;
        const url = product.url;
        let isInStock = parseProductIsInStock(product, siteName, body);
        let stock = isInStock ? 1 : 0; // TODO: implement parsers for actual stock #
        const isThirdParty = parseProductIsThirdParty(product, siteName, body);
        const price = parseProductPrice(product, siteName, body);
        const htmlFileName = siteName + '-' + productName + '.html';

        writeHtmlToFile(htmlFileName, body);

        const productInfo = {productName, url, isInStock, stock, isThirdParty, price, siteName, country, renderTime};
        logger.debug('ProductParser() - parsedInfo: ', stock ? productInfo.stock : 'NO STOCK', '-', productInfo.productName, ' - ', product.url);

        if(country == 'test' && !stock) {
          logger.warn('test product not found in stock (should probably not happen)');
          // notifyServerOfError({
          //   hostname: siteName,
          //   productname: product.productName,
          //   url: product.url,
          //   country: product.country,
          //   error: 'test product not found in stock (should probably not happen)',
          // });
        }

        notifyServer(productInfo, true, body);

        return productInfo;
      } catch (e) {

        notifyServer({
          productName: product.productName,
          url: product.url,
          price: product.price,
          country: product.country,
          renderTime: new Date().getTime(),
        });

        notifyServerOfError({
          hostname: siteName,
          productname: product.productName,
          url: product.url,
          country: product.country,
          error: e.toString(),
        });

        if (e.code && e.code === 'ETIMEDOUT') {
          logger.warn('TIMEOUT ERROR: ', siteName, product);
        } else if (e.name === 'HTTPError') {
          const code = parseInt(e.toString().match(/[0-9]{3}/g));

          if (code === 404) logger.warn('404 FILE NOT FOUND ERROR:', siteName, ' - ', product.productName, ' - ', product.url);
          if (code === 403) logger.warn('403 FORBIDDEN ERROR:', siteName, ' - ', product.productName, ' - ', product.url);
          if (code === 503) {
            logger.warn('503 TEMPORARILY UNAVAILABLE ERROR:', siteName, ' - ', product.productName, ' - ', product.url);
            // TODO: retries are too damn slow we should skip for now
            // if (retry > 0) return false;
            // await delay(6000);
            // retry = retry + 1;
            // return buildParser(product, siteName, retry)();
          }

        } else {
          logger.error('ProductParser() - unknown ERROR:', product, typeof e, e.name, e.statusCode, Object.keys(e), e, e.toString());
        }

        return false;
      }
    };
  };

  /**
   * buildBatchParser()
   * @param batch
   *   batchUrl: string (the url to check all checkUrls against)
   *   country: string
   *   hostname: string
   *   productName: string
   *   checkUrls: string[] (an array of site urls for the product.country.hostname)
   * @returns {Function}
   */
  const buildBatchParser = (batch) => {
    return async function(retry = 0) {
      try {
        logger.info('BuildBatchParser() starting new batch [' + batch.productName + '][' + batch.hostname + ']');
        if (!batch.batchUrl) return logger.error('BatchParser() - ERROR Invalid Batch URL: ' + batch.batchUrl);
        if (!batch.productName) return logger.error('BatchParser() - ERROR Invalid Batch Name: ' + batch.productName);
        if (!batch.hostname) return logger.error('BatchParser() - ERROR Invalid Host Name: ' + batch.hostname);
        if (!batch.country) return logger.error('BatchParser() - ERROR Invalid country: ' + batch.country);
        if (!batch.checkUrls || !batch.checkUrls.length) return logger.error('BatchParser() - No Check Urls', batch.productName, batch.country, batch.hostname, batch.checkUrls);
        if (blackList.isBlacklisted(batch.hostname)) {
          // NOTE: taking this out could cause stats to go stale
          const updateInfo = {
            productName: batch.productName,
            url: batch.url,
            country: batch.country,
            renderTime: new Date().getTime(),
          };
          notifyServer(updateInfo);
          return logger.warn('BatchParser() - TEMPORARILY BLACKLISTED: ' + batch.hostname + '-' + batch.productName);
        }

        // TODO: randomize
        // const ua = userAgent().toString();
        const ua = userAgent.toString();
        const html = await got(batch.batchUrl, {
          timeout: HostTimeouts[batch.hostname],
          headers: {'user-agent': userAgentDictionary[batch.hostname] || ua},
        });

        const body = html.body;
        const renderTime = new Date().getTime();
        const productName = batch.productName;
        const hostname = batch.hostname;
        const country = batch.country;
        const htmlFileName = 'batch-' + hostname + '-' + country + '-' + productName + '.html';

        writeHtmlToFile(htmlFileName, body);

        batch.checkUrls.forEach(url => {
          const product = _.find(productList, site => url.includes(site.url));
          if (!product) return;

          try {
            let isInStock = parseBatchProductIsInStock(product, hostname, body);
            let stock = isInStock ? 1 : 0; // TODO: implement parsers for actual stock #
            // TODO:
            // const isThirdParty = parseProductIsThirdParty(productName, siteName, body);
            const isThirdParty = false;

            const price = parseBatchProductPrice(product, hostname, body) || -1;

            // TODO:
            const productInfo = {
              productName,
              url,
              isInStock,
              stock,
              isThirdParty,
              price,
              hostname,
              country,
              renderTime,
            };

            const productStr = 'BatchParser() [ ' +
              productName.padEnd(9) +
              ' ][ ' +
              hostname.padEnd(16) +
              ' ][ ' +
              (stock ? '-=STOCK=-' : 'no stock') +
              ' ][ ' +
              (price != -1 ? price.toString().padEnd(8) : 'No Price') +
              ' ][ ' +
              (url ? url.padEnd(200) : 'n/a') +
              ' ][ ' +
              (batch.batchUrl ? batch.batchUrl.padEnd(200) : 'n/a') +
              ' ]';

            logger.info(productStr);

            notifyServer(productInfo, true, body);

            return productInfo;

          } catch (e) {

            notifyServer({
              productName: productName,
              url: url,
              price: product.price,
              country: country,
              renderTime: new Date().getTime(),
            });

            notifyServerOfError({
              hostname,
              productname: product.productName,
              url,
              country,
              error: e.toString(),
            });

            if (e.code && e.code === 'ETIMEDOUT') {
              logger.warn('TIMEOUT ERROR: ', hostname, product);
            } else if (e.name === 'HTTPError') {
              const code = parseInt(e.toString().match(/[0-9]{3}/g));

              if (code === 404) logger.warn('404 FILE NOT FOUND ERROR:', hostname, ' - ', productName, ' - ', url);
              if (code === 403) logger.warn('403 FORBIDDEN ERROR:', hostname, ' - ', productName, ' - ', url);
              if (code === 503) {
                logger.warn('503 TEMPORARILY UNAVAILABLE ERROR:', hostname, ' - ', productName, ' - ', url);
                // TODO: retries are too damn slow we should skip for now
                // if (retry > 0) return false;
                // await delay(6000);
                // retry = retry + 1;
                // return buildParser(product, siteName, retry)();
              }

            } else {
              logger.warn('BatchParser() - unknown ERROR:', product, typeof e, e.name, e.statusCode, Object.keys(e), e, e.toString());
            }

            return false;
          }
        });
      } catch (e) {
        logger.warn('BatchParser() - Batch ERROR: ', e, batch);
      }
    };
  };
  /**
   * builds the crawler dictionary for the instance to loop through and query the products information
   * @returns {object} ProductDictionary
   * ProductDictionary = {
   *     country: [
   *       {
   *         product: Product,
   *         hostname: string (full hostname including www. & .com/.de/etc),
   *         parse: async function (this function will query the url and attempt to parse the related info)
   *       }
   *     ]
   * }
   */
  const buildDictionary = () => {
    let uniqIndex = 0;

    // NOTE: now that we retrieve the list from the server sorted by oldest first we don't need to shuffle the list
    // productDictionary = _.shuffle(_.map(productList, product => {

    productDictionary = (_.map(productList, product => {
      return new (function() {
        uniqIndex += 1;
        this.index = uniqIndex;
        this.hostname = (new URL(product.url).hostname);
        this.productname = product.productName;
        this.product = product;
        this.parse = buildParser(product, this.hostname);
      })();
    }));
  };

  const buildBatchDictionary = () => {
    let uniqIndex = 0;

    batchDictionary = (batchList.map(batch => {
      return new (function() {
        uniqIndex += 1;
        this.index = uniqIndex;
        this.batchUrl = batch.batchUrl;
        this.country = batch.country;
        this.hostname = batch.hostname;
        this.productName = batch.productName;

        const checkSites = _.filter(productList, site => {
          const productName = site.productName;
          const hostName = (new URL(site.url).hostname);
          return (this.productName === productName && this.hostname === hostName);
        });

        this.checkUrls = checkSites.map(site => site.url);
        this.parse = buildBatchParser(this);
      })();
    }));
    batchDictionary = _.filter(batchDictionary, bItem => bItem.batchUrl && bItem.checkUrls.length);

    // TODO: take out when we get EVGA working, but for now we only get forbidden
    batchDictionary = _.filter(batchDictionary, bItem => bItem.hostname !== 'www.evga.com');
  };

  // z.getInfo = async (product) => {
  //   if (!product.url) return console.error('ProductComparator.getInfo() - ERROR Invalid Product', product.url);
  //   if (!product.country) return console.error('ProductComparator.getInfo() - ERROR Invalid Product', product.country);
  //   if (!product.productName) return console.error('ProductComparator.getInfo() - ERROR Invalid Product', product.productName);
  //   if (!product.price) return console.error('ProductComparator.getInfo() - ERROR Invalid Product', product.price);
  //
  //   const body = ((await got(product.url)).body);
  //   const result = {
  //     isInStock: true,
  //     stock: 0,
  //     isThirdParty: false,
  //     price: 0,
  //   };
  //
  //   const isInStock = body.includes(' OUT OF STOCK.');
  //   const priceRegexp = /<li class="price-current"><span class="price-current-label"><\/span>\$<strong>[0-9]+<\/strong><sup>\.[0-9]+<\/sup><\/li>/g;
  //   // const priceRegexp = /<li class="price-current"><span class="price-current-label">/g;
  //   // logger.debug('body: ', body);
  //   logger.debug('isInStock: ', isInStock);
  //   logger.debug('price: ', body.match(priceRegexp));
  // };


  const parseProductIsInStock = (product, siteName, html) => {
    switch (product.country) {
      case 'US':
      case 'USA':
      case 'UK':
      case 'CAN':
      case 'TEST':
      case 'test':
        const siteSpecificIsInStockFunction = isInStockSiteDictionary[siteName];
        if (siteSpecificIsInStockFunction) {
          logger.debug('parseProductIsInStock() - found specific site function: ', siteName);
          return siteSpecificIsInStockFunction(html);
        } else {
          logger.debug('parseProductIsInStock() - using generic: ', siteName);
          return genericIsInStockEnglish(html);
        }
      default:
        return genericIsInStockEnglish(html);
    }
  };

  const batchIsInStockNewegg = (html, url) => {
    // First check to see if the check Url exists on the page at all
    // assuming that the index page has the whole url for the product somewhere on the page
    // may have to use a different means of finding products on different index pages
    const isIncludedInHtml = html.includes(url);
    if (!isIncludedInHtml) return false;

    // Load the html string into cheerio and query all <a> tags so that we can look for the container that will forward
    // the user to the specific product page
    const $ = cheerio.load(html);
    const aTags = $('body').find('a').toArray();

    // Look through all the <a> tags and find the first one that matches our check url
    const relatedTags = _.filter(aTags, t => $(t).attr('href') === url);

    try {
      // On the Newegg index page the container will be the first tag that matches our url's parent tag
      const firstRelatedTag = $(relatedTags).toArray()[0];
      const newBody = $(firstRelatedTag).parent().toString();

      // Just for testing purposes create a file with just the container we caught in the above parsing, if we did
      // this right we should get a div for just the product we want out of the index page that we can load in our
      // browser and double check
      const hostname = new URL(url).hostname;
      const filename = 'batch-partial-' + (url.replace(/https?:\/\//g, '').replace(hostname + '/', '').split('/')[0] || 'no-name') + '.html';
      writeHtmlToFile(filename, newBody);

      // On the newegg index page we have the benefit of them using the same images/buttons to denot if a product is in
      // stock so we can just sent the mini-container we parsed direct to the host specific parser
      return containerIsInStockNewegg(newBody);
    } catch (e) {
      logger.info('batchIsInStockNewegg() cant parse tags');
      return false;
    }
  };

  const batchIsInStockEVGA = (html, url) => {
    // First check to see if the check Url exists on the page at all
    // assuming that the index page has the whole url for the product somewhere on the page
    // may have to use a different means of finding products on different index pages
    const isIncludedInHtml = html.includes(url);
    if (!isIncludedInHtml) return false;

    // Load the html string into cheerio and query all <a> tags so that we can look for the container that will forward
    // the user to the specific product page
    const $ = cheerio.load(html);
    const aTags = $('body').find('a').toArray();

    // EVGA doesn't contain our check url but it does have the product number (pn) of each product in the container
    // so we can use some regexp and string manipulation to grab it from the url and search for it in the index page
    const pn = url.match(/(pn=).*(?=&)/g).split('=')[1];

    // Look through all the <a> tags and find the first one that contains the pn we parsed from our check url
    const relatedTags = _.filter(aTags, t => $(t).attr('href').includes(pn));

    try {
      // TODO: once we have the tag for the pn above, we need to loop through each tags parent till we get the container
      // that holds the stock information.  Once we have that as long as EVGA like newegg uses the same buttons/classes
      // etc to denote wether a product is in stock we can send the container as a string through to the
      // siteIsInStockEVGA parser

      // return siteIsInStockEVGA(newBody);
    } catch (e) {
      logger.info('batchIsInStockEVGA() cant parse tags');
      return false;
    }
  };

  const batchIsInStockBestBuy = (html, url) => {
    const $ = cheerio.load(html);

    // Get the shop-sku-list container that contains the product list items
    const shopList = $('.shop-sku-list').toArray();

    if (!shopList || !shopList.length) {
      logger.warn('batchIsInStockBestBuy() - ERROR CheckUrl not found in BatchUrl: ', url);
      return false;
    }

    // Find all of the list items inside the shop-sku-list
    const listItems = $(shopList).find('li').toArray();

    // none of the items include the url so we need to get the product # out of
    // the url and use it to find the list item we're looking for
    const splitUrl = url.split('/');
    const productNumber = splitUrl[splitUrl.length - 1].split('.p')[0];

    // find the list item that contains the sku (productNumber) we're looking for
    const relatedTags = _.filter(listItems, t => $(t).attr('data-sku-id') === productNumber);

    if (!relatedTags || !relatedTags.length) {
      logger.error('batchIsInStockBestBuy() - ERROR CheckUrl not found in BatchUrl: ', url);
      return false;
    }

    try {
      // now that we have the list item container we're looking for make it a
      // string for easy parsing
      const newBody = $(relatedTags).toString();

      // create a filename and write to file for testing
      // vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
      const hostname = new URL(url).hostname;
      const filename = 'batch-partial-' + hostname + '-' + productNumber + '.html';
      writeHtmlToFile(filename, newBody);
      // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

      return newBody.includes('Add to Cart');
    } catch (e) {
      logger.info('batchIsInStockBestBuy() cant parse tags');
      return false;
    }
  };

  const isInStockBatchDictionary = {
    'www.newegg.com': batchIsInStockNewegg,
    'www.evga.com': batchIsInStockEVGA,
    'www.bestbuy.com': batchIsInStockBestBuy,
  };

  const parseBatchProductIsInStock = (product, siteName, html) => {
    try {
      product.url = product.url.replace(/\?$/g, '');
    } catch (e) {
      logger.warn('error formatting url: ', product.url);
    }
    switch (product.country) {
      case 'US':
      case 'USA':
      case 'UK':
      case 'CAN':
      case 'TEST':
      case 'test':
        const siteSpecificIsInStockFunction = isInStockBatchDictionary[siteName];
        if (siteSpecificIsInStockFunction) {
          logger.debug('parseBatchProductIsInStock() - found specific site function: ', siteName);
          return siteSpecificIsInStockFunction(html, product.url);
        } else {
          logger.debug('parseBatchProductIsInStock() - using generic: ', siteName);
          return genericIsInStockEnglish(html);
        }
      default:
        return genericIsInStockEnglish(html);
    }
  };

  const batchPriceNewegg = (html, url) => {
    // First check to see if the check Url exists on the page at all
    // assuming that the index page has the whole url for the product somewhere on the page
    // may have to use a different means of finding products on different index pages
    const isIncludedInHtml = html.includes(url);
    if (!isIncludedInHtml) return false;

    // Load the html string into cheerio and query all <a> tags so that we can look for the container that will forward
    // the user to the specific product page
    const $ = cheerio.load(html);
    const aTags = $('body').find('a').toArray();

    // Look through all the <a> tags and find the first one that matches our check url
    const relatedTags = _.filter(aTags, t => $(t).attr('href') === url);

    try {
      // On the Newegg index page the container will be the first tag that matches our url's parent tag
      const firstRelatedTag = $(relatedTags).toArray()[0];
      const newBody = $(firstRelatedTag).parent().toString();

      // Just for testing purposes create a file with just the container we caught in the above parsing, if we did
      // this right we should get a div for just the product we want out of the index page that we can load in our
      // browser and double check
      const hostname = new URL(url).hostname;
      const filename = 'batch-partial-' + (url.replace(/https?:\/\//g, '').replace(hostname + '/', '').split('/')[0] || 'no-name') + '.html';
      writeHtmlToFile(filename, newBody);

      // On the newegg index page we have the benefit of them using the same images/buttons to denote if a product is in
      // stock so we can just sent the mini-container we parsed direct to the host specific parser
      return sitePriceNewegg(newBody);
    } catch (e) {
      logger.info('batchPriceNewegg() cant parse tags');
      return false;
    }
  };

  const batchPriceEVGA = (html, url) => {
    // First check to see if the check Url exists on the page at all
    // assuming that the index page has the whole url for the product somewhere on the page
    // may have to use a different means of finding products on different index pages
    const isIncludedInHtml = html.includes(url);
    if (!isIncludedInHtml) return false;

    // Load the html string into cheerio and query all <a> tags so that we can look for the container that will forward
    // the user to the specific product page
    const $ = cheerio.load(html);
    const aTags = $('body').find('a').toArray();

    // EVGA doesn't contain our check url but it does have the product number (pn) of each product in the container
    // so we can use some regexp and string manipulation to grab it from the url and search for it in the index page
    const pn = url.match(/(pn=).*(?=&)/g).split('=')[1];

    // Look through all the <a> tags and find the first one that contains the pn we parsed from our check url
    const relatedTags = _.filter(aTags, t => $(t).attr('href').includes(pn));

    try {
      // TODO: once we have the tag for the pn above, we need to loop through each tags parent till we get the container
      // that holds the stock information.  Once we have that as long as EVGA like newegg uses the same buttons/classes
      // etc to denote wether a product is in stock we can send the container as a string through to the
      // sitePriceEVGA parser

      // return sitePriceEVGA(newBody);
    } catch (e) {
      logger.info('batchPriceEVGA() cant parse tags');
      return false;
    }
  };

  const batchPriceBestBuy = (html, url) => {
    const $ = cheerio.load(html);

    // Get the shop-sku-list container that contains the product list items
    const shopList = $('.shop-sku-list').toArray();

    if (!shopList || !shopList.length) {
      logger.warn('batchPriceBestBuy() - ERROR CheckUrl not found in BatchUrl: ', url);
      return false;
    }

    // Find all of the list items inside the shop-sku-list
    const listItems = $(shopList).find('li').toArray();

    // none of the items include the url so we need to get the product # out of
    // the url and use it to find the list item we're looking for
    const splitUrl = url.split('/');
    const productNumber = splitUrl[splitUrl.length - 1].split('.p')[0];

    // find the list item that contains the sku (productNumber) we're looking for
    const relatedTags = _.filter(listItems, t => $(t).attr('data-sku-id') === productNumber);

    if (!relatedTags || !relatedTags.length) {
      logger.error('batchPriceBestBuy() - ERROR CheckUrl not found in BatchUrl: ', url);
      return false;
    }

    try {
      // now that we have the list item container we're looking for make it a
      // string for easy parsing
      const newBody = $(relatedTags).toString();

      // create a filename and write to file for testing
      // vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
      const hostname = new URL(url).hostname;
      const filename = 'batch-partial-' + hostname + '-' + productNumber + '.html';
      writeHtmlToFile(filename, newBody);
      // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

      return sitePriceBestBuy(newBody);
    } catch (e) {
      logger.info('batchPriceBestBuy() cant parse tags');
      return false;
    }
  };

  const priceBatchDictionary = {
    'www.newegg.com': batchPriceNewegg,
    'www.evga.com': batchPriceEVGA,
    'www.bestbuy.com': batchPriceBestBuy,
  };

  const parseBatchProductPrice = (product, siteName, html) => {
    try {
      product.url = product.url.replace(/\?$/g, '');
    } catch (e) {
      logger.warn('error formatting url: ', product.url);
    }
    switch (product.country) {
      case 'US':
      case 'USA':
      case 'UK':
      case 'CAN':
        const siteSpecificPriceFunction = priceBatchDictionary[siteName];
        if (siteSpecificPriceFunction) {
          logger.debug('parseBatchProductIsInStock() - found specific site function: ', siteName);
          return siteSpecificPriceFunction(html, product.url);
        } else {
          logger.debug('parseBatchProductIsInStock() - using generic: ', siteName);
          return; // genericPriceEnglish(html);
        }
      default:
        return; // genericPriceEnglish(html);
    }
  };
  // ================================================
  // isThirdParty
  // ================================================
  // TODO: implement
  const genericIsThirdPartyEnglish = (html) => {
    // logger.debug('genericIsThirdPartyEnglish() - NOT IMPLEMENTED');
    return false;
  };
  // TODO: implement
  const genericIsThirdPartySpanish = (html) => {
    // logger.debug('genericIsThirdPartySpanish() - NOT IMPLEMENTED');
    return false;
  };
  // TODO: implement
  const genericIsThirdPartyEurope = (html) => {
    // logger.debug('genericIsThirdPartyEurope() - NOT IMPLEMENTED');
    return false;
  };
  const isThirdPartyAmazon = (html) => (html && !html.includes('<span class="tabular-buybox-tex">Amazon.com</span>'));
  const isThirdPartyNewegg = (html) => (html && !html.includes('Sold by: Newegg') || html.includes('Ships from China.') || html.includes('Ships from Hong Kong.'));
  const isThirdPartyWalmart = (html) => (html && !html.includes('https://help.walmart.com/article/shipping-and-delivery-with-walmart-com/0fa824faeca24e599e0e5292a7185336'));

  const isThirdPartySiteDictionary = {
    'www.amazon.com': isThirdPartyAmazon,
    'amzn.to': isThirdPartyAmazon,
    'www.newegg.com': isThirdPartyNewegg,
    'www.newegg.ca': isThirdPartyNewegg,
    'www.walmart.com': isThirdPartyWalmart,
  };

  const parseProductIsThirdParty = (product, siteName, html) => {
    switch (product.country) {
      case 'US':
      case 'USA':
      case 'UK':
      case 'CAN':
        const siteSpecificIsThirdPartyFunction = isThirdPartySiteDictionary[siteName];
        if (siteSpecificIsThirdPartyFunction) {
          return siteSpecificIsThirdPartyFunction(html);
        } else {
          return genericIsThirdPartyEnglish(html);
        }
      default:
        return genericIsThirdPartyEnglish(html);
    }
  };

  // ================================================
  // price
  // ================================================

  const sitePriceBestBuy = (html) => {
    if (html) {
      let startString = 'Your price for this item is $<!-- -->';
      let indexStart = parseInt(html.indexOf(startString));
      if (indexStart == -1) return -1;
      indexStart += startString.length;
      let indexEnd = indexStart + parseInt(html.substring(indexStart).indexOf('</span>'));
      if (indexEnd == -1) return -2;
      let price = parseNumberEN(html.substring(indexStart, indexEnd));
      return price;
    }
  };

  const sitePriceAmazon = (html) => {
    if (html) {
      let startString = '<span id="price_inside_buybox" class="a-size-medium a-color-price">';
      let indexStart = parseInt(html.indexOf(startString));
      if (indexStart == -1) return -1;
      indexStart += startString.length;
      let indexEnd = indexStart + parseInt(html.substring(indexStart).indexOf('</span>'));
      if (indexEnd == -1) return -2;
      let price = parseNumberEN(html.substring(indexStart + 1, indexEnd));
      return price;
    }
  };

  const sitePriceNewegg = (html) => {
    if (html) {
      let startString = '<span class="price-current-label"></span>$<strong>';
      let indexStart = parseInt(html.indexOf(startString));
      if (indexStart == -1) return -1;
      indexStart += startString.length;
      let indexEnd = indexStart + parseInt(html.substring(indexStart).indexOf('</strong>'));
      if (indexEnd < 0) return -2;
      let price = parseNumberEN(html.substring(indexStart, indexEnd));
      return price;
    }
  };

  const sitePriceOverclockers = (html) => {
    if (html) {
      let startString = '<div class="article_details_price2">';
      let indexStart = parseInt(html.indexOf(startString)); //  get to the general area
      if (indexStart == -1) return -1;
      startString = '<strong>';
      if (indexStart == -1) return -2;
      indexStart = parseInt(html.indexOf(startString, indexStart)); // get to the specidic line with the price
      indexStart += startString.length;
      let indexEnd = indexStart + parseInt(html.substring(indexStart).indexOf('</strong>'));
      if (indexEnd == -1) return -3;
      let price = parseNumberEN(html.substring(indexStart, indexEnd));
      return price;
    }
  };

  const sitePriceWalmart = (html) => {
    if (html) {
      let startString = '<span class="price-characteristic" itemprop="price" content="';
      let indexStart = parseInt(html.indexOf(startString));
      if (indexStart == -1) return -1;
      indexStart += startString.length;
      let indexEnd = indexStart + parseInt(html.substring(indexStart).indexOf('">'));
      if (indexEnd == -1) return -2;
      let price = parseNumberEN(html.substring(indexStart, indexEnd));
      return price;
    }
  };

  const priceSiteDictionary = {
    'www.bestbuy.com': sitePriceBestBuy,
    'www.bestbuy.ca': sitePriceBestBuy,
    'www.newegg.com': sitePriceNewegg,
    'www.newegg.ca': sitePriceNewegg,
    'www.amazon.com': sitePriceAmazon,
    'www.amazon.ca': sitePriceAmazon,
    'www.overclockers.co.uk': sitePriceOverclockers,
    'www.walmart.com': sitePriceWalmart,
  };

  const parseProductPrice = (product, siteName, html) => {
    switch (product.country) {
      case 'US':
      case 'USA':
      case 'UK':
      case 'CAN':
      case 'test':
        const siteSpecificPriceFunction = priceSiteDictionary[siteName];
        if (siteSpecificPriceFunction) {
          logger.debug('parseProductPrice() - found specific site function: ', siteName);
          return siteSpecificPriceFunction(html);
        } else {
          log.warn('No siteSpecificPriceFunction exists for domain.')
          return -1;
        }
    }
  };

  // ================================================
  return z;
})();
