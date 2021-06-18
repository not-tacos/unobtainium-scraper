import { CrawlerBlacklist } from "./blacklist";
import { Logger } from "./types";

import _ from "lodash";

const nopLogger: Logger = {
  debug: _.noop,
  error: _.noop,
  info: _.noop,
  warn: _.noop,
};

describe("Blacklist", () => {
  it("has default expiration for unknown host", () => {
    const blackList = new CrawlerBlacklist([], nopLogger);
    const result = blackList.getExpiry("foo");
    expect(result).toBeGreaterThan(0);
  });
});
