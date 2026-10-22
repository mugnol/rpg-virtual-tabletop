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
import {
  calculateShadowdarkGearSlots,
  computeShadowdarkStartingHp,
  computeWeaponAttackAndDamage,
  exportToShadowdarklings,
  generateRandomShadowdarkCharacter,
  getCharacterTitle,
  importFromShadowdarklings,
  manageLightSource,
  PRIEST_SPELLS_KNOWN_BY_TIER,
  resolveCarousing,
  resolveFocusCheck,
  resolveRest,
  resolveSpellcastingCheck,
  resolveStabilizeCheck,
  rollDeathTimer,
  rollDyingTurn,
  SHADOWDARK_ANCESTRIES,
  SHADOWDARK_SPELLS,
  SHADOWDARK_WEAPONS,
  WIZARD_SPELLS_KNOWN_BY_TIER,
  type ShadowdarkAlignment,
  type ShadowdarkAncestryKey,
  type ShadowdarklingsCharacterJson,
} from "../../rules/shadowdark.js";
import { assertParticipant, campaignInclude, findCampaign } from "../campaigns/service.js";
import { getSystem } from "../systems/service.js";
import type {
  ShadowdarkActionInput,
  SheetCreateInput,
  SheetGenerateInput,
  SheetLevelUpInput,
  SheetUpdateInput,
} from "./schemas.js";

const SHEET_NOT_FOUND = new ApiError(404, "NOT_FOUND", "Character sheet not found");
const FORBIDDEN_EDIT = new ApiError(403, "FORBIDDEN", "You do not have permission to modify this sheet");

const sheetInclude = {
  owner: true,
  campaign: { include: campaignInclude },
} satisfies Prisma.CharacterSheetInclude;

type SheetWithRelations = Prisma.CharacterSheetGetPayload<{
  include: typeof sheetInclude;
}>;

export interface SheetGearEntry {
  name: string;
  slots: number;
  quantity?: number;
  type?: string;
  freeCarry?: boolean;
  stackablePerSlot?: number;
}

export interface SheetLightTimerState {
  active: boolean;
  source: "torch" | "lantern" | "light-spell" | "campfire" | null;
  remainingMinutes: number;
}

export interface SheetExtras {
  talents: string[];
  spells: string[];
  notes: string;
  coins: Record<string, number>;
  alignment?: ShadowdarkAlignment;
  deity?: string | null;
  title?: string | null;
  languages?: string[];
  weapons?: string[];
  weaponMastery?: string[];
  gear?: SheetGearEntry[];
  lostSpells?: string[];
  penanceSpells?: string[];
  activeFocusSpell?: string | null;
  luckTokens?: number;
  lightTimer?: SheetLightTimerState | null;
  deathTimer?: number | null;
}

const DEFAULT_EXTRAS: SheetExtras = {
  talents: [],
  spells: [],
  notes: "",
  coins: {},
};

const OPTIONAL_EXTRAS_KEYS = [
  "alignment",
  "deity",
  "title",
  "languages",
  "weapons",
  "weaponMastery",
  "gear",
  "lostSpells",
  "penanceSpells",
  "activeFocusSpell",
  "luckTokens",
  "lightTimer",
  "deathTimer",
] as const;

