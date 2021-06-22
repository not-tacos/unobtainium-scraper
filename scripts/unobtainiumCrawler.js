'use strict';
const CRAWLER_VERSION = 1;

import _ from 'lodash';
import cheerio from 'cheerio';

import { batchHostTimeouts, containerIsInStockNewegg, genericIsInStockEnglish, HostTimeouts, isInStockSiteDictionary, userAgentDictionary } from "./sites";
import { firstUrlSegment, parseNumberEN } from "../src/util";
import { createCrawlerBlackList } from '../src/blacklist';
import { ApiClient } from '../src/api-client';
import { CrawlClient } from '../src/crawl-client';
import { createUnobtaniumLogger } from "../src/logger";
import { getCountries } from '../src/options';
import { FileWriter } from '../src/file-writer';
import { parseBatchProductIsInStock } from '../src/batch-in-stock';
import { parseProductPrice, sitePriceBestBuy, sitePriceNewegg } from '../src/site-price';

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

    fileWriter = new FileWriter(options,logger);

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

          apiClient.notifyServer(updateInfo);
          return logger.warn('ProductParser() - TEMPORARILY BLACKLISTED: ' + siteName + '-' + product.productName);
        }

        const body = await crawlClient.get(
          product.url,
          HostTimeouts[siteName],
          userAgentDictionary[siteName]
        );

        const renderTime = new Date().getTime();
        const productName = product.productName;
        const country = product.country;
        const url = product.url;
        let isInStock = parseProductIsInStock(product, siteName, body);
        let stock = isInStock ? 1 : 0; // TODO: implement parsers for actual stock #
        const isThirdParty = parseProductIsThirdParty(product, siteName, body);
        const price = parseProductPrice(logger, product, siteName, body);

        fileWriter.writeHtmlToFile(`${siteName}-${productName}`, body);

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

        apiClient.notifyServer(productInfo, true, body);

        return productInfo;
      } catch (e) {

        apiClient.notifyServer({
          productName: product.productName,
          url: product.url,
          price: product.price,
          country: product.country,
          renderTime: new Date().getTime(),
        });

        apiClient.notifyServerOfError({
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
        parse: buildParser(product, hostname),
      };
    });

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
          apiClient.notifyServer(updateInfo);
          return logger.warn('BatchParser() - TEMPORARILY BLACKLISTED: ' + batch.hostname + '-' + batch.productName);
        }

        const body = await crawlClient.get(
          batch.batchUrl,
          HostTimeouts[batch.hostname],
          userAgentDictionary[batch.hostname]
        );

        const renderTime = new Date().getTime();
        const productName = batch.productName;
        const hostname = batch.hostname;
        const country = batch.country;

        fileWriter.writeHtmlToFile(`batch-${hostname}-${country}-${productName}`, body);

        batch.checkUrls.forEach(url => {
          const product = _.find(productList, site => url.includes(site.url));
          if (!product) return;

          try {
            let isInStock = parseBatchProductIsInStock(
              logger,
              fileWriter,
              product,
              hostname,
              body
            );
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

            apiClient.notifyServer(productInfo, true, body);

            return productInfo;

          } catch (e) {

            apiClient.notifyServer({
              productName: productName,
              url: url,
              price: product.price,
              country: country,
              renderTime: new Date().getTime(),
            });

            apiClient.notifyServerOfError({
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

        return { ...record, parse: buildBatchParser(record) };
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
      fileWriter.writeHtmlToFile(
        `batch-partial-${firstUrlSegment(url)}`,
        newBody
      );

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
      fileWriter.writeHtmlToFile(
        `batch-partial-${hostname}-${productNumber}`,
        newBody
      );
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
          logger.debug('parseBatchProductPrice() - found specific site function: ', siteName);
          return siteSpecificPriceFunction(html, product.url);
        } else {
          logger.debug('parseBatchProductPrice() - using generic: ', siteName);
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
  return z;
})();