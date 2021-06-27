import { HostTimeouts, userAgentDictionary } from "./sites";
import { parseProductIsInStock } from "./is-in-stock";
import { parseProductIsThirdParty } from "./is-third-party";
import { parseProductPrice } from "./site-price";

/**
 * builds the parser that will query the product url and return an object of related product info
 * @param product {Product}
 * @return async () => ProductInfo
 */
export const buildParser = (
  blackList,
  apiClient,
  crawlClient,
  logger,
  fileWriter,
  product,
  siteName
) => {
  return async function (retry = 0) {
    try {
      if (!product.url)
        throw "ProductParser() - ERROR Invalid Product URL: " + product.url;
      if (!product.productName)
        throw (
          "ProductParser() - ERROR Invalid Product Name: " + product.productName
        );
      if (blackList.isBlacklisted(siteName)) {
        const updateInfo = {
          productName: product.productName,
          url: product.url,
          country: product.country,
          renderTime: new Date().getTime(),
        };

        apiClient.notifyServer(updateInfo);
        return logger.warn(
          "ProductParser() - TEMPORARILY BLACKLISTED: " +
            siteName +
            "-" +
            product.productName
        );
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
      let isInStock = parseProductIsInStock(logger, product, siteName, body);
      let stock = isInStock ? 1 : 0; // TODO: implement parsers for actual stock #
      const isThirdParty = parseProductIsThirdParty(product, siteName, body);
      const price = parseProductPrice(logger, product, siteName, body);

      fileWriter.writeHtmlToFile(`${siteName}-${productName}`, body);

      const productInfo = {
        productName,
        url,
        isInStock,
        stock,
        isThirdParty,
        price,
        siteName,
        country,
        renderTime,
      };
      logger.debug(
        "ProductParser() - parsedInfo: ",
        stock ? productInfo.stock : "NO STOCK",
        "-",
        productInfo.productName,
        " - ",
        product.url
      );

      if (country == "test" && !stock) {
        logger.warn(
          "test product not found in stock (should probably not happen)"
        );
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

      if (e.code && e.code === "ETIMEDOUT") {
        logger.warn("TIMEOUT ERROR: ", siteName, product);
      } else if (e.name === "HTTPError") {
        const code = parseInt(e.toString().match(/[0-9]{3}/g));

        if (code === 404)
          logger.warn(
            "404 FILE NOT FOUND ERROR:",
            siteName,
            " - ",
            product.productName,
            " - ",
            product.url
          );
        if (code === 403)
          logger.warn(
            "403 FORBIDDEN ERROR:",
            siteName,
            " - ",
            product.productName,
            " - ",
            product.url
          );
        if (code === 503) {
          logger.warn(
            "503 TEMPORARILY UNAVAILABLE ERROR:",
            siteName,
            " - ",
            product.productName,
            " - ",
            product.url
          );
          // TODO: retries are too damn slow we should skip for now
          // if (retry > 0) return false;
          // await delay(6000);
          // retry = retry + 1;
          // return buildParser(product, siteName, retry)();
        }
      } else {
        logger.error(
          "ProductParser() - unknown ERROR:",
          product,
          typeof e,
          e.name,
          e.statusCode,
          Object.keys(e),
          e,
          e.toString()
        );
      }

      return false;
    }
  };
};
