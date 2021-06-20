import { ApiClient, ApiProduct } from "../api-client";
import { CrawlerBlacklist } from "../blacklist";
import _ from "lodash";
import { Table, printTable } from "console-table-printer";

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

  listingsByProduct(result);
}

function listingsByProduct(result: (ApiProduct & { hostname: string })[]) {
  const grouped = _.groupBy(result, (r) => r.productName);
  const rows = Object.entries(grouped).map(([product, items]) => ({
    product,
    num: items.length,
    numHosts: new Set(items.map((i) => i.hostname)).size,
  }));
  const table = new Table({
    title: "Listings by Product",
    columns: [
      { name: "product", alignment: "left", title: "Product" },
      { name: "num", title: "Listings" },
    ],
    sort: (a, b) => a.product.localeCompare(b.product),
  });
  table.addRows(rows);
  table.printTable();
}
// new URL(product.url).hostname
