import { parse } from "ts-command-line-args";
import { ApiClient } from "./api-client";
import { Logger } from "./types";
import _ from "lodash";
import { CrawlerBlacklist } from "./blacklist";

interface CLIArguments {
  summarizeLists?: boolean;
  help?: boolean;
}

export const args = parse<CLIArguments>(
  {
    help: {
      type: Boolean,
      optional: true,
      alias: "h",
      description: "Prints this usage guide",
    },
    summarizeLists: {
      type: Boolean,
      optional: true,
      description: "Summarizes current product lists.",
    },
  },
  {
    helpArg: "help",
    headerContentSections: [
      {
        header: "Unobtanium Crawler CLI",
        content: "Mostly for testing and development",
      },
    ],
  }
);

const cliLogger: Logger = console;

async function go() {
  if (args.summarizeLists) {
    const apiClient = new ApiClient(
      "https://unobtainium.app/",
      cliLogger,
      {},
      1,
      new CrawlerBlacklist([], cliLogger)
    );
    const result = await apiClient.retrieveNewProductList();
    const productNames = _.uniq(result.map((r) => r.productName)).sort();
    console.log(`Product list: ${result.length} items.`);
    console.log(`${productNames.length} products:`);
    productNames.forEach((name) => console.log(`  ${name}`));

    // todo:
    //  - counts for each product
    //  - batch items.
  }
}

go();
