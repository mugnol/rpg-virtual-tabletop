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
});

export const tokenUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  x: z.number().int().min(0).optional(),
  y: z.number().int().min(0).optional(),
  color: z.string().optional(),
  hpMax: z.number().int().min(1).optional(),
  hpCurrent: z.number().int().min(0).optional(),
  ac: z.number().int().min(0).optional(),
  speed: z.number().int().min(1).max(60).optional(),
  attackBonus: z.number().int().optional(),
  damageFormula: z.string().optional(),
  initiative: z.number().int().optional(),
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
export type CombatAttackInput = z.infer<typeof combatAttackSchema>;
export type CombatTimerCreateInput = z.infer<typeof combatTimerCreateSchema>;
