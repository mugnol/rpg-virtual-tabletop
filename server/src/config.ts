import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";
const isTest = nodeEnv === "test";

let jwtSecret = process.env.JWT_SECRET ?? "";
if (!jwtSecret) {
  if (isProd) {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  jwtSecret = "dev-only-insecure-secret";
  if (!isTest) {
    console.warn("[config] JWT_SECRET is not set; using the built-in development secret.");
  }
}

const cookieSecureEnv = process.env.COOKIE_SECURE?.trim().toLowerCase();
const cookieSecure = cookieSecureEnv === "true" || cookieSecureEnv === "1";

export const config = {
  nodeEnv,
  isProd,
  isTest,
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  jwtSecret,
  cookieName: "rpg_session",
  sessionTtlSeconds: 24 * 60 * 60,
  cookieSecure,
  // Resolved from both src/ (tsx dev) and dist/ (built) — both are one level below server/.
  clientDist: process.env.CLIENT_DIST ?? path.resolve(here, "../../client/dist"),
  avatarsDir: path.resolve(here, "../../client/public/avatars"),
} as const;
