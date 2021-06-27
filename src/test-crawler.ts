import { startLocalApi } from "./local-backend-proxy";
import { crawlRepeatedly } from "./crawl-repeatedly";

const _ = require("dotenv").config();

(async () => {
  startLocalApi(3000);

  return crawlRepeatedly("dev", "http://localhost:3000/", {});
})();
