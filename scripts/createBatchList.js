'use strict';

const productList = require('../public/productList.json');
const _ = require('lodash');
const batchArr = [];

const uniqProducts = _.uniq(productList.map(p => p.productName));
uniqProducts.forEach(up => {
  const sitesForProduct = _.filter(productList, p => up === p.productName);
  const languagesForSites = _.uniq(sitesForProduct.map(s => s.country));

  languagesForSites.forEach(l => {
    const sitesForProductLanguageUrls = _.filter(sitesForProduct, s => l === s.country).map(s => s.url);
    const hostNames = _.uniq(sitesForProductLanguageUrls.map(s => new URL(s).hostname));

    hostNames.forEach(h => {
      batchArr.push({
        productName: up,
        country: l,
        hostname: h,
        batchUrl: '',
        checkUrls: _.filter(sitesForProductLanguageUrls, url => h === new URL(url).hostname),
      });
    });
  });
});

console.log(JSON.stringify(batchArr));
