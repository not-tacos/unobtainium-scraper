# unobtainium-scraper
This repo contains the scraper code for the Unobtainium project stock alert bot. (https://unobtainium.app)


public/ is what gets published to the volunteers who run the scraper.

		unobtainiumCrawler.js
		
			obfuscated scraper code. this is what actually gets released to the scrapers.

		productList.json
		
			list of products, URLs, MSRPs, etc to be scraped.

		batchList.json
		
			Products that can be checked in batches because they are listed on the same page are grouped together here.


scripts/ is where development work happens. 

		unobtainiumCrawler.js 
			
			contains most of the code you'll be interested in. 
			
			probably needs to be split up into multiple files.

		The rest of the files in this folder are to help us in publishing releases or product list management.
		You can probably just ignore them.


Note that this repo will look drastically different over the next week or two as we finish preparing the code for public testing and contributions.
I've put this up now so people can get familiar with the code before we all start working on it.
