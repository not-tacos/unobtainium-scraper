import { Table } from "console-table-printer";
import _ from "lodash";
import { ApiBatchProduct, ApiProduct } from "../api-client";

type CommonRecord = ApiBatchProduct | (ApiProduct & { hostname: string });

export function tableByProduct(
  result: CommonRecord[],
  what: "Listings" | "Batches"
) {
  const grouped = _.groupBy(result, (r) => r.productName);
  const rows = Object.entries(grouped).map(([product, items]) => ({
    product,
    num: items.length,
    numHosts: new Set(items.map((i) => i.hostname)).size,
  }));
  const table = new Table({
    title: `${what} by Product`,
    columns: [
      { name: "product", alignment: "left", title: "Product" },
      { name: "num", title: what },
      { name: "numHosts", title: "Stores" },
    ],
    sort: (a, b) => a.product.localeCompare(b.product),
  });
  table.addRows(rows);
  return table;
}

export function tableByStore(
  result: CommonRecord[],
  what: "Listings" | "Batches"
) {
  const grouped = _.groupBy(result, (r) => r.hostname);
  const rows = Object.entries(grouped).map(([hostname, items]) => ({
    hostname,
    num: items.length,
    numProducts: new Set(items.map((i) => i.productName)).size,
  }));
  const table = new Table({
    title: `${what} by Store`,
    columns: [
      { name: "hostname", alignment: "left", title: "Store" },
      { name: "num", title: what },
      { name: "numProducts", title: "Products" },
    ],
    sort: (a, b) => a.hostname.localeCompare(b.hostname),
  });
  table.addRows(rows);
  return table;
}

export function printTables(table1: Table, table2: Table) {
  const t1 = table1.render().split("\n");
  const t2 = table2.render().split("\n");

  const t1EmptyRow = " ".repeat(t1[1].length);

  const together = _.zip(t1, t2).map(
    ([a, b]) => `${a || t1EmptyRow} ${b || ""}`
  );

  together.forEach((line) => console.log(line));
}
