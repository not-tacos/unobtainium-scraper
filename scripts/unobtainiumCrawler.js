'use strict';
const CRAWLER_VERSION = 1;

import _ from 'lodash';

import { batchHostTimeouts } from "./sites";
import { createCrawlerBlackList } from '../src/blacklist';
import { ApiClient } from '../src/api-client';
import { CrawlClient } from '../src/crawl-client';
import { createUnobtaniumLogger } from "../src/logger";
import { getCountries } from '../src/options';
import { FileWriter } from '../src/file-writer';
import { buildParser } from '../src/product-parser';
import { buildBatchParser } from '../src/batch-parser';

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
  let apiClient = null;
  let crawlClient = null;
  let fileWriter = null;

  let logger = createUnobtaniumLogger();

  // ================================================
  // PUBLIC functions
  // ================================================

  z.init = async (_env, _apiUrl, _blackList = [], _productList, _batchList) => {
    env = _env || env;
    apiUrl = _apiUrl || apiUrl;
    blackList = createCrawlerBlackList(_blackList,logger);
    productList = _productList || null;
    batchList = _batchList || null;


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

    apiClient = new ApiClient(
      _apiUrl,
      logger,
      runOptions,
      CRAWLER_VERSION,
      blackList
    );
    crawlClient = new CrawlClient();

    fileWriter = new FileWriter({},logger);

    productList = productList ? (await Promise.resolve(productList)) : await apiClient.retrieveNewProductList();
    batchList = batchList ? (await Promise.resolve(batchList)) : await apiClient.retrieveBatchList();
    logger.info('init() - loaded product list: ', productList.length);
    logger.info('init() - loaded batch list: ', batchList.length);
    productDictionary = buildDictionary(productList);
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

    const options = runOptions = {
      countries: getCountries(),
      logLevel: _options.logLevel || process.env.CRAWLER_LOG_LEVEL || "info",
      logDir: _options.logDir || process.env.CRAWLER_LOG_DIR || null,
      batchSize: _options.batchSize || _options.limit || 10,
      limit: _options.limit || productDictionary.length,
      throttle: _options.throttle || 5,
      logHtml: (!!process.env.CRAWLER_LOG_HTML) || false,
    };

    // this was constructed at init(), but the setting is applied now:
    fileWriter.logHtml = options.logHtml;


    productDictionary = _.filter(productDictionary, (p) =>
      options.countries.includes(p.product.country)
    );
    batchDictionary = _.filter(batchDictionary, (b) =>
      options.countries.includes(b.country)
    );


    if (options.logDir) {
      logger.addStream({
        path: options.logDir + "crawl.log",
      });
    }
    if (options.logLevel) {
      logger.level(options.logLevel);
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
        apiClient.pingServer()

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

  /**
   * Helper function to resolve promise after a delay in MS
   * @param timeoutInMs
   * @returns {Promise<unknown>}
   */
  const delay = (timeoutInMs) => new Promise(resolve => setTimeout(resolve, timeoutInMs));




  const buildDictionary = (productList) =>
    // NOTE: now that we retrieve the list from the server sorted by oldest first we don't need to shuffle the list
    // productDictionary = _.shuffle(_.map(productList, product => {
    productList.map((product, index) => {
      const hostname = new URL(product.url).hostname;
      return {
        index,
        hostname,
        productname: product.productName,
        product: product,
        parse: buildParser(blackList, apiClient, crawlClient, logger, fileWriter, product, hostname),
      };
    });

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
  const buildBatchDictionary = () => {
    batchDictionary = batchList
      .map((batch, index) => {
        const checkUrls = productList
          .filter((site) => {
          const productName = site.productName;
            const hostName = new URL(site.url).hostname;
            return (
              batch.productName === productName && batch.hostname === hostName
            );
          })
          .map((site) => site.url);

        const record = {
          index: index,
          batchUrl: batch.batchUrl,
          country: batch.country,
          hostname: batch.hostname,
          productName: batch.productName,
          checkUrls,
        };

        return { ...record, parse: buildBatchParser(logger, blackList, apiClient, crawlClient, fileWriter,productList, record) };
      })
      .filter((bItem) => bItem.batchUrl && bItem.checkUrls.length);

    // TODO: take out when we get EVGA working, but for now we only get forbidden
    batchDictionary = batchDictionary.filter(
      (bItem) => bItem.hostname !== "www.evga.com"
    );
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




  // ================================================
  return z;
})();