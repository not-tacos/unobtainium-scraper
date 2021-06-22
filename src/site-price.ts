// ================================================
// price
// ================================================

import { Logger } from "./logger";
import { Product } from "./types";
import { parseNumberEN } from "./util";

const sitePriceBestBuy = (html) => {
  if (html) {
    let startString = "Your price for this item is $<!-- -->";
    let indexStart = parseInt(html.indexOf(startString));
    if (indexStart == -1) return -1;
    indexStart += startString.length;
    let indexEnd =
      indexStart + parseInt(html.substring(indexStart).indexOf("</span>"));
    if (indexEnd == -1) return -2;
    let price = parseNumberEN(html.substring(indexStart, indexEnd));
    return price;
  }
};

const sitePriceAmazon = (html) => {
  if (html) {
    let startString =
      '<span id="price_inside_buybox" class="a-size-medium a-color-price">';
    let indexStart = parseInt(html.indexOf(startString));
    if (indexStart == -1) return -1;
    indexStart += startString.length;
    let indexEnd =
      indexStart + parseInt(html.substring(indexStart).indexOf("</span>"));
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
    let indexEnd =
      indexStart + parseInt(html.substring(indexStart).indexOf("</strong>"));
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
    startString = "<strong>";
    if (indexStart == -1) return -2;
    indexStart = parseInt(html.indexOf(startString, indexStart)); // get to the specidic line with the price
    indexStart += startString.length;
    let indexEnd =
      indexStart + parseInt(html.substring(indexStart).indexOf("</strong>"));
    if (indexEnd == -1) return -3;
    let price = parseNumberEN(html.substring(indexStart, indexEnd));
    return price;
  }
};

const sitePriceWalmart = (html) => {
  if (html) {
    let startString =
      '<span class="price-characteristic" itemprop="price" content="';
    let indexStart = parseInt(html.indexOf(startString));
    if (indexStart == -1) return -1;
    indexStart += startString.length;
    let indexEnd =
      indexStart + parseInt(html.substring(indexStart).indexOf('">'));
    if (indexEnd == -1) return -2;
    let price = parseNumberEN(html.substring(indexStart, indexEnd));
    return price;
  }
};

const priceSiteDictionary = {
  "www.bestbuy.com": sitePriceBestBuy,
  "www.bestbuy.ca": sitePriceBestBuy,
  "www.newegg.com": sitePriceNewegg,
  "www.newegg.ca": sitePriceNewegg,
  "www.amazon.com": sitePriceAmazon,
  "www.amazon.ca": sitePriceAmazon,
  "www.overclockers.co.uk": sitePriceOverclockers,
  "www.walmart.com": sitePriceWalmart,
};

export const parseProductPrice = (
  logger: Logger,
  product: Product,
  siteName: string,
  html: string
) => {
  switch (product.country) {
    case "US":
    case "USA":
    case "UK":
    case "CAN":
    case "test":
      const siteSpecificPriceFunction = priceSiteDictionary[siteName];
      if (siteSpecificPriceFunction) {
        logger.debug(
          "parseProductPrice() - found specific site function: ",
          siteName
        );
        return siteSpecificPriceFunction(html);
      } else {
        logger.warn("No siteSpecificPriceFunction exists for domain.");
        return -1;
      }
  }
};
