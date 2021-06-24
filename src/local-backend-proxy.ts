"use strict";
import express from "express";

export function startApi(port: number) {
  const app = express();
  app.get("/api/Sites/getProductList", async (req, res) =>
    res.redirect(301, "https://unobtainium.app/api/Sites/getProductList")
  );
  app.get("/api/Sites/getBatchList", async (req, res) =>
    res.redirect(301, "https://unobtainium.app/api/Sites/getBatchList")
  );
  app.use("/*", (req, res) => res.send({}));
  return app.listen(port);
}
