import { CrawlerOptions } from "./options";

import fs from "fs";
import { Logger } from "./logger";

export class FileWriter {
  constructor(readonly options: CrawlerOptions, readonly logger: Logger) {}
  public writeHtmlToFile = (fileName, html) => {
    if (this.options.logHtml == undefined || this.options.logHtml == false) {
      return true;
    }
    try {
      fs.writeFileSync(fileName + ".html", html);
    } catch (e) {
      this.logger.error("writeHtmlToFile() ERROR: ", e);
    }
  };
}
