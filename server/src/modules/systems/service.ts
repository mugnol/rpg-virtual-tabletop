import { prisma } from "../../db.js";
import { ApiError } from "../../middleware/errors.js";
import { validateSystemConfig, type SystemConfig } from "../../rules/schema.js";

const SYSTEM_NOT_FOUND = new ApiError(404, "NOT_FOUND", "System configuration not found");

export interface SystemSummary {
  key: string;
  version: string;
  name: string;
  attribution: string;
  builtin: boolean;
}

export async function listSystems(): Promise<SystemSummary[]> {
  const rows = await prisma.systemConfig.findMany({
    select: {
      key: true,
      version: true,
      name: true,
      attribution: true,
      builtin: true,
    },
    orderBy: [{ key: "asc" }, { version: "desc" }],
  });
  return rows;
}

async function findLatestRow(key: string) {
  const row = await prisma.systemConfig.findFirst({
    where: { key },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
  });
  if (!row) {
    throw SYSTEM_NOT_FOUND;
  }
  return row;
}

export async function getSystem(key: string): Promise<SystemConfig> {
  const row = await findLatestRow(key);
  const parsed: unknown = JSON.parse(row.config);
  const validated = validateSystemConfig(parsed);
  if (!validated.ok) {
    throw new ApiError(500, "INTERNAL_ERROR", `Stored config for ${key} is invalid`);
  }
  return validated.config;
}

export async function exportSystem(
  key: string,
): Promise<{ filename: string; raw: string }> {
  const row = await findLatestRow(key);
  return {
    filename: `${row.key}-${row.version}.json`,
    raw: row.config,
  };
}

export async function importSystem(body: unknown): Promise<SystemConfig> {
  const validation = validateSystemConfig(body);
  if (!validation.ok) {
    throw new ApiError(
      422,
      "INVALID_SYSTEM_CONFIG",
      "System configuration failed validation",
      validation.errors,
    );
  }
  const { config } = validation;

  const existing = await prisma.systemConfig.findUnique({
    where: {
      key_version: {
        key: config.key,
        version: config.version,
      },
    },
  });
  if (existing) {
    throw new ApiError(
      409,
      "SYSTEM_EXISTS",
      "This system and version are already installed",
    );
  }

  await prisma.systemConfig.create({
    data: {
      key: config.key,
      version: config.version,
      name: config.name,
      attribution: config.attribution,
      builtin: false,
      config: `${JSON.stringify(config, null, 2)}\n`,
    },
  });

  return config;
}

export async function assertKnownCampaignSystem(systemKey: string): Promise<void> {
  if (systemKey === "generic") {
    return;
  }
  const found = await prisma.systemConfig.findFirst({
    where: { key: systemKey },
    select: { key: true },
  });
  if (!found) {
    throw new ApiError(400, "UNKNOWN_SYSTEM", `Unknown system: ${systemKey}`);
  }
}
