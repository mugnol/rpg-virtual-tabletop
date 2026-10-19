import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { ApiError, type FieldError } from "../../middleware/errors.js";
import {
  abilityModifier,
  armorClass,
  carrySlots,
  hpAtFirstLevel,
  hpPerLevel,
  nextLevelXp,
  proficiencyBonus,
  type AbilityScores,
} from "../../rules/engine.js";
import { evaluate, parse } from "../../rules/expressions.js";
import type { SystemConfig } from "../../rules/schema.js";
import { assertParticipant, campaignInclude, findCampaign } from "../campaigns/service.js";
import { getSystem } from "../systems/service.js";
import type { SheetCreateInput, SheetUpdateInput } from "./schemas.js";

const SHEET_NOT_FOUND = new ApiError(404, "NOT_FOUND", "Character sheet not found");
const FORBIDDEN_EDIT = new ApiError(403, "FORBIDDEN", "You do not have permission to modify this sheet");

const sheetInclude = {
  owner: true,
  campaign: { include: campaignInclude },
} satisfies Prisma.CharacterSheetInclude;

type SheetWithRelations = Prisma.CharacterSheetGetPayload<{
  include: typeof sheetInclude;
}>;

export interface SheetExtras {
  talents: string[];
  spells: string[];
  notes: string;
  coins: Record<string, number>;
}

const DEFAULT_EXTRAS: SheetExtras = {
  talents: [],
  spells: [],
  notes: "",
  coins: {},
};

function parseAbilitiesJson(raw: string): AbilityScores {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const scores: AbilityScores = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") {
        scores[k] = v;
      }
    }
    return scores;
  } catch {
    return {};
  }
}

function parseExtrasJson(raw: string): SheetExtras {
  try {
    const parsed = JSON.parse(raw) as Partial<SheetExtras>;
    return {
      talents: Array.isArray(parsed.talents) ? parsed.talents : [],
      spells: Array.isArray(parsed.spells) ? parsed.spells : [],
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      coins: parsed.coins && typeof parsed.coins === "object" ? parsed.coins : {},
    };
  } catch {
    return { ...DEFAULT_EXTRAS, coins: {} };
  }
}

function computeInitiative(config: SystemConfig, scores: AbilityScores): number | null {
  const formula = config.derived.initiative;
  if (formula === undefined) return null;
  const context: Record<string, number> = {};
  for (const ability of config.abilities) {
    const score = scores[ability.key] ?? 0;
    context[`${ability.key}.score`] = score;
    context[`${ability.key}.mod`] = abilityModifier(config, ability.key, score);
  }
  return evaluate(parse(formula), context);
}

function validateAgainstConfig(
  config: SystemConfig,
  opts: {
    abilities: AbilityScores;
    requireAllAbilities: boolean;
    ancestryId?: string | null;
    classId?: string | null;
    backgroundId?: string | null;
    armorId?: string | null;
  },
): FieldError[] {
  const errors: FieldError[] = [];
  const configuredKeys = new Set(config.abilities.map((a) => a.key));
  const providedKeys = Object.keys(opts.abilities);

  if (opts.requireAllAbilities) {
    const hasAll = config.abilities.every((a) => Object.prototype.hasOwnProperty.call(opts.abilities, a.key));
    const hasExtra = providedKeys.some((k) => !configuredKeys.has(k));
    if (!hasAll || hasExtra) {
      errors.push({
        path: "abilities",
        message: `Abilities must include exactly: ${config.abilities.map((a) => a.key).join(", ")}`,
      });
    }
  } else {
    for (const k of providedKeys) {
      if (!configuredKeys.has(k)) {
        errors.push({ path: `abilities.${k}`, message: `Unknown ability: ${k}` });
      }
    }
  }

  const { min, max } = config.abilityScoreRange;
  for (const ability of config.abilities) {
    if (!Object.prototype.hasOwnProperty.call(opts.abilities, ability.key)) continue;
    const score = opts.abilities[ability.key];
    if (!Number.isInteger(score) || score < min || score > max) {
      errors.push({
        path: `abilities.${ability.key}`,
        message: `${ability.name} score must be an integer between ${min} and ${max}`,
      });
    }
  }

  if (opts.ancestryId) {
    if (!config.ancestries.some((a) => a.key === opts.ancestryId)) {
      errors.push({ path: "ancestryId", message: `Unknown ancestry: ${opts.ancestryId}` });
    }
  }
  if (opts.classId) {
    if (!config.classes.some((c) => c.key === opts.classId)) {
      errors.push({ path: "classId", message: `Unknown class: ${opts.classId}` });
    }
  }
  if (opts.backgroundId) {
    if (!config.backgrounds.some((b) => b.key === opts.backgroundId)) {
      errors.push({ path: "backgroundId", message: `Unknown background: ${opts.backgroundId}` });
    }
  }
  if (opts.armorId) {
    if (!config.armor.some((a) => a.key === opts.armorId)) {
      errors.push({ path: "armorId", message: `Unknown armor: ${opts.armorId}` });
    }
  }

  return errors;
}

