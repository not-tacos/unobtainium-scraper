import { parse } from "ts-command-line-args";

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

function go() {
  console.log("Received arguments", args);
}

go();
