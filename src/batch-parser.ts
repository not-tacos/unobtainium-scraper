import _ from "lodash";
import { HostTimeouts, userAgentDictionary } from "../scripts/sites";
import { parseBatchProductIsInStock } from "./batch-in-stock";
import { parseBatchProductPrice } from "./batch-price";

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
export const buildBatchParser = (
  logger,
  blackList,
  apiClient,
  crawlClient,
  fileWriter,
  productList,
  batch
) => {
  return async function (retry = 0) {
    try {
      logger.info(
        "BuildBatchParser() starting new batch [" +
          batch.productName +
          "][" +
          batch.hostname +
          "]"
      );
      if (!batch.batchUrl)
        return logger.error(
          "BatchParser() - ERROR Invalid Batch URL: " + batch.batchUrl
        );
      if (!batch.productName)
        return logger.error(
          "BatchParser() - ERROR Invalid Batch Name: " + batch.productName
        );
      if (!batch.hostname)
        return logger.error(
          "BatchParser() - ERROR Invalid Host Name: " + batch.hostname
        );
      if (!batch.country)
        return logger.error(
          "BatchParser() - ERROR Invalid country: " + batch.country
        );
      if (!batch.checkUrls || !batch.checkUrls.length)
        return logger.error(
          "BatchParser() - No Check Urls",
          batch.productName,
          batch.country,
          batch.hostname,
          batch.checkUrls
        );
      if (blackList.isBlacklisted(batch.hostname)) {
        // NOTE: taking this out could cause stats to go stale
        const updateInfo = {
          productName: batch.productName,
          url: batch.url,
          country: batch.country,
          renderTime: new Date().getTime(),
        };
        apiClient.notifyServer(updateInfo);
        return logger.warn(
          "BatchParser() - TEMPORARILY BLACKLISTED: " +
            batch.hostname +
            "-" +
            batch.productName
        );
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

      fileWriter.writeHtmlToFile(
        `batch-${hostname}-${country}-${productName}`,
        body
      );

      batch.checkUrls.forEach((url) => {
        const product = _.find(productList, (site) => url.includes(site.url));
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

          const price =
            parseBatchProductPrice(
              logger,
              fileWriter,
              product,
              hostname,
              body
            ) || -1;

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

          const productStr =
            "BatchParser() [ " +
            productName.padEnd(9) +
            " ][ " +
            hostname.padEnd(16) +
            " ][ " +
            (stock ? "-=STOCK=-" : "no stock") +
            " ][ " +
            (price != -1 ? price.toString().padEnd(8) : "No Price") +
            " ][ " +
            (url ? url.padEnd(200) : "n/a") +
            " ][ " +
            (batch.batchUrl ? batch.batchUrl.padEnd(200) : "n/a") +
            " ]";

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

          if (e.code && e.code === "ETIMEDOUT") {
            logger.warn("TIMEOUT ERROR: ", hostname, product);
          } else if (e.name === "HTTPError") {
            const code = parseInt(e.toString().match(/[0-9]{3}/g));

            if (code === 404)
              logger.warn(
                "404 FILE NOT FOUND ERROR:",
                hostname,
                " - ",
                productName,
                " - ",
                url
              );
            if (code === 403)
              logger.warn(
                "403 FORBIDDEN ERROR:",
                hostname,
                " - ",
                productName,
                " - ",
                url
              );
            if (code === 503) {
              logger.warn(
                "503 TEMPORARILY UNAVAILABLE ERROR:",
                hostname,
                " - ",
                productName,
                " - ",
                url
              );
              // TODO: retries are too damn slow we should skip for now
              // if (retry > 0) return false;
              // await delay(6000);
              // retry = retry + 1;
              // return buildParser(product, siteName, retry)();
            }
          } else {
            logger.warn(
              "BatchParser() - unknown ERROR:",
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
      });
    } catch (e) {
      logger.warn("BatchParser() - Batch ERROR: ", e, batch);
    }
  };
};
