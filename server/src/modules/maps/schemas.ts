import { z } from "zod";

export const mapCreateSchema = z.object({
  name: z.string().trim().min(1).max(100).default("Dungeon Map"),
  theme: z.enum(["stone-dungeon", "forest-clearing", "tavern-cellar"]).default("stone-dungeon"),
  width: z.number().int().min(4).max(64).default(12),
  height: z.number().int().min(4).max(64).default(8),
  allowPlayerMovement: z.boolean().default(false),
});

export const mapUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  theme: z.enum(["stone-dungeon", "forest-clearing", "tavern-cellar"]).optional(),
  width: z.number().int().min(4).max(64).optional(),
  height: z.number().int().min(4).max(64).optional(),
  allowPlayerMovement: z.boolean().optional(),
});

export const tokenCreateSchema = z.object({
  type: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(["CHARACTER", "MONSTER", "ITEM"]))
    .default("CHARACTER"),
  name: z.string().trim().min(1).max(100).optional(),
  characterSheetId: z.string().optional(),
  ownerId: z.string().optional(),
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  color: z.string().optional(),
  hpMax: z.number().int().min(1).optional(),
  hpCurrent: z.number().int().min(0).optional(),
  ac: z.number().int().min(0).optional(),
  speed: z.number().int().min(1).max(60).optional(),
  attackBonus: z.number().int().optional(),
  damageFormula: z.string().optional(),
  initiative: z.number().int().optional(),
  dexModifier: z.number().int().optional(),
  hasSurprise: z.boolean().optional(),
  monsterKey: z.string().optional(),
  monsterRole: z.string().optional(),
  level: z.number().int().optional(),
  imageUrl: z.string().trim().max(200000).nullable().optional(),
  avatarKey: z.string().trim().max(100).nullable().optional(),
});

export const tokenUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  x: z.number().int().min(0).optional(),
  y: z.number().int().min(0).optional(),
  color: z.string().optional(),
  imageUrl: z.string().trim().max(200000).nullable().optional(),
  avatarKey: z.string().trim().max(100).nullable().optional(),
  hpMax: z.number().int().min(1).optional(),
  hpCurrent: z.number().int().min(0).optional(),
  ac: z.number().int().min(0).optional(),
  speed: z.number().int().min(1).max(60).optional(),
  attackBonus: z.number().int().optional(),
  damageFormula: z.string().optional(),
  initiative: z.number().int().optional(),
  dexModifier: z.number().int().optional(),
  hasSurprise: z.boolean().optional(),
  monsterKey: z.string().optional(),
  monsterRole: z.string().optional(),
  level: z.number().int().optional(),
});

export const combatStartSchema = z.object({
  chaosMode: z.boolean().optional(),
  groupMonsterInitiative: z.boolean().optional(),
  forcedRollsById: z.record(z.string(), z.array(z.number().int())).optional(),
  forcedGroupMonsterRoll: z.number().int().min(1).max(20).optional(),
});

export const combatNextSchema = z.object({
  forcedRollsById: z.record(z.string(), z.array(z.number().int())).optional(),
  forcedGroupMonsterRoll: z.number().int().min(1).max(20).optional(),
});

export const combatRollInitiativeSchema = z.object({
  tokenId: z.string().optional(),
  forcedRolls: z.array(z.number().int()).optional(),
  forcedRollsById: z.record(z.string(), z.array(z.number().int())).optional(),
  forcedGroupMonsterRoll: z.number().int().min(1).max(20).optional(),
});

export const combatSetInitiativeSchema = z.object({
  tokenId: z.string().min(1),
  initiative: z.number().int(),
});

export const combatSurpriseSchema = z.object({
  tokenId: z.string().min(1),
  hasSurprise: z.boolean().optional(),
});

export const combatSettingsSchema = z.object({
  chaosMode: z.boolean().optional(),
  groupMonsterInitiative: z.boolean().optional(),
  freeformMode: z.boolean().optional(),
});

export const combatReorderSchema = z.object({
  orderedTokenIds: z.array(z.string()).optional(),
  tokenId: z.string().optional(),
  direction: z.enum(["up", "down"]).optional(),
});

export const combatAttackSchema = z.object({
  attackerId: z.string().min(1),
  targetId: z.string().min(1),
  forcedD20: z.number().int().min(1).max(20).optional(),
});

export const combatTimerCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(["spell", "light", "dying", "custom"]).default("custom"),
  scope: z.enum(["personal", "gm"]).default("gm"),
  entityId: z.string().nullable().optional(),
  durationRounds: z.number().int().min(1).max(100).default(3),
});

export type MapCreateInput = z.infer<typeof mapCreateSchema>;
export type MapUpdateInput = z.infer<typeof mapUpdateSchema>;
export type TokenCreateInput = z.infer<typeof tokenCreateSchema>;
export type TokenUpdateInput = z.infer<typeof tokenUpdateSchema>;
export type CombatStartInput = z.infer<typeof combatStartSchema>;
export type CombatNextInput = z.infer<typeof combatNextSchema>;
export type CombatRollInitiativeInput = z.infer<typeof combatRollInitiativeSchema>;
export type CombatSetInitiativeInput = z.infer<typeof combatSetInitiativeSchema>;
export type CombatSurpriseInput = z.infer<typeof combatSurpriseSchema>;
export type CombatSettingsInput = z.infer<typeof combatSettingsSchema>;
export type CombatReorderInput = z.infer<typeof combatReorderSchema>;
export type CombatAttackInput = z.infer<typeof combatAttackSchema>;
export type CombatTimerCreateInput = z.infer<typeof combatTimerCreateSchema>;
