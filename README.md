[![Build](https://github.com/not-tacos/unobtainium-scraper/actions/workflows/build.yml/badge.svg)](https://github.com/not-tacos/unobtainium-scraper/actions/workflows/build.yml)

# unobtainium-scraper

This repo contains the scraper code for the Unobtainium project stock alert bot. (https://unobtainium.app)

## File Structure

src/ is where development work happens.

There are a few main entry points:

- `unobtanium-crawler.ts` - the default export is meant to be consumed by an [external project](https://github.com/BCDel89/unobtainium-nodejs-scraper). When compiled with `npm run bundle`, a single .js file from this is produced at `dist/scripts/unobtainiumCrawler.js`.
- `test-crawler.ts` - this sets up a few local express endpoints and runs the crawler. It consumes `unobtanium-crawler.ts` above.
- `cli.ts` - exposes various operations behind a command-line interface

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
~/r/unobtainium-scraper (cli)> npm run cli -- --help

> unobtainium-scraper@1.0.0 cli /Users/jrr/repos/unobtainium-scraper
> node dist/src/cli.js "--help"


Unobtanium Crawler CLI

  Mostly for testing and development.

  When invoking via 'npm run', add your options after a '--' like this:

  npm run cli -- --summarize-lists

Options

  -h, --help             Prints this usage guide
  --summarize-lists      Summarizes current product lists.
  --summarize-batches    Summarizes current product batch lists.
  --crawl                Starts the crawler. (pipe its output through bunyan)

```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

See [License.md].

[license.md]: https://github.com/not-tacos/unobtainium-scraper/blob/main/LICENSE
