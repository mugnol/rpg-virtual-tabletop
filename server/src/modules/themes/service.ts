import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../db.js";
import { ApiError } from "../../middleware/errors.js";
import { validateThemeConfig, type ThemeConfig } from "./schema.js";

const THEME_NOT_FOUND = new ApiError(404, "THEME_NOT_FOUND", "Theme configuration not found");

export interface ThemeSummary {
  key: string;
  name: string;
  description: string;
  builtin: boolean;
}

const themesDataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/themes",
);

export function loadBuiltinThemes(): Array<{ raw: string; theme: ThemeConfig }> {
  try {
    const files = readdirSync(themesDataDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    return files.map((file) => {
      const raw = readFileSync(path.join(themesDataDir, file), "utf8");
      const parsed: unknown = JSON.parse(raw);
      const result = validateThemeConfig(parsed);
      if (!result.ok) {
        throw new Error(
          `Built-in theme ${file} failed schema validation: ${JSON.stringify(result.errors)}`,
        );
      }
      return { raw, theme: { ...result.theme, builtin: true } };
    });
  } catch (err) {
    console.error("[loadBuiltinThemes error]", err);
    return [];
  }
}

export async function seedBuiltinThemes(client: PrismaClient): Promise<void> {
  const entries = loadBuiltinThemes();
  for (const { raw, theme } of entries) {
    await client.themeConfig.upsert({
      where: { key: theme.key },
      update: {
        name: theme.name,
        description: theme.description ?? "",
        builtin: true,
        config: raw,
      },
      create: {
        key: theme.key,
        name: theme.name,
        description: theme.description ?? "",
        builtin: true,
        config: raw,
      },
    });
  }
}

export async function ensureThemesSeeded(): Promise<void> {
  const count = await prisma.themeConfig.count({ where: { builtin: true } });
  if (count < 2) {
    await seedBuiltinThemes(prisma);
  }
}

export async function listThemes(): Promise<ThemeSummary[]> {
  await ensureThemesSeeded();
  const rows = await prisma.themeConfig.findMany({
    select: {
      key: true,
      name: true,
      description: true,
      builtin: true,
    },
    orderBy: [{ builtin: "desc" }, { name: "asc" }],
  });
  return rows;
}

export async function getTheme(key: string): Promise<ThemeConfig> {
  await ensureThemesSeeded();
  const row = await prisma.themeConfig.findUnique({
    where: { key },
  });
  if (!row) {
    throw THEME_NOT_FOUND;
  }
  const parsed = JSON.parse(row.config) as ThemeConfig;
  return {
    ...parsed,
    builtin: row.builtin,
  };
}

export async function exportTheme(
  key: string,
): Promise<{ filename: string; raw: string }> {
  await ensureThemesSeeded();
  const row = await prisma.themeConfig.findUnique({
    where: { key },
  });
  if (!row) {
    throw THEME_NOT_FOUND;
  }
  return {
    filename: `${row.key}-theme.json`,
    raw: row.config,
  };
}

export async function importTheme(body: unknown): Promise<{ theme: ThemeConfig; created: boolean }> {
  await ensureThemesSeeded();
  const validation = validateThemeConfig(body);
  if (!validation.ok) {
    throw new ApiError(
      422,
      "INVALID_THEME_CONFIG",
      "Theme configuration failed validation",
      validation.errors,
    );
  }

  const { theme } = validation;

  if (theme.key === "medieval" || theme.key === "cyberpunk") {
    throw new ApiError(
      409,
      "BUILTIN_THEME_PROTECTED",
      "Built-in themes cannot be overwritten",
    );
  }

  const existing = await prisma.themeConfig.findUnique({
    where: { key: theme.key },
  });

  const rawConfig = `${JSON.stringify(theme, null, 2)}\n`;

  if (existing) {
    await prisma.themeConfig.update({
      where: { key: theme.key },
      data: {
        name: theme.name,
        description: theme.description ?? "",
        builtin: false,
        config: rawConfig,
      },
    });
    return { theme: { ...theme, builtin: false }, created: false };
  }

  await prisma.themeConfig.create({
    data: {
      key: theme.key,
      name: theme.name,
      description: theme.description ?? "",
      builtin: false,
      config: rawConfig,
    },
  });

  return { theme: { ...theme, builtin: false }, created: true };
}
