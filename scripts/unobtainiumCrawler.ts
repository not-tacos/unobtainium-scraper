"use strict";
const CRAWLER_VERSION = 1;

import _ from "lodash";

import { batchHostTimeouts } from "./sites";
import { createCrawlerBlackList } from "../src/blacklist";
import { ApiClient } from "../src/api-client";
import { CrawlClient } from "../src/crawl-client";
import { createUnobtaniumLogger } from "../src/logger";
import { CrawlerOptions, getCountries } from "../src/options";
import { FileWriter } from "../src/file-writer";
import { buildParser } from "../src/product-parser";
import { buildBatchParser } from "../src/batch-parser";

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

class UnobtaniumCrawler {
  logger: any;
  constructor() {
    this.logger = createUnobtaniumLogger();
  }
  // ================================================
  // PRIVATE variables
  // ================================================

  // const z = this;
  env: string = "dev";
  apiUrl =
    this.env === "dev" ? "http://localhost:3009/" : "https://unobtainium.app/";
  productDictionary = null;
  batchDictionary = null;
  productList = null;
  batchList = null;
  blackList = null;
  runOptions = {};
  batchTimers = {};
  apiClient = null;
  crawlClient = null;
  fileWriter = null;

  // ================================================
  // PUBLIC functions
  // ================================================

  public async init(
    _env?,
    _apiUrl?,
    _blackList = [],
    _productList?,
    _batchList?
  ) {
    this.env = _env || this.env;
    this.apiUrl = _apiUrl || this.apiUrl;
    this.blackList = createCrawlerBlackList(_blackList, this.logger);
    this.productList = _productList || null;
    this.batchList = _batchList || null;

    if (this.env === "dev") {
      this.logger.info(
        "init() - ================================================"
      );
      this.logger.info("init() - DEVELOPMENT MODE - ", this.apiUrl);
      this.logger.info(
        "init() - ================================================"
      );
    } else {
      this.logger.info("init() - connecting to server - ", this.apiUrl);
    }
    this.logger.info(
      "init() - ================================================"
    );
    this.logger.info("init() - CRAWLER_VERSION: ", CRAWLER_VERSION);
    this.logger.info(
      "init() - ================================================"
    );

    this.apiClient = new ApiClient(
      _apiUrl,
      this.logger,
      this.runOptions,
      CRAWLER_VERSION,
      this.blackList
    );
    this.crawlClient = new CrawlClient();

    this.fileWriter = new FileWriter({}, this.logger);

    this.productList = this.productList
      ? await Promise.resolve(this.productList)
      : await this.apiClient.retrieveNewProductList();
    this.batchList = this.batchList
      ? await Promise.resolve(this.batchList)
      : await this.apiClient.retrieveBatchList();
    this.logger.info("init() - loaded product list: ", this.productList.length);
    this.logger.info("init() - loaded batch list: ", this.batchList.length);
    this.productDictionary = this.buildDictionary(this.productList);
    this.buildBatchDictionary();
    this.logger.info(
      "init() - loaded product dictionary: ",
      this.productDictionary.length
    );

    return this.blackList;
  }

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
  public async startWithOptions(_options: CrawlerOptions = {}) {
    if (!this.productList) await this.init();

    // logger.info('start() - startWithOptions: US only');

    const options = (this.runOptions = {
      countries: getCountries(),
      logLevel: _options.logLevel || process.env.CRAWLER_LOG_LEVEL || "info",
      logDir: _options.logDir || process.env.CRAWLER_LOG_DIR || null,
      batchSize: _options.batchSize || _options.limit || 10,
      limit: _options.limit || this.productDictionary.length,
      throttle: _options.throttle || 5,
      logHtml: !!process.env.CRAWLER_LOG_HTML || false,
    });

    // this was constructed at init(), but the setting is applied now:
    this.fileWriter.logHtml = options.logHtml;

    this.productDictionary = _.filter(this.productDictionary, (p) =>
      options.countries.includes(p.product.country)
    );
    this.batchDictionary = _.filter(this.batchDictionary, (b) =>
      options.countries.includes(b.country)
    );

    if (options.logDir) {
      this.logger.addStream({
        path: options.logDir + "crawl.log",
      });
    }
    if (options.logLevel) {
      this.logger.level(options.logLevel);
    }

    this.logger.info("start() - startingWithOptions: ", options);
    this.logger.info(
      "start() - startingWithOptions productDictionary",
      this.productDictionary.length
    );
    this.logger.info(
      "start() - startingWithOptions batchDictionary",
      this.batchDictionary.length
    );

    let index = 0;
    let parsed = 0;
    let promises = [];
    let queue = [];

    if (process.env.DISABLE_BATCH_EXECUTION !== "true")
      this.startBatchExecution();

    return new Promise<void>((resolve, reject) => {
      const addToQueue = () => {
        promises = [];

        _.range(options.batchSize).forEach((i) => {
          if (index < options.limit) {
            queue.push(this.productDictionary[index]);
            index += 1;
          }
        });

        this.logger.debug(
          "start() - addToQueue() - added: ",
          options.batchSize
        );

        setTimeout(startExecution, options.throttle * 1000);
      };

      const startExecution = () => {
        this.apiClient.pingServer();

        if (queue.length) {
          for (let i = queue.length - 1; i >= 0; i--) {
            const item = queue[i];
            this.logger.debug(
              "start() - startExecution() - working: ",
              item.index,
              "-",
              item.product.country,
              "-",
              item.product.productName,
              "-",
              item.hostname
            );
            queue.pop();
            parsed += 1;
            if (parsed >= options.limit) return stopExecution();

            promises.push(item.parse());
          }

          Promise.all(promises).then(addToQueue);
        } else {
          if (index >= this.productDictionary.length) return stopExecution();
          if (index === 0) {
            addToQueue();
          }
        }
      };

      const stopExecution = () => {
        this.clearBatchTimers();
        return resolve();
      };

      // NOTE: turn this ON in the env file to better test batch parsing
      if (process.env.DISABLE_PRODUCTLIST === "true") return;
      return addToQueue();
    });
  }

