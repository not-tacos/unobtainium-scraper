import { ApiClient } from "../api-client";
import { CrawlerBlacklist } from "../blacklist";
import { tableByProduct, tableByStore, printTables } from "./summary-tables";

export async function summarizeLists() {
  const apiClient = new ApiClient(
    "https://unobtainium.app/",
    console,
    {},
    1,
    new CrawlerBlacklist([], console)
  );

  const result = (await apiClient.retrieveNewProductList()).map((p) => ({
    ...p,
    hostname: new URL(p.url).hostname,
  }));

  const table1 = tableByProduct(result, "Listings");
  const table2 = tableByStore(result, "Listings");
  printTables(table2, table1);
}
