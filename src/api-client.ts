import got from "got";
import { Logger } from "./types";
export class ApiClient {
  constructor(
    private apiUrl: string,
    private logger: Logger,
    private guid: string,
    private runOptions,
    private crawler_version
  ) {}

  /**
   * retrive the product list from the server
   * @return JSON list of Products
   */
  retrieveProductList = async () =>
    JSON.parse((await got(this.apiUrl + "public/productList.json")).body);
  retrieveNewProductList = async () =>
    JSON.parse((await got(this.apiUrl + "api/Sites/getProductList")).body);
  retrieveBatchList = async () =>
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
}