function buildExtras(
  existing: Partial<SheetExtras>,
  patch?: Partial<SheetExtras>,
): SheetExtras {
  const result: SheetExtras = {
    talents: patch?.talents ?? (Array.isArray(existing.talents) ? existing.talents : []),
    spells: patch?.spells ?? (Array.isArray(existing.spells) ? existing.spells : []),
    notes: patch?.notes ?? (typeof existing.notes === "string" ? existing.notes : ""),
    coins:
      patch?.coins ??
      (existing.coins && typeof existing.coins === "object" ? existing.coins : {}),
  };

  for (const key of OPTIONAL_EXTRAS_KEYS) {
    const val = patch && key in patch ? patch[key] : existing[key];
    if (val !== undefined) {
      (result as unknown as Record<string, unknown>)[key] = val;
    }
  }

  return result;
}

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
    return buildExtras(parsed);
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
  if (validClass?.spellcasting && sheet.level >= 1) {
    const idx = Math.max(0, Math.min(sheet.level, validClass.spellcasting.knownByLevel.length) - 1);
    const allowed = validClass.spellcasting.knownByLevel[idx] ?? 0;
    spellcasting = {
      ability: validClass.spellcasting.ability,
      known: extras.spells.length,
      allowed,
    };
  }

  let shadowdarkDerived: Record<string, unknown> | undefined;
  if (config.key === "shadowdark") {
    const ancestryDef =
      sheet.ancestryId && sheet.ancestryId in SHADOWDARK_ANCESTRIES
        ? SHADOWDARK_ANCESTRIES[sheet.ancestryId as ShadowdarkAncestryKey]
        : null;
    const gearSlots = calculateShadowdarkGearSlots({
      strScore: completeScores.str ?? 10,
      conScore: completeScores.con ?? 10,
      classKey: sheet.classId,
      coins: {
        gp: extras.coins.gp ?? 0,
        sp: extras.coins.sp ?? 0,
        cp: extras.coins.cp ?? 0,
      },
      items: extras.gear ?? [],
    });

    shadowdarkDerived = {
      title:
        extras.title ??
        getCharacterTitle(sheet.classId, sheet.level, extras.alignment ?? "Neutral"),
      alignment: extras.alignment ?? "Neutral",
      deity: extras.deity ?? null,
      languages: extras.languages ?? ancestryDef?.languages ?? ["Common"],
      ancestryTrait: ancestryDef
        ? { name: ancestryDef.traitName, description: ancestryDef.traitDescription }
        : null,
      maxGearSlots: gearSlots.maxSlots,
      usedGearSlots: gearSlots.usedSlots,
      weapons: (extras.weapons ?? [])
        .map((wKey) => {
          const weapon = SHADOWDARK_WEAPONS.find((w) => w.key === wKey);
          if (!weapon) return null;
          return {
            ...weapon,
            stats: computeWeaponAttackAndDamage({
              weaponKey: wKey,
              strScore: completeScores.str ?? 10,
              dexScore: completeScores.dex ?? 10,
              classKey: sheet.classId,
              ancestryKey: sheet.ancestryId,
              level: sheet.level,
              weaponMasteryKeys: extras.weaponMastery,
            }),
          };
        })
        .filter(Boolean),
      spellsKnownByTier:
        sheet.classId === "priest" && sheet.level >= 1
          ? PRIEST_SPELLS_KNOWN_BY_TIER[Math.min(10, sheet.level)] ?? null
          : sheet.classId === "wizard" && sheet.level >= 1
            ? WIZARD_SPELLS_KNOWN_BY_TIER[Math.min(10, sheet.level)] ?? null
            : null,
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
      proficiencyBonus: proficiencyBonus(config, Math.max(1, sheet.level)),
      initiative: computeInitiative(config, completeScores),
      carrySlots: carrySlots(config, completeScores),
      armorClass: armorClass(config, validArmorId, sheet.shield, completeScores),
      nextLevelXp: sheet.level === 0 ? 0 : nextLevelXp(config, sheet.level),
      spellcasting,
      ...(shadowdarkDerived ? { shadowdark: shadowdarkDerived } : {}),
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

  const level = input.level ?? 1;
  const effectiveClassKey = input.classId ?? config.classes[0]?.key;
  let computedHp = 1;
  if (level === 0 && config.key === "shadowdark") {
    computedHp = computeShadowdarkStartingHp({
      level: 0,
      classKey: null,
      ancestryKey: input.ancestryId ?? null,
      conScore: input.abilities.con ?? 10,
    });
  } else if (effectiveClassKey && config.derived.hitPointsAtFirstLevel) {
    computedHp = hpAtFirstLevel(config, effectiveClassKey, input.abilities);
  }
  const hpMax = input.hpMax ?? computedHp;
  const hpCurrent = input.hpCurrent ?? hpMax;

  if (hpCurrent < 0 || hpCurrent > hpMax) {
    throw new ApiError(400, "VALIDATION_ERROR", "Validation failed", [
      { path: "hpCurrent", message: "hpCurrent must be between 0 and hpMax" },
    ]);
  }

  const extras = buildExtras({}, input.extras as Partial<SheetExtras> | undefined);

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
      level,
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
    ? buildExtras(existingExtras, input.extras as Partial<SheetExtras>)
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

export async function levelUpSheet(
  userId: string,
  sheetId: string,
  input?: SheetLevelUpInput,
) {
  const sheet = await findSheetForParticipant(sheetId, userId);
  assertCanModifySheet(sheet, userId);

  const config = await resolveSheetConfig(sheet);
  if (sheet.level >= config.levels.max) {
    throw new ApiError(400, "MAX_LEVEL", "Maximum level reached for this system");
  }

  const scores = parseAbilitiesJson(sheet.abilities);

  // Level 0 (Gauntlet) -> Level 1 graduation
  if (sheet.level === 0) {
    const requestedClass = input?.classId ?? sheet.classId;
    const effectiveClassKey =
      requestedClass && config.classes.some((c) => c.key === requestedClass)
        ? requestedClass
        : config.classes[0]?.key ?? null;

    const lv1Hp =
      effectiveClassKey && config.derived.hitPointsAtFirstLevel
        ? hpAtFirstLevel(config, effectiveClassKey, scores)
        : sheet.hpMax + 1;
    const nextHpMax = Math.max(sheet.hpMax + 1, lv1Hp);

    const updated = await prisma.characterSheet.update({
      where: { id: sheetId },
      data: {
        level: 1,
        classId: effectiveClassKey,
        hpMax: nextHpMax,
        hpCurrent: nextHpMax,
        xp: 0,
      },
      include: sheetInclude,
    });
    return toDetail(updated, config);
  }

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

export async function generateRandomSheet(
  userId: string,
  campaignId: string,
  input: SheetGenerateInput,
) {
  const campaign = await findCampaign(campaignId);
  assertParticipant(campaign, userId);

  if (!campaign.system || campaign.system === "generic") {
    throw new ApiError(
      400,
      "SYSTEM_REQUIRED",
      "Campaign must have a system assigned before generating character sheets",
    );
  }

  const kind = input.kind ?? "PC";
  if (kind === "NPC" && campaign.ownerId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "Only the campaign owner can create NPCs");
  }

  const config = await getSystem(campaign.system);
  const generated = generateRandomShadowdarkCharacter({
    level: input.level === 0 ? 0 : 1,
    name: input.name,
  });

  const extras = buildExtras({}, generated.extras as Partial<SheetExtras>);

  const created = await prisma.characterSheet.create({
    data: {
      campaignId,
      kind,
      name: generated.name,
      ownerId: kind === "PC" ? userId : null,
      systemKey: campaign.system,
      ancestryId: generated.ancestryId,
      classId: generated.classId,
      backgroundId: generated.backgroundId,
      level: generated.level,
      xp: 0,
      abilities: JSON.stringify(generated.abilities),
      hpMax: generated.hpMax,
      hpCurrent: generated.hpCurrent,
      armorId: generated.armorId,
      shield: generated.shield,
      extras: JSON.stringify(extras),
    },
    include: sheetInclude,
  });

  return toDetail(created, config);
}

export async function exportSheetShadowdarklings(
  userId: string,
  sheetId: string,
): Promise<ShadowdarklingsCharacterJson> {
  const sheet = await findSheetForParticipant(sheetId, userId);
  const abilities = parseAbilitiesJson(sheet.abilities);
  const extras = parseExtrasJson(sheet.extras);

  return exportToShadowdarklings({
    name: sheet.name,
    level: sheet.level,
    xp: sheet.xp,
    ancestryId: sheet.ancestryId,
    classId: sheet.classId,
    backgroundId: sheet.backgroundId,
    abilities,
    hpMax: sheet.hpMax,
    armorId: sheet.armorId,
    shield: sheet.shield,
    extras: {
      alignment: extras.alignment ?? "Neutral",
      deity: extras.deity ?? undefined,
      title: extras.title ?? undefined,
      talents: extras.talents,
      spells: extras.spells,
      languages: extras.languages,
      coins: extras.coins,
      gear: extras.gear,
      weapons: extras.weapons,
      weaponMastery: extras.weaponMastery,
    },
  });
}

export async function importSheetShadowdarklings(
  userId: string,
  campaignId: string,
  rawDoc: unknown,
) {
  const campaign = await findCampaign(campaignId);
  assertParticipant(campaign, userId);

  if (!campaign.system || campaign.system === "generic") {
    throw new ApiError(
      400,
      "SYSTEM_REQUIRED",
      "Campaign must have a system assigned before importing character sheets",
    );
  }

  if (!rawDoc || typeof rawDoc !== "object" || !("name" in rawDoc) || !("stats" in rawDoc)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid Shadowdarklings JSON document");
  }

  const config = await getSystem(campaign.system);
  const imported = importFromShadowdarklings(rawDoc as Record<string, unknown>);

  const extras = buildExtras({}, imported.extras as Partial<SheetExtras>);

  const created = await prisma.characterSheet.create({
    data: {
      campaignId,
      kind: "PC",
      name: imported.name,
      ownerId: userId,
      systemKey: campaign.system,
      ancestryId: imported.ancestryId,
      classId: imported.classId,
      backgroundId: imported.backgroundId,
      level: imported.level,
      xp: imported.xp,
      abilities: JSON.stringify(imported.abilities),
      hpMax: imported.hpMax,
      hpCurrent: imported.hpCurrent,
      armorId: imported.armorId,
      shield: imported.shield,
      extras: JSON.stringify(extras),
    },
    include: sheetInclude,
  });

  return toDetail(created, config);
}

export async function executeShadowdarkAction(
  userId: string,
  sheetId: string,
  input: ShadowdarkActionInput,
) {
  const sheet = await findSheetForParticipant(sheetId, userId);
  assertCanModifySheet(sheet, userId);

  const config = await resolveSheetConfig(sheet);
  const scores = parseAbilitiesJson(sheet.abilities);
  const extras = parseExtrasJson(sheet.extras);

  let nextHpCurrent = sheet.hpCurrent;
  let nextXp = sheet.xp;
  const nextExtras: SheetExtras = { ...extras };
  let actionResult: unknown = {};

  switch (input.action) {
    case "cast_spell": {
      const spellKey = input.spellKey ?? "light";
      const spellDef = SHADOWDARK_SPELLS.find((s) => s.key === spellKey);
      const casterClass = sheet.classId === "priest" ? "priest" : "wizard";
      const casterAbility = casterClass === "priest" ? "wis" : "int";
      const abilityScore = scores[casterAbility] ?? 10;

      const res = resolveSpellcastingCheck({
        spellKey,
        casterClass,
        abilityScore,
        hasAdvantage: input.hasAdvantage,
        forcedD20: input.forcedD20,
      });

      const lostSpells = new Set(nextExtras.lostSpells ?? []);
      const penanceSpells = new Set(nextExtras.penanceSpells ?? []);

      if (res.spellLost) {
        lostSpells.add(spellKey);
      }
      if (res.penanceRequired) {
        penanceSpells.add(spellKey);
      }
      if (res.success && spellDef?.duration.toLowerCase() === "focus") {
        nextExtras.activeFocusSpell = spellKey;
      }

      nextExtras.lostSpells = Array.from(lostSpells);
      if (penanceSpells.size > 0 || nextExtras.penanceSpells !== undefined) {
        nextExtras.penanceSpells = Array.from(penanceSpells);
      }
      actionResult = res;
      break;
    }

    case "focus_check": {
      const spellKey = input.spellKey ?? nextExtras.activeFocusSpell ?? "charm-person";
      const casterClass = sheet.classId === "priest" ? "priest" : "wizard";
      const casterAbility = casterClass === "priest" ? "wis" : "int";
      const abilityScore = scores[casterAbility] ?? 10;

      const res = resolveFocusCheck({
        spellKey,
        casterClass,
        abilityScore,
        forcedD20: input.forcedD20,
      });

      if (!res.maintained) {
        if (res.spellLost) {
          const lostSpells = new Set(nextExtras.lostSpells ?? []);
          lostSpells.add(spellKey);
          nextExtras.lostSpells = Array.from(lostSpells);
        }
        nextExtras.activeFocusSpell = null;
      }
      actionResult = res;
      break;
    }

    case "complete_penance": {
      const spellKey = input.spellKey;
      if (spellKey) {
        nextExtras.penanceSpells = (nextExtras.penanceSpells ?? []).filter(
          (k) => k !== spellKey,
        );
        nextExtras.lostSpells = (nextExtras.lostSpells ?? []).filter(
          (k) => k !== spellKey,
        );
      } else {
        nextExtras.penanceSpells = [];
      }
      actionResult = { penanceCompleted: true, spellKey: spellKey ?? null };
      break;
    }

    case "rest": {
      const res = resolveRest({
        hpCurrent: sheet.hpCurrent,
        hpMax: sheet.hpMax,
        rations: 1,
        interrupted: input.interrupted,
        conScore: scores.con ?? 10,
        forcedInterruptionD20: input.forcedD20,
        grinderMode: input.grinderMode,
        classKey: sheet.classId,
        ancestryKey: sheet.ancestryId,
        lostSpells: nextExtras.lostSpells ?? [],
      });
      nextHpCurrent = res.hpCurrent;
      nextExtras.lostSpells = res.lostSpells;
      nextExtras.activeFocusSpell = null;
      actionResult = res;
      break;
    }

    case "carouse": {
      const currentGp = nextExtras.coins?.gp ?? 0;
      const eventCostGp = input.eventCostGp ?? 30;
      const res = resolveCarousing({
        eventCostGp,
        forcedD8: input.forcedD8,
      });
      nextXp = sheet.xp + res.xpGained;
      const remainingAfterCost = Math.max(0, currentGp - eventCostGp);
      const wealthLoss = Math.floor((remainingAfterCost * res.wealthLossPercent) / 100);
      const remainingGp = Math.max(0, remainingAfterCost - wealthLoss);
      nextExtras.coins = {
        ...nextExtras.coins,
        gp: remainingGp,
      };
      if (res.luckTokenGained) {
        nextExtras.luckTokens = (nextExtras.luckTokens ?? 0) + 1;
      }
      actionResult = { ...res, remainingGp };
      break;
    }

    case "roll_death_timer": {
      const res = rollDeathTimer({
        conScore: scores.con ?? 10,
        level: sheet.level,
      });
      nextExtras.deathTimer = res.rounds;
      actionResult = res;
      break;
    }

    case "death_turn": {
      const res = rollDyingTurn({
        remainingRounds: nextExtras.deathTimer ?? 1,
        forcedD20: input.forcedD20,
      });
      if (res.risesWithOneHp) {
        nextHpCurrent = 1;
        nextExtras.deathTimer = null;
      } else if (res.dead) {
        nextExtras.deathTimer = 0;
      } else {
        nextExtras.deathTimer = res.remainingRounds;
      }
      actionResult = res;
      break;
    }

    case "stabilize": {
      const res = resolveStabilizeCheck({
        intScore: scores.int ?? 10,
        forcedD20: input.forcedD20,
      });
      if (res.stabilized) {
        nextExtras.deathTimer = null;
      }
      actionResult = res;
      break;
    }

    case "light_source": {
      const op = input.lightOperation ?? "ignite";
      const src = input.lightSource ?? "torch";
      const currentMins = nextExtras.lightTimer?.remainingMinutes ?? 60;
      const managed = manageLightSource({
        mode:
          src === "campfire"
            ? "campfire"
            : op === "ride_along"
              ? "ride-along"
              : "extinguish-and-reset",
        currentRemainingMinutes: currentMins,
        blitzMode: input.blitzMode,
      });
      const remainingMinutes =
        op === "tick"
          ? Math.max(0, currentMins - (input.elapsedMinutes ?? 10))
          : managed.remainingMinutes;
      nextExtras.lightTimer = {
        active: remainingMinutes > 0,
        source: remainingMinutes > 0 ? src : null,
        remainingMinutes,
      };
      actionResult = nextExtras.lightTimer;
      break;
    }
  }

  const updated = await prisma.characterSheet.update({
    where: { id: sheetId },
    data: {
      hpCurrent: nextHpCurrent,
      xp: nextXp,
      extras: JSON.stringify(nextExtras),
    },
    include: sheetInclude,
  });

  return {
    result: actionResult,
    sheet: toDetail(updated, config),
  };
}
