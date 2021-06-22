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
const isThirdPartyAmazon = (html) =>
  html && !html.includes('<span class="tabular-buybox-tex">Amazon.com</span>');
const isThirdPartyNewegg = (html) =>
  (html && !html.includes("Sold by: Newegg")) ||
  html.includes("Ships from China.") ||
  html.includes("Ships from Hong Kong.");
const isThirdPartyWalmart = (html) =>
  html &&
  !html.includes(
    "https://help.walmart.com/article/shipping-and-delivery-with-walmart-com/0fa824faeca24e599e0e5292a7185336"
  );

const isThirdPartySiteDictionary = {
  "www.amazon.com": isThirdPartyAmazon,
  "amzn.to": isThirdPartyAmazon,
  "www.newegg.com": isThirdPartyNewegg,
  "www.newegg.ca": isThirdPartyNewegg,
  "www.walmart.com": isThirdPartyWalmart,
};

export const parseProductIsThirdParty = (product, siteName, html) => {
  switch (product.country) {
    case "US":
    case "USA":
    case "UK":
    case "CAN":
      const siteSpecificIsThirdPartyFunction =
        isThirdPartySiteDictionary[siteName];
      if (siteSpecificIsThirdPartyFunction) {
        return siteSpecificIsThirdPartyFunction(html);
      } else {
        return genericIsThirdPartyEnglish(html);
      }
    default:
      return genericIsThirdPartyEnglish(html);
  }
};
