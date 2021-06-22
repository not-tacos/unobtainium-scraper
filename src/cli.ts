import { parse } from "ts-command-line-args";
import { crawlOnce } from "./cli-operations/crawl-once";

import { summarizeBatches } from "./cli-operations/summarize-batches";
import { summarizeLists } from "./cli-operations/summarize-lists";

const args = parse(
  {
    help: {
      type: Boolean,
      optional: true,
      alias: "h",
      description: "Prints this usage guide",
    },
    "summarize-lists": {
      type: Boolean,
      optional: true,
      description: "Summarizes current product lists.",
    },
    "summarize-batches": {
      type: Boolean,
      optional: true,
      description: "Summarizes current product batch lists.",
    },
    "crawl-once": {
      type: Boolean,
      optional: true,
      description: "Starts the crawler. (pipe its output through bunyan)",
    },
  },
  {
    helpArg: "help",
    headerContentSections: [
      {
        header: "Unobtanium Crawler CLI",
        content:
          "Mostly for testing and development.\n\nWhen invoking via 'npm run', add your options after a '--' like this:\n\nnpm run cli -- --summarize-lists",
      },
    ],
  },
  true,
  true
);

async function go() {
  if (process.argv.length <= 2) {
    args._commandLineResults.printHelp();
  }

  if (args["summarize-lists"]) {
    await summarizeLists();
  }
  if (args["summarize-batches"]) {
    await summarizeBatches();
  }
  if (args["crawl-once"]) {
    await crawlOnce();
  }
}

go();
