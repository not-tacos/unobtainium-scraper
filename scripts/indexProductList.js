'use strict';

const productList = require('../public/productList.json');
const _ = require('lodash');
const indexObj = {};

const recordCount = Object.keys(productList).length;

const countries = _.map(productList, p => p.country);
const uniqCountries = _.uniq(countries);

let hosts = _.map(productList, product => (new URL(product.url).hostname));
const hostsWoDomain = _.sortBy(hosts.map(host => host.replace(/www\./g, '')));
const hostsBare = hostsWoDomain.map(host => host.split('\.')[0]);
const uniqHosts = _.uniq(hostsBare);

console.log('-----------------------------------');
console.log('Record Count: ', recordCount);
console.log('-----------------------------------');
console.log('Countries: ', uniqCountries.length, uniqCountries);
uniqCountries.forEach(c => {
  const amountForCountry = _.filter(countries, r => r === c).length;
  console.log('Country [' + c + ']: ', amountForCountry, ' - ', (Math.ceil((amountForCountry / recordCount) * 100)).toFixed(1) + '% of total');
});
console.log('-----------------------------------');
console.log('Host Count: ', uniqHosts.length, uniqHosts);
uniqHosts.forEach(h => {
  const amountForHost = _.filter(hostsBare, hb => hb === h).length;
  console.log('Host [' + h + ']: ', amountForHost, ' - ', (Math.ceil((amountForHost / recordCount) * 100)).toFixed(1) + '% of total');
});
console.log('-----------------------------------');
