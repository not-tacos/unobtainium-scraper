// ================================================
// isInStock
// ================================================
export const genericIsInStockEnglish = (html) =>
  html &&
  html.toLowerCase().includes("in stock") &&
  !html.toLowerCase().includes("not in stock");
const genericIsInStockSpanish = (html) =>
  !(html && html.toLowerCase().includes("agotado"));
const siteIsInStockBhPhotoVideo = (html) =>
  html &&
  html.includes("addToCartButton") &&
  html.includes("addToCartSection") &&
  !html.includes("Notify When Available");
const siteIsInStockBestBuy = (html) =>
  html && html.includes('"availability":"http://schema.org/InStock"');
const siteIsInStockAmazon = (html) =>
  html &&
  html.includes("a-icon a-icon-cart") &&
  html.includes('<span class="tabular-buybox-text">Amazon.com</span>');
const siteIsInStockPlaystation = (html) =>
  html &&
  html.includes(
    "btn transparent-orange-button js-analyitics-tag add-to-cart"
  ) &&
  !html.includes(
    "btn transparent-orange-button js-analyitics-tag add-to-cart hide"
  );
const siteIsInStockTarget = (html) =>
  html &&
  !html.includes("Out of stock") &&
  (html.includes("Deliver it") || html.includes("shipItButton"));
const siteIsInStockAdorama = (html) =>
  html &&
  html.includes("button radius add-to-cart action highlight-dark") &&
  !html.includes("Pre-Order");
const siteIsInStockZotac = (html) =>
  html && html.includes("add-to-cart-buttons");
const siteIsInStockGamestop = (html) =>
  html && html.includes('"availability":"Available"');
const siteIsInStockEVGA = (html) =>
  html && html.includes('class="btnBigAddCart"');
const siteIsInStockNewegg = (html) => {
  if (!html) {
    return 0;
  }
  return (
    html &&
    html.includes("Add to cart") &&
    html.includes("Sold by: Newegg") &&
    !html.includes('<span class="message-title">Not available. </span>')
  );
};
export const containerIsInStockNewegg = (html) => {
  html &&
    html.includes('<button class="btn btn-primary btn-mini" title="Add') &&
    !html.includes('<span class="message-title">Not available. </span>') &&
    html.includes('class="shipped-by-newegg">Shipped by Newegg</a>');
};
const siteIsInStockWalmart = (html) =>
  html &&
  html.includes(
    "button prod-ProductCTA--primary prod-ProductCTA--server display-inline-block button--primary"
  );
const siteIsInStockSamsclub = (html) =>
  html && html.includes("Ship this item") && !html.includes("Out of stock");
const siteIsInStockMemoryExpress = (html) =>
  html &&
  html.includes("http://www.w3.org/2000/svg") &&
  !html.includes("backorder") &&
  !html.includes("Out of Stock");
const siteIsInStockCanadaComputers = (html) =>
  html &&
  html.includes("IN STOCK") &&
  !html.includes("Out of stock") &&
  html.includes("Order Online") &&
  !html.includes("Not Available Online");
const siteIsInStockOverclockers = (html) =>
  html &&
  !html.includes("PRE ORDER") &&
  html.includes(
    '<input type="submit" id="basketButton" class="sAddToBasketButton" title="'
  ) &&
  html.includes(' name="Add to basket" value="Add to basket" style="">') &&
  !html.includes("comingsoonDetails");
const siteIsInStockScan = (html) => html && html.includes("IN STOCK");
const siteIsInStockOfficedepot = (html) =>
  html && html.includes("productDetail_button_addToCart");
const siteIsInStockAMD = (html) =>
  html &&
  html.includes(" Add to cart ") &&
  !html.includes('class="product-out-of-stock"');

export const isInStockSiteDictionary = {
  "www.bhphotovideo.com": siteIsInStockBhPhotoVideo,
  "www.amazon.com": siteIsInStockAmazon,
  "www.amazon.ca": siteIsInStockAmazon,
  "www.amazon.co.uk": siteIsInStockAmazon,
  "amzn.to": siteIsInStockAmazon,
  "www.bestbuy.com": siteIsInStockBestBuy,
  "www.bestbuy.ca": siteIsInStockBestBuy,
  "direct.playstation.com": siteIsInStockPlaystation,
  "www.target.com": siteIsInStockTarget,
  "www.zotacstore.com": siteIsInStockZotac,
  "www.gamestop.com": siteIsInStockGamestop,
  "www.adorama.com": siteIsInStockAdorama,
  "www.evga.com": siteIsInStockEVGA,
  "www.newegg.com": siteIsInStockNewegg,
  "www.newegg.ca": siteIsInStockNewegg,
  "www.walmart.com": siteIsInStockWalmart,
  "www.samsclub.com": siteIsInStockSamsclub,
  "www.memoryexpress.com": siteIsInStockMemoryExpress,
  "www.canadacomputers.com": siteIsInStockCanadaComputers,
  "www.overclockers.co.uk": siteIsInStockOverclockers,
  "www.scan.co.uk": siteIsInStockScan,
  "www.officedepot.com": siteIsInStockOfficedepot,
  "www.amd.com": siteIsInStockAMD,
};

export const parseProductIsInStock = (logger, product, siteName, html) => {
  switch (product.country) {
    case "US":
    case "USA":
    case "UK":
    case "CAN":
    case "TEST":
    case "test":
      const siteSpecificIsInStockFunction = isInStockSiteDictionary[siteName];
      if (siteSpecificIsInStockFunction) {
        logger.debug(
          "parseProductIsInStock() - found specific site function: ",
          siteName
        );
        return siteSpecificIsInStockFunction(html);
      } else {
        logger.debug("parseProductIsInStock() - using generic: ", siteName);
        return genericIsInStockEnglish(html);
      }
    default:
      return genericIsInStockEnglish(html);
  }
};
