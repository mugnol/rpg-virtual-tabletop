import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { validateSystemConfig, type SystemConfig } from "./schema.js";

export interface BuiltinSystemEntry {
  raw: string;
  config: SystemConfig;
}

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data/systems");

/**
 * Loads and validates every built-in system JSON file under server/data/systems/.
 * Preserves the exact raw JSON text so export returns byte-identical content (UC-15).
 */
export function loadBuiltinSystems(): BuiltinSystemEntry[] {
  const files = readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((file) => {
    const raw = readFileSync(path.join(dataDir, file), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const result = validateSystemConfig(parsed);
    if (!result.ok) {
      throw new Error(
        `Built-in system ${file} failed schema validation: ${JSON.stringify(result.errors)}`,
      );
    }
    return { raw, config: result.config };
  });
}

/**
 * Idempotently upserts all built-in systems into the SystemConfig table (BR-13).
 */
export async function seedBuiltinSystems(prisma: PrismaClient): Promise<void> {
  const entries = loadBuiltinSystems();
  for (const { raw, config } of entries) {
    await prisma.systemConfig.upsert({
      where: {
        key_version: {
          key: config.key,
          version: config.version,
        },
      },
      update: {
        name: config.name,
        attribution: config.attribution,
        builtin: true,
        config: raw,
      },
      create: {
        key: config.key,
        version: config.version,
        name: config.name,
        attribution: config.attribution,
        builtin: true,
        config: raw,
      },
    });
  }
}