function toSummary(sheet: SheetWithRelations) {
  return {
    id: sheet.id,
    kind: sheet.kind,
    name: sheet.name,
    ownerId: sheet.ownerId,
    ownerName: sheet.owner?.displayName ?? null,
    ancestryId: sheet.ancestryId,
    classId: sheet.classId,
    level: sheet.level,
    systemKey: sheet.systemKey,
  };
}

function toDetail(sheet: SheetWithRelations, config: SystemConfig) {
  const rawScores = parseAbilitiesJson(sheet.abilities);
  const extras = parseExtrasJson(sheet.extras);

  const abilities: Record<string, { score: number; modifier: number }> = {};
  const completeScores: AbilityScores = {};
  for (const ability of config.abilities) {
    const score = rawScores[ability.key] ?? config.abilityScoreRange.min;
    completeScores[ability.key] = score;
    abilities[ability.key] = {
      score,
      modifier: abilityModifier(config, ability.key, score),
    };
  }

  const validArmorId =
    sheet.armorId && config.armor.some((a) => a.key === sheet.armorId) ? sheet.armorId : null;
  const validClass = config.classes.find((c) => c.key === sheet.classId) ?? null;
  const effectiveClassKey = validClass?.key ?? config.classes[0]?.key ?? null;

  const computedHpPerLevel =
    effectiveClassKey && config.derived.hitPointsPerLevel
      ? hpPerLevel(config, effectiveClassKey, completeScores)
      : null;

  let spellcasting: { ability: string; known: number; allowed: number } | null = null;
  if (validClass?.spellcasting) {
    const idx = Math.max(0, Math.min(sheet.level, validClass.spellcasting.knownByLevel.length) - 1);
    const allowed = validClass.spellcasting.knownByLevel[idx] ?? 0;
    spellcasting = {
      ability: validClass.spellcasting.ability,
      known: extras.spells.length,
      allowed,
    };
  }

  return {
    ...toSummary(sheet),
    campaignId: sheet.campaignId,
    backgroundId: sheet.backgroundId,
    xp: sheet.xp,
    abilities,
    hpMax: sheet.hpMax,
    hpCurrent: sheet.hpCurrent,
    armorId: sheet.armorId,
    shield: sheet.shield,
    extras,
    derived: {
      hpPerLevel: computedHpPerLevel,
      proficiencyBonus: proficiencyBonus(config, sheet.level),
      initiative: computeInitiative(config, completeScores),
      carrySlots: carrySlots(config, completeScores),
      armorClass: armorClass(config, validArmorId, sheet.shield, completeScores),
      nextLevelXp: nextLevelXp(config, sheet.level),
      spellcasting,
    },
  };
}

async function resolveSheetConfig(sheet: SheetWithRelations): Promise<SystemConfig> {
  const activeKey =
    sheet.campaign.system && sheet.campaign.system !== "generic"
      ? sheet.campaign.system
      : sheet.systemKey;
  return getSystem(activeKey);
}