  // ================================================
  // PRIVATE functions
  // ================================================
  /**
   * startBatchExecution()
   * divides the batchDictionary by host, runs every host at once, then schedules the next run for every host according
   * to the batchHostTimeouts dictionary
   */
  startBatchExecution() {
    const indexObj = {};
    let batchByHost = {};

    this.batchDictionary.forEach((item) => {
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

      this.batchTimers[host] = setTimeout(() => {
        const i = index + 1;
        startExecutionForHost(batch, host, i);
      }, timer);
    };

    Object.keys(batchByHost).forEach((host) => {
      startExecutionForHost(batchByHost, host, -1);
    });
  }

  clearBatchTimers() {
    this.logger.warn("ClearBatchTimers() - cleaning up");
    Object.keys(this.batchTimers).forEach((k) =>
      clearTimeout(this.batchTimers[k])
    );
  }

  /**
   * Helper function to resolve promise after a delay in MS
   * @param timeoutInMs
   * @returns {Promise<unknown>}
   */
  delay(timeoutInMs) {
    return new Promise((resolve) => setTimeout(resolve, timeoutInMs));
  }

  buildDictionary(productList) {
    // NOTE: now that we retrieve the list from the server sorted by oldest first we don't need to shuffle the list
    // productDictionary = _.shuffle(_.map(productList, product => {
    return productList.map((product, index) => {
      const hostname = new URL(product.url).hostname;
      return {
        index,
        hostname,
        productname: product.productName,
        product: product,
        parse: buildParser(
          this.blackList,
          this.apiClient,
          this.crawlClient,
          this.logger,
          this.fileWriter,
          product,
          hostname
        ),
      };
    });
  }

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
  buildBatchDictionary() {
    this.batchDictionary = this.batchList
      .map((batch, index) => {
        const checkUrls = this.productList
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

        return {
          ...record,
          parse: buildBatchParser(
            this.logger,
            this.blackList,
            this.apiClient,
            this.crawlClient,
            this.fileWriter,
            this.productList,
            record
          ),
        };
      })
      .filter((bItem) => bItem.batchUrl && bItem.checkUrls.length);

    // TODO: take out when we get EVGA working, but for now we only get forbidden
    this.batchDictionary = this.batchDictionary.filter(
      (bItem) => bItem.hostname !== "www.evga.com"
    );
  }

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
}

let theCrawler = null;

export default {
  async init(a, b, c) {
    console.log("### init()");
    theCrawler = new UnobtaniumCrawler();
    return theCrawler.init(a, b, c);
  },
  async startWithOptions(a) {
    console.log("### startWithOptions()");
    return theCrawler.startWithOptions(a);
  },
};
