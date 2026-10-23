import cookieParser from "cookie-parser";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { apiNotFound, errorHandler } from "./middleware/errors.js";
import { authRouter } from "./modules/auth/routes.js";
import { campaignsRouter } from "./modules/campaigns/routes.js";
import { mapsRouter, tokensRouter } from "./modules/maps/routes.js";
import { monstersRouter } from "./modules/monsters/routes.js";
import { sessionsRouter } from "./modules/sessions/routes.js";
import { sheetsRouter } from "./modules/sheets/routes.js";
import { systemsRouter } from "./modules/systems/routes.js";
import { themesRouter } from "./modules/themes/routes.js";
import { usersRouter } from "./modules/users/routes.js";

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/themes", themesRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/systems", systemsRouter);
  app.use("/api/sheets", sheetsRouter);
  app.use("/api/monsters", monstersRouter);
  app.use("/api/sessions", sessionsRouter);
  app.use("/api/maps", mapsRouter);
  app.use("/api/tokens", tokensRouter);
  app.use("/api", apiNotFound);

  // In production (and E2E) the server serves the built client; in dev the
  // Vite dev server proxies /api here instead and this block is skipped.
  if (existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(config.clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

export const app = createApp();
