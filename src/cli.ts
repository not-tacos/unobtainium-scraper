import { ArgumentConfig, parse, ParseOptions } from "ts-command-line-args";
import { ApiClient } from "./api-client";
import { Logger } from "./types";
import _ from "lodash";
import { CrawlerBlacklist } from "./blacklist";
import { summarizeLists } from "./cli-operations/summarize-lists";
import { summarizeBatches } from "./cli-operations/summarize-batches";
import commandLineUsage from "command-line-usage";

interface CLIArguments {
  summarizeLists?: boolean;
  summarizeBatches?: boolean;
  help?: boolean;
}

const args = parse<CLIArguments>(
  {
    help: {
      type: Boolean,
      optional: true,
      alias: "h",
      description: "Prints this usage guide",
      defaultValue: process.argv.length <= 2, // show help when the user supplies no args
    },
    summarizeLists: {
      type: Boolean,
      optional: true,
      description: "Summarizes current product lists.",
    },
    summarizeBatches: {
      type: Boolean,
      optional: true,
      description: "Summarizes current product batch lists.",
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
  }
  if (args.summarizeBatches) {
    await summarizeBatches();
  }
}

go();
