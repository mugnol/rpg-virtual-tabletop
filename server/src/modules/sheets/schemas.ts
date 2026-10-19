import { z } from "zod";

export const extrasInputSchema = z
  .object({
    talents: z.array(z.string().trim().min(1).max(120)).optional(),
    spells: z.array(z.string().trim().min(1).max(120)).optional(),
    notes: z.string().max(4000).optional(),
    coins: z.record(z.string(), z.number().int().min(0).max(999_999)).optional(),
  })
  .strict();

export const sheetCreateSchema = z.object({
  kind: z.enum(["PC", "NPC"]).default("PC"),
  name: z.string().trim().min(1, "Name is required").max(80),
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

export type SheetCreateInput = z.infer<typeof sheetCreateSchema>;
export type SheetUpdateInput = z.infer<typeof sheetUpdateSchema>;
