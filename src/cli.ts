import { parse } from "ts-command-line-args";
import { ApiClient } from "./api-client";
import { Logger } from "./types";
import _ from "lodash";
import { CrawlerBlacklist } from "./blacklist";
import { summarizeLists } from "./operations/summarize-lists";

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

async function go() {
  if (args.summarizeLists) {
    await summarizeLists();

    // todo:
    //  - counts for each product
    //  - batch items.
  }
}

go();
