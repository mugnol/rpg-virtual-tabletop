#!/usr/bin/env node
const fs = require("node:fs");
const localtunnel = require("localtunnel");

const port = Number.parseInt(process.env.PORT, 10) || 3001;
const urlFile = process.env.URL_FILE || "public-url.txt";

(async () => {
  try {
    const tunnel = await localtunnel({ port });
    console.log(`[tunnel] Your public HTTPS URL is: ${tunnel.url}`);
    try {
      fs.writeFileSync(urlFile, `${tunnel.url}\n`);
    } catch (_) {}

    tunnel.on("close", () => {
      console.log("[tunnel] Tunnel connection closed.");
      process.exit(0);
    });

    tunnel.on("error", (err) => {
      console.error("[tunnel error]:", err.message);
    });

    const shutdown = () => {
      tunnel.close();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    console.error("[tunnel] Failed to establish tunnel:", err.message);
    process.exit(1);
  }
})();
