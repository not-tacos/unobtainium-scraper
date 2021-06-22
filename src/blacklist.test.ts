import { blackListHostDictionary, CrawlerBlacklist } from "./blacklist";
import { nopLogger } from "./logger";

describe("Blacklist", () => {
  it("has default expiration for unknown host", () => {
    const blackList = new CrawlerBlacklist([], nopLogger);
    expect(blackList.isBlacklisted("foo")).toBe(false);
    const result = blackList.getExpiry("foo");
    expect(result).toBeGreaterThan(0);
  });

  it("blacklists a host", () => {
    const blackList = new CrawlerBlacklist([], nopLogger);
    blackList.add("foo");
    expect(blackList.isBlacklisted("foo")).toBe(true);
  });

  it("expires a blacklisted host", () => {
    jest.useFakeTimers();
    const blackList = new CrawlerBlacklist([], nopLogger);
    blackList.add("foo");
    expect(blackList.isBlacklisted("foo")).toBe(true);

    // a minute later..
    jest.setSystemTime(Date.now() + 60 * 1000);
    blackList.process();

    expect(blackList.isBlacklisted("foo")).toBe(true);

    // much later
    jest.setSystemTime(
      Date.now() + blackListHostDictionary.default + 60 * 1000
    );
    blackList.process();

    expect(blackList.isBlacklisted("foo")).toBe(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});
