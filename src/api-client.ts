import got from "got";
import { CrawlerBlacklist } from "./blacklist";
import { Logger } from "./logger";
import { CrawlerOptions } from "./options";

import { uuidv4 } from "./util";

type ParsedResults = {
  siteName?: string;
  version?: string;
};

type ScraperError = {
  crawlerId: string;
  crawlerVersion: any;
  hostname: string;
};

export type Product = {
  country: string;
  productName: string;
  price: number;
  url: string;
};

export type ApiProduct = Product & {
  lastUpdated: string;
};

export type ApiBatchProduct = {
  batchUrl: string;
  country: string;
  hostname: string;
  productName: string;
};

const blackListStrikeDictionary = {};
export class ApiClient {
  private guid: string;

  constructor(
    public apiUrl: string,
    private logger: Logger,
    private runOptions: CrawlerOptions,
    private crawler_version: number,
    private blacklist: CrawlerBlacklist
  ) {
    this.guid = uuidv4();
  }

  retrieveProductList = async (): Promise<Product[]> =>
    JSON.parse((await got(this.apiUrl + "public/productList.json")).body);

  retrieveNewProductList = async (): Promise<ApiProduct[]> =>
    JSON.parse((await got(this.apiUrl + "api/Sites/getProductList")).body);

  retrieveBatchList = async (): Promise<ApiBatchProduct[]> =>
    JSON.parse((await got(this.apiUrl + "api/Sites/getBatchList")).body);

  pingServer = async () => {
    this.logger.debug("ping [" + this.crawler_version + "]", this.guid);
    try {
      got.post(this.apiUrl + "api/Crawlers/ping", {
        json: {
          id: this.guid,
          configuration: this.runOptions,
          version: this.crawler_version,
        },
      });
    } catch (e) {
      this.logger.error("pingServer() ERROR", e);
    }
  };

  /**
   * notify the server of stock changes
   * @param parsedResults {object}
   * @param success {boolean} - if the update was a success (not becuase of an error, blacklist, etc.)
   * @param html {string} - if the server responds that this update caused a stock hit them upload the related html
   * @return Promise<response>
   */
  notifyServer = async (
    parsedResults: ParsedResults,
    success: boolean = false,
    html: string
  ) => {
    parsedResults.version = `${this.crawler_version}`;

    try {
      if (success && parsedResults.siteName)
        blackListStrikeDictionary[parsedResults.siteName] = 0;
      const gotResults = await got.post(
        this.apiUrl + "api/Sites/setAvailability",
        {
          json: parsedResults,
        }
      );
      const results = JSON.parse(gotResults.body);
      if (results && results.causedHit) {
        console.log("notifyServer() - CAUSED STOCK HIT");
        got.post(
          this.apiUrl +
            "api/ScraperStocks/" +
            results.causedHit +
            "/submitHtml",
          { json: { html } }
        );
      }
    } catch (e) {
      this.logger.error("notifyServer() ERROR", e);
    }
  };

  notifyServerOfError = async (scraperError: ScraperError) => {
    try {
      scraperError.crawlerId = this.guid;
      scraperError.crawlerVersion = this.crawler_version;
      got.post(this.apiUrl + "api/ScraperErrors", { json: scraperError });

      if (scraperError.hostname) {
        const host = scraperError.hostname;
        blackListStrikeDictionary[host] =
          (blackListStrikeDictionary[host] || 0) + 1;
        this.logger.info(
          `notifyServerOfError() - ${host} has ${blackListStrikeDictionary[host]} strikes`
        );
        if (blackListStrikeDictionary[host] >= 3) {
          this.blacklist.add(host);
        }
      }
    } catch (e) {
      this.logger.error("notifyServerOfError() ERROR", e);
    }
  };
}
