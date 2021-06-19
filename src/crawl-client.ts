import got from "got";
import UserAgent from "user-agents";

export class CrawlClient {
  private userAgent: UserAgent;

  constructor() {
    this.userAgent = new UserAgent({ deviceCategory: "desktop" });
  }

  async get(url: string, timeout: number, agent?: string) {
    const html = await got(url, {
      timeout,
      headers: { "user-agent": agent || this.userAgent.toString() },
    });
    return html.body;
  }
}
