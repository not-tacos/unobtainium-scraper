# unobtainium-scraper
This repo contains the scraper code for the Unobtainium project stock alert bot. (https://unobtainium.app)


public/ is what gets published to the volunteers who run the scraper.

		It contains the obfuscated scraper code in unobtainiumCrawler.js

		The list of products scanned is in productList.json

		Products that can be scraped in batches are grouped as such in batchList.json


scripts/ is where development work happens. 

		unobtainiumCrawler.js contains most of the code you'll be interested in. 

		The rest of the files in this folder are to help us in publishing releases or product list management.
