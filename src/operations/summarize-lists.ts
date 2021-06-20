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

  const table1 = listingsByProduct(result);
  const table2 = listingsByStore(result);
  printTables(table2, table1);
}

function printTables(table1: Table, table2: Table) {
  const t1 = table1.render().split("\n");
  const t2 = table2.render().split("\n");

  const t1EmptyRow = " ".repeat(t1[1].length);

  const together = _.zip(t1, t2).map(
    ([a, b]) => `${a || t1EmptyRow} ${b || ""}`
  );

  together.forEach((line) => console.log(line));
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
      { name: "numHosts", title: "Stores" },
    ],
    sort: (a, b) => a.product.localeCompare(b.product),
  });
  table.addRows(rows);
  return table;
}

function listingsByStore(result: (ApiProduct & { hostname: string })[]) {
  const grouped = _.groupBy(result, (r) => r.hostname);
  const rows = Object.entries(grouped).map(([hostname, items]) => ({
    hostname,
    num: items.length,
    numProducts: new Set(items.map((i) => i.productName)).size,
  }));
  const table = new Table({
    title: "Listings by Store",
    columns: [
      { name: "hostname", alignment: "left", title: "Store" },
      { name: "num", title: "Listings" },
      { name: "numProducts", title: "Products" },
    ],
    sort: (a, b) => a.hostname.localeCompare(b.hostname),
  });
  table.addRows(rows);
  return table;
}