async function findSheetForParticipant(sheetId: string, userId: string): Promise<SheetWithRelations> {
  const sheet = await prisma.characterSheet.findUnique({
    where: { id: sheetId },
    include: sheetInclude,
  });
  if (!sheet) {
    throw SHEET_NOT_FOUND;
  }
  assertParticipant(sheet.campaign, userId);
  return sheet;
}

function assertCanModifySheet(sheet: SheetWithRelations, userId: string): void {
  const isCampaignOwner = sheet.campaign.ownerId === userId;
  const isPcOwner = sheet.kind === "PC" && sheet.ownerId === userId;
  if (!isCampaignOwner && !isPcOwner) {
    throw FORBIDDEN_EDIT;
  }
}

export async function listCampaignSheets(userId: string, campaignId: string) {
  const campaign = await findCampaign(campaignId);
  assertParticipant(campaign, userId);

  const sheets = await prisma.characterSheet.findMany({
    where: { campaignId },
    include: sheetInclude,
  });

  // PCs first, then NPCs; alphabetical by name within each group (UC-20).
  sheets.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "PC" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return sheets.map(toSummary);
}

export async function createSheet(
  userId: string,
  campaignId: string,
  input: SheetCreateInput,
) {
  const campaign = await findCampaign(campaignId);
  assertParticipant(campaign, userId);

  if (!campaign.system || campaign.system === "generic") {
    throw new ApiError(
      400,
      "SYSTEM_REQUIRED",
      "Campaign must have a system assigned before creating character sheets",
    );
  }

  if (input.kind === "NPC" && campaign.ownerId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "Only the campaign owner can create NPCs");
  }

  const config = await getSystem(campaign.system);
  const errors = validateAgainstConfig(config, {
    abilities: input.abilities,
    requireAllAbilities: true,
    ancestryId: input.ancestryId,
    classId: input.classId,
    backgroundId: input.backgroundId,
    armorId: input.armorId,
  });

  if (errors.length > 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Validation failed", errors);
  }

  const effectiveClassKey = input.classId ?? config.classes[0]?.key;
  const computedHp =
    effectiveClassKey && config.derived.hitPointsAtFirstLevel
      ? hpAtFirstLevel(config, effectiveClassKey, input.abilities)
      : 1;
  const hpMax = input.hpMax ?? computedHp;
  const hpCurrent = input.hpCurrent ?? hpMax;

  if (hpCurrent < 0 || hpCurrent > hpMax) {
    throw new ApiError(400, "VALIDATION_ERROR", "Validation failed", [
      { path: "hpCurrent", message: "hpCurrent must be between 0 and hpMax" },
    ]);
  }

  const extras: SheetExtras = {
    talents: input.extras?.talents ?? [],
    spells: input.extras?.spells ?? [],
    notes: input.extras?.notes ?? "",
    coins: input.extras?.coins ?? {},
  };

  const created = await prisma.characterSheet.create({
    data: {
      campaignId,
      kind: input.kind,
      name: input.name,
      ownerId: input.kind === "PC" ? userId : null,
      systemKey: campaign.system,
      ancestryId: input.ancestryId ?? null,
      classId: input.classId ?? null,
      backgroundId: input.backgroundId ?? null,
      level: 1,
      xp: 0,
      abilities: JSON.stringify(input.abilities),
      hpMax,
      hpCurrent,
      armorId: input.armorId ?? null,
      shield: input.shield ?? false,
      extras: JSON.stringify(extras),
    },
    include: sheetInclude,
  });

  return toDetail(created, config);
}

export async function getSheet(userId: string, sheetId: string) {
  const sheet = await findSheetForParticipant(sheetId, userId);
  const config = await resolveSheetConfig(sheet);
  return toDetail(sheet, config);
}

