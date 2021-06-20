import { ApiClient } from "../api-client";
import { CrawlerBlacklist } from "../blacklist";
import { tableByProduct, tableByStore, printTables } from "./summary-tables";

export async function summarizeBatches() {
  const apiClient = new ApiClient(
    "https://unobtainium.app/",
    console,
    {},
    1,
    new CrawlerBlacklist([], console)
  );

  const result = await apiClient.retrieveBatchList();
  const remaining = result.filter((r) => r.batchUrl != "");

  console.log(`Excluded ${result.length - remaining.length} empty batchUrls.`);

  const table1 = tableByProduct(result, "Batches");
  const table2 = tableByStore(result, "Batches");
  printTables(table2, table1);
}
