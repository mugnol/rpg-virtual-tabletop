import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseBody } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError } from "../../middleware/errors.js";
import {
  SHADOWDARK_COMBAT_ROLES,
  generateProceduralMonster,
  getShadowdarkMonster,
  searchShadowdarkMonsters,
} from "../../rules/shadowdarkMonsters.js";

export const monstersRouter = Router();

monstersRouter.use(requireAuth);

const monsterQuerySchema = z.object({
  search: z.string().optional(),
  level: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? Number.parseInt(val, 10) : undefined)),
  alignment: z.enum(["Lawful", "Neutral", "Chaotic", "L", "N", "C"]).optional(),
  system: z.string().optional(),
});

const generateMonsterSchema = z.object({
  partyLevel: z.number().int().min(1).default(1),
  rollCombat: z.number().int().min(1).max(20).optional(),
  rollQuality: z.number().int().min(1).max(20).optional(),
  rollStrength: z.number().int().min(1).max(20).optional(),
  rollWeakness: z.number().int().min(1).max(20).optional(),
  attacksCountRoll: z.number().int().min(1).max(4).optional(),
  mutationRolls: z
    .array(
      z.object({
        table: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        roll: z.number().int().min(1).max(12),
      }),
    )
    .optional(),
});

// GET /api/monsters/roles (registered before /:id)
monstersRouter.get("/roles", (_req, res) => {
  res.json({ roles: SHADOWDARK_COMBAT_ROLES });
});

// POST /api/monsters/generate
monstersRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const input = parseBody(generateMonsterSchema, req.body);
    const monster = generateProceduralMonster(input);
    res.json({ monster });
  }),
);

// GET /api/monsters
monstersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = monsterQuerySchema.parse(req.query);
    const monsters = searchShadowdarkMonsters({
      search: query.search,
      level: query.level,
      alignment: query.alignment,
    });
    res.json({ monsters });
  }),
);

// GET /api/monsters/:id
monstersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const monster = getShadowdarkMonster(req.params.id);
    if (!monster) {
      throw new ApiError(404, "NOT_FOUND", "Monster not found");
    }
    res.json({ monster });
  }),
);

