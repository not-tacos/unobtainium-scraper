import _ from "lodash";
import cheerio from "cheerio";
import { firstUrlSegment } from "./util";
import {
  containerIsInStockNewegg,
  genericIsInStockEnglish,
} from "./is-in-stock";

const batchIsInStockNewegg = (logger, fileWriter, html, url) => {
  // First check to see if the check Url exists on the page at all
  // assuming that the index page has the whole url for the product somewhere on the page
  // may have to use a different means of finding products on different index pages
  const isIncludedInHtml = html.includes(url);
  if (!isIncludedInHtml) return false;

  // Load the html string into cheerio and query all <a> tags so that we can look for the container that will forward
  // the user to the specific product page
  const $ = cheerio.load(html);
  const aTags = $("body").find("a").toArray();

  // Look through all the <a> tags and find the first one that matches our check url
  const relatedTags = _.filter(aTags, (t) => $(t).attr("href") === url);

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

    // On the newegg index page we have the benefit of them using the same images/buttons to denot if a product is in
    // stock so we can just sent the mini-container we parsed direct to the host specific parser
    return containerIsInStockNewegg(newBody);
  } catch (e) {
    logger.info("batchIsInStockNewegg() cant parse tags");
    return false;
  }
};

const batchIsInStockEVGA = (logger, fileWriter, html, url) => {
  // First check to see if the check Url exists on the page at all
  // assuming that the index page has the whole url for the product somewhere on the page
  // may have to use a different means of finding products on different index pages
  const isIncludedInHtml = html.includes(url);
  if (!isIncludedInHtml) return false;

  // Load the html string into cheerio and query all <a> tags so that we can look for the container that will forward
  // the user to the specific product page
  const $ = cheerio.load(html);
  const aTags = $("body").find("a").toArray();

  // EVGA doesn't contain our check url but it does have the product number (pn) of each product in the container
  // so we can use some regexp and string manipulation to grab it from the url and search for it in the index page
  const pn = url.match(/(pn=).*(?=&)/g).split("=")[1];

  // Look through all the <a> tags and find the first one that contains the pn we parsed from our check url
  const relatedTags = _.filter(aTags, (t) => $(t).attr("href").includes(pn));

  try {
    // TODO: once we have the tag for the pn above, we need to loop through each tags parent till we get the container
    // that holds the stock information.  Once we have that as long as EVGA like newegg uses the same buttons/classes
    // etc to denote wether a product is in stock we can send the container as a string through to the
    // siteIsInStockEVGA parser
    // return siteIsInStockEVGA(newBody);
  } catch (e) {
    logger.info("batchIsInStockEVGA() cant parse tags");
    return false;
  }
};

const batchIsInStockBestBuy = (logger, fileWriter, html, url) => {
  const $ = cheerio.load(html);

  // Get the shop-sku-list container that contains the product list items
  const shopList = $(".shop-sku-list").toArray();

  if (!shopList || !shopList.length) {
    logger.warn(
      "batchIsInStockBestBuy() - ERROR CheckUrl not found in BatchUrl: ",
      url
    );
    return false;
  }

  // Find all of the list items inside the shop-sku-list
  const listItems = $(shopList).find("li").toArray();

  // none of the items include the url so we need to get the product # out of
  // the url and use it to find the list item we're looking for
  const splitUrl = url.split("/");
  const productNumber = splitUrl[splitUrl.length - 1].split(".p")[0];

  // find the list item that contains the sku (productNumber) we're looking for
  const relatedTags = _.filter(
    listItems,
    (t) => $(t).attr("data-sku-id") === productNumber
  );

  if (!relatedTags || !relatedTags.length) {
    logger.error(
      "batchIsInStockBestBuy() - ERROR CheckUrl not found in BatchUrl: ",
      url
    );
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

    return newBody.includes("Add to Cart");
  } catch (e) {
    logger.info("batchIsInStockBestBuy() cant parse tags");
    return false;
  }
};

const isInStockBatchDictionary = {
  "www.newegg.com": batchIsInStockNewegg,
  "www.evga.com": batchIsInStockEVGA,
  "www.bestbuy.com": batchIsInStockBestBuy,
};

export const parseBatchProductIsInStock = (
  logger,
  fileWriter,
  product,
  siteName,
  html
) => {
  try {
    product.url = product.url.replace(/\?$/g, "");
  } catch (e) {
    logger.warn("error formatting url: ", product.url);
  }
  switch (product.country) {
    case "US":
    case "USA":
    case "UK":
    case "CAN":
    case "TEST":
    case "test":
      const siteSpecificIsInStockFunction = isInStockBatchDictionary[siteName];
      if (siteSpecificIsInStockFunction) {
        logger.debug(
          "parseBatchProductIsInStock() - found specific site function: ",
          siteName
        );
        return siteSpecificIsInStockFunction(
          logger,
          fileWriter,
          html,
          product.url
        );
      } else {
        logger.debug(
          "parseBatchProductIsInStock() - using generic: ",
          siteName
        );
        return genericIsInStockEnglish(html);
      }
    default:
      return genericIsInStockEnglish(html);
  }
};
