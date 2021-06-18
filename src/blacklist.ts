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
  private _items: BlackListItem[];
  private _logger: Logger;

  constructor(items: BlackListItem[], logger: Logger) {
    this._items = items;
    this._logger = logger;
  }

  getExpiry(hostname: string) {
    const expiry =
      blackListHostDictionary[hostname] || blackListHostDictionary["default"];
    this._logger.debug("blackList.getExpiry()", expiry);
    return expiry;
  }

  isBlacklisted(hostname: string) {
    const foundHost = !!_.find(
      this._items,
      (item) => item.hostname.toLowerCase() === hostname.toLowerCase()
    );
    this._logger.debug("blackList.isBlacklisted()", foundHost);
    return foundHost;
  }

  add(hostname: string) {
    const blackListRecord = {
      hostname,
      expiry: new Date().getTime() + this.getExpiry(hostname),
    };
    this._items.push(blackListRecord);
    this._logger.debug("blackList.add()", blackListRecord);
    this._logger.warn("BLACKLISTING", hostname);
    return blackListRecord;
  }

  process() {
    const filteredList = _.filter(
      this._items,
      (item) => new Date().getTime() < item.expiry
    );
    this._logger.debug("blackList.process() ", this._items, filteredList);
    this._items = filteredList;
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
