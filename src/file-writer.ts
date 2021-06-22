import { CrawlerOptions } from "./options";

import fs from "fs";
import { Logger } from "./logger";

export class FileWriter {
  public logHtml: boolean;

  constructor(options: CrawlerOptions, readonly logger: Logger) {
    this.logHtml = !!options.logHtml;
  }

  public writeHtmlToFile = (fileName, html) => {
    if (this.logHtml == undefined || this.logHtml == false) {
      return true;
    }
    try {
      fs.writeFileSync(fileName + ".html", html);
    } catch (e) {
      this.logger.error("writeHtmlToFile() ERROR: ", e);
    }
  };
}
