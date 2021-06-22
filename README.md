[![Build](https://github.com/not-tacos/unobtainium-scraper/actions/workflows/build.yml/badge.svg)](https://github.com/not-tacos/unobtainium-scraper/actions/workflows/build.yml)

# unobtainium-scraper

This repo contains the scraper code for the Unobtainium project stock alert bot. (https://unobtainium.app)

## File Structure

scripts/ is where development work happens.

    	unobtainiumCrawler.js

    		contains most of the code you'll be interested in.

## Getting Started

Synchronize your node environment

```bash
$ nvm use
```

Install node dependencies

```bash
$ npm install
```

Build the crawler code

```bash
$ npm run build
```

Start the crawler code

```bash
$ npm start
```

## CLI

There is a work-in-progress CLI interface available via `npm run cli`:

```
~/r/unobtainium-scraper (cli)> npm run cli

> unobtainium-scraper@1.0.0 cli /Users/jrr/repos/unobtainium-scraper
> node dist/src/cli.js


Unobtanium Crawler CLI

  Mostly for testing and development

Options

  -h, --help             Prints this usage guide
  --summarize-lists      Summarizes current product lists.
  --summarize-batches    Summarizes current product batch lists.
  --crawl-once           Starts the crawler. (pipe its output through bunyan)
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

See [License.md].

[license.md]: https://github.com/not-tacos/unobtainium-scraper/blob/main/LICENSE