export async function updateSheet(
  userId: string,
  sheetId: string,
  input: SheetUpdateInput,
) {
  const sheet = await findSheetForParticipant(sheetId, userId);
  assertCanModifySheet(sheet, userId);

  const config = await resolveSheetConfig(sheet);
  const existingAbilities = parseAbilitiesJson(sheet.abilities);
  const mergedAbilities: AbilityScores = input.abilities
    ? { ...existingAbilities, ...input.abilities }
    : existingAbilities;

  const errors = validateAgainstConfig(config, {
    abilities: input.abilities ?? {},
    requireAllAbilities: false,
    ancestryId: input.ancestryId,
    classId: input.classId,
    backgroundId: input.backgroundId,
    armorId: input.armorId,
  });

  const nextHpMax = input.hpMax ?? sheet.hpMax;
  const nextHpCurrent = input.hpCurrent ?? Math.min(sheet.hpCurrent, nextHpMax);

  if (nextHpCurrent < 0 || nextHpCurrent > nextHpMax) {
    errors.push({ path: "hpCurrent", message: "hpCurrent must be between 0 and hpMax" });
  }

  if (errors.length > 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Validation failed", errors);
  }

  const existingExtras = parseExtrasJson(sheet.extras);
  const mergedExtras: SheetExtras = input.extras
    ? {
        talents: input.extras.talents ?? existingExtras.talents,
        spells: input.extras.spells ?? existingExtras.spells,
        notes: input.extras.notes ?? existingExtras.notes,
        coins: input.extras.coins ?? existingExtras.coins,
      }
    : existingExtras;

  const updated = await prisma.characterSheet.update({
    where: { id: sheetId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.ancestryId !== undefined ? { ancestryId: input.ancestryId } : {}),
      ...(input.classId !== undefined ? { classId: input.classId } : {}),
      ...(input.backgroundId !== undefined ? { backgroundId: input.backgroundId } : {}),
      ...(input.xp !== undefined ? { xp: input.xp } : {}),
      ...(input.abilities !== undefined ? { abilities: JSON.stringify(mergedAbilities) } : {}),
      ...(input.hpMax !== undefined ? { hpMax: nextHpMax } : {}),
      ...(input.hpCurrent !== undefined || input.hpMax !== undefined
        ? { hpCurrent: nextHpCurrent }
        : {}),
      ...(input.armorId !== undefined ? { armorId: input.armorId } : {}),
      ...(input.shield !== undefined ? { shield: input.shield } : {}),
      ...(input.extras !== undefined ? { extras: JSON.stringify(mergedExtras) } : {}),
    },
    include: sheetInclude,
  });

  return toDetail(updated, config);
}

export async function levelUpSheet(userId: string, sheetId: string) {
  const sheet = await findSheetForParticipant(sheetId, userId);
  assertCanModifySheet(sheet, userId);

  const config = await resolveSheetConfig(sheet);
  if (sheet.level >= config.levels.max) {
    throw new ApiError(400, "MAX_LEVEL", "Maximum level reached for this system");
  }

  const scores = parseAbilitiesJson(sheet.abilities);
  const effectiveClassKey =
    sheet.classId && config.classes.some((c) => c.key === sheet.classId)
      ? sheet.classId
      : config.classes[0]?.key;

  const hpGain =
    effectiveClassKey && config.derived.hitPointsPerLevel
      ? Math.max(1, hpPerLevel(config, effectiveClassKey, scores))
      : 1;

  const resetXp =
    config.levels.advancement.mode === "multiplier" &&
    config.levels.advancement.resetOnAdvance;

  const updated = await prisma.characterSheet.update({
    where: { id: sheetId },
    data: {
      level: sheet.level + 1,
      hpMax: sheet.hpMax + hpGain,
      xp: resetXp ? 0 : sheet.xp,
    },
    include: sheetInclude,
  });

  return toDetail(updated, config);
}

export async function deleteSheet(userId: string, sheetId: string): Promise<void> {
  const sheet = await findSheetForParticipant(sheetId, userId);
  assertCanModifySheet(sheet, userId);
  await prisma.characterSheet.delete({ where: { id: sheetId } });
}
