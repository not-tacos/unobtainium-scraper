import got from "got";
export class ApiClient {
  constructor(private apiUrl: string) {}

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
}
