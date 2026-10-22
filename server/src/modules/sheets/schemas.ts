import { z } from "zod";

export const gearItemInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slots: z.number().min(0).max(20),
  quantity: z.number().int().min(1).max(999).optional(),
  freeCarry: z.boolean().optional(),
  stackablePerSlot: z.number().int().min(1).max(100).optional(),
});

export const lightTimerInputSchema = z.object({
  active: z.boolean(),
  source: z.enum(["torch", "lantern", "light-spell", "campfire"]).nullable(),
  remainingMinutes: z.number().int().min(0).max(9999),
});

export const extrasInputSchema = z
  .object({
    talents: z.array(z.string().trim().min(1).max(120)).optional(),
    spells: z.array(z.string().trim().min(1).max(120)).optional(),
    notes: z.string().max(4000).optional(),
    coins: z.record(z.string(), z.number().int().min(0).max(999_999)).optional(),
    alignment: z.enum(["Lawful", "Neutral", "Chaotic"]).optional(),
    deity: z.string().trim().max(120).nullable().optional(),
    title: z.string().trim().max(120).nullable().optional(),
    languages: z.array(z.string().trim().min(1).max(80)).optional(),
    weapons: z.array(z.string().trim().min(1).max(80)).optional(),
    weaponMastery: z.array(z.string().trim().min(1).max(80)).optional(),
    gear: z.array(gearItemInputSchema).optional(),
    lostSpells: z.array(z.string().trim().min(1).max(120)).optional(),
    penanceSpells: z.array(z.string().trim().min(1).max(120)).optional(),
    activeFocusSpell: z.string().trim().max(120).nullable().optional(),
    luckTokens: z.number().int().min(0).max(99).optional(),
    lightTimer: lightTimerInputSchema.nullable().optional(),
    deathTimer: z.number().int().min(0).max(20).nullable().optional(),
  })
  .strict();

export const sheetCreateSchema = z.object({
  kind: z.enum(["PC", "NPC"]).default("PC"),
  name: z.string().trim().min(1, "Name is required").max(80),
  level: z.number().int().min(0).max(10).optional(),
  ancestryId: z.string().trim().min(1).nullable().optional(),
  classId: z.string().trim().min(1).nullable().optional(),
  backgroundId: z.string().trim().min(1).nullable().optional(),
  abilities: z.record(z.string(), z.number().int()),
  hpMax: z.number().int().min(1).max(9999).optional(),
  hpCurrent: z.number().int().min(0).max(9999).optional(),
  armorId: z.string().trim().min(1).nullable().optional(),
  shield: z.boolean().default(false),
  extras: extrasInputSchema.optional(),
});

export const sheetUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80).optional(),
  ancestryId: z.string().trim().min(1).nullable().optional(),
  classId: z.string().trim().min(1).nullable().optional(),
  backgroundId: z.string().trim().min(1).nullable().optional(),
  xp: z.number().int().min(0).max(999_999).optional(),
  abilities: z.record(z.string(), z.number().int()).optional(),
  hpMax: z.number().int().min(1).max(9999).optional(),
  hpCurrent: z.number().int().min(0).max(9999).optional(),
  armorId: z.string().trim().min(1).nullable().optional(),
  shield: z.boolean().optional(),
  extras: extrasInputSchema.optional(),
  // BR-22: direct level edits are ignored (never applied).
  level: z.any().optional(),
});

export const sheetLevelUpSchema = z
  .object({
    classId: z.string().trim().min(1).nullable().optional(),
  })
  .optional();

export const sheetGenerateSchema = z.object({
  level: z.number().int().min(0).max(1).optional(),
  kind: z.enum(["PC", "NPC"]).optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

export const shadowdarkActionSchema = z.object({
  action: z.enum([
    "cast_spell",
    "focus_check",
    "complete_penance",
    "rest",
    "carouse",
    "roll_death_timer",
    "death_turn",
    "stabilize",
    "light_source",
  ]),
  spellKey: z.string().optional(),
  spellTier: z.number().int().min(1).max(5).optional(),
  hasAdvantage: z.boolean().optional(),
  forcedD20: z.number().int().min(1).max(20).optional(),
  interrupted: z.boolean().optional(),
  grinderMode: z.boolean().optional(),
  eventCostGp: z.number().int().min(0).optional(),
  forcedD8: z.number().int().min(1).max(8).optional(),
  lightOperation: z.enum(["ignite", "ride_along", "extinguish", "tick"]).optional(),
  lightSource: z.enum(["torch", "lantern", "light-spell", "campfire"]).optional(),
  blitzMode: z.boolean().optional(),
  elapsedMinutes: z.number().int().min(0).optional(),
});

export type SheetCreateInput = z.infer<typeof sheetCreateSchema>;
export type SheetUpdateInput = z.infer<typeof sheetUpdateSchema>;
export type SheetLevelUpInput = z.infer<typeof sheetLevelUpSchema>;
export type SheetGenerateInput = z.infer<typeof sheetGenerateSchema>;
export type ShadowdarkActionInput = z.infer<typeof shadowdarkActionSchema>;
