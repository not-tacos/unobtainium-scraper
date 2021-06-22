import { parse } from "ts-command-line-args";
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
  },
  true,
  true
);

async function go() {
  if (process.argv.length <= 2) {
    args._commandLineResults.printHelp();
  }

  if (args.summarizeLists) {
    await summarizeLists();
  }
  if (args.summarizeBatches) {
    await summarizeBatches();
  }
}

go();
