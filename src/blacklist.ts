import { Logger } from "./types";
import _ from "lodash";

export type BlackListItem = {
  hostname: string;
  /** the amount of time to expire the blacklist record */
  expiry: number;
};

export const blackListHostDictionary = {
  default: 8 * 60 * 60 * 1000 + 1000 * 60, // 8 hours and 1 minute in ms
  // default: (1000 * 30), // TESTING: 30 seconds
};

export class CrawlerBlacklist {
  constructor(private items: BlackListItem[], private logger: Logger) {}

  getExpiry(hostname: string) {
    const expiry =
      blackListHostDictionary[hostname] || blackListHostDictionary["default"];
    this.logger.debug("blackList.getExpiry()", expiry);
    return expiry;
  }

  isBlacklisted(hostname: string) {
    const foundHost = !!_.find(
      this.items,
      (item) => item.hostname.toLowerCase() === hostname.toLowerCase()
    );
    this.logger.debug("blackList.isBlacklisted()", foundHost);
    return foundHost;
  }

  add(hostname: string) {
    const blackListRecord = {
      hostname,
      expiry: new Date().getTime() + this.getExpiry(hostname),
    };
    this.items.push(blackListRecord);
    this.logger.debug("blackList.add()", blackListRecord);
    this.logger.warn("BLACKLISTING", hostname);
    return blackListRecord;
  }

  process() {
    const filteredList = _.filter(
      this.items,
      (item) => new Date().getTime() < item.expiry
    );
    this.logger.debug("blackList.process() ", this.items, filteredList);
    this.items = filteredList;
    return this;
  }
}

export const createCrawlerBlackList = (
  list: CrawlerBlacklist | BlackListItem[],
  logger: Logger
): CrawlerBlacklist => {
  const theBlackList =
    list instanceof CrawlerBlacklist
      ? list
      : new CrawlerBlacklist(list, logger);
  return theBlackList.process();
};
