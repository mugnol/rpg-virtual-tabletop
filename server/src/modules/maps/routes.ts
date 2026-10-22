import { Router } from "express";
import { asyncHandler, parseBody } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  combatAttackSchema,
  combatNextSchema,
  combatReorderSchema,
  combatRollInitiativeSchema,
  combatSetInitiativeSchema,
  combatSettingsSchema,
  combatStartSchema,
  combatSurpriseSchema,
  combatTimerCreateSchema,
  mapCreateSchema,
  mapUpdateSchema,
  tokenCreateSchema,
  tokenUpdateSchema,
} from "./schemas.js";
import {
  addCombatTimer,
  createSessionMap,
  deleteToken,
  endCombat,
  executeCombatAttack,
  getMap,
  listSessionMaps,
  moveOrUpdateToken,
  nextCombatTurn,
  placeToken,
  previousCombatTurn,
  removeCombatTimer,
  reorderCombatTurnQueue,
  rollCombatInitiative,
  setCombatInitiative,
  startCombat,
  toggleTokenSurprise,
  updateCombatSettings,
  updateMap,
} from "./service.js";

// Session Maps Router (mounted at /api/sessions/:sessionId/maps)
export const sessionMapsRouter = Router({ mergeParams: true });
sessionMapsRouter.use(requireAuth);

sessionMapsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const maps = await listSessionMaps(req.user!.id, req.params.sessionId);
    res.json({ maps });
  }),
);

sessionMapsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parseBody(mapCreateSchema, req.body);
    const map = await createSessionMap(req.user!.id, req.params.sessionId, input);
    res.status(201).json({ map });
  }),
);

// Maps Router (mounted at /api/maps)
export const mapsRouter = Router();
mapsRouter.use(requireAuth);

mapsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const map = await getMap(req.user!.id, req.params.id);
    res.json({ map });
  }),
);

mapsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parseBody(mapUpdateSchema, req.body);
    const map = await updateMap(req.user!.id, req.params.id, input);
    res.json({ map });
  }),
);

mapsRouter.post(
  "/:id/tokens",
  asyncHandler(async (req, res) => {
    const input = parseBody(tokenCreateSchema, req.body);
    const token = await placeToken(req.user!.id, req.params.id, input);
    res.status(201).json({ token });
  }),
);

// Combat routes on /api/maps/:id/combat/*
mapsRouter.post(
  "/:id/combat/start",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatStartSchema, req.body ?? {});
    const result = await startCombat(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

mapsRouter.post(
  "/:id/combat/initiative/roll",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatRollInitiativeSchema, req.body ?? {});
    const result = await rollCombatInitiative(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

mapsRouter.patch(
  "/:id/combat/initiative",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatSetInitiativeSchema, req.body);
    const result = await setCombatInitiative(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

mapsRouter.post(
  "/:id/combat/initiative",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatSetInitiativeSchema, req.body);
    const result = await setCombatInitiative(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

mapsRouter.post(
  "/:id/combat/surprise",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatSurpriseSchema, req.body);
    const result = await toggleTokenSurprise(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

mapsRouter.post(
  "/:id/combat/reorder",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatReorderSchema, req.body ?? {});
    const result = await reorderCombatTurnQueue(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

mapsRouter.patch(
  "/:id/combat/settings",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatSettingsSchema, req.body ?? {});
    const result = await updateCombatSettings(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

mapsRouter.post(
  "/:id/combat/next",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatNextSchema, req.body ?? {});
    const combat = await nextCombatTurn(req.user!.id, req.params.id, input);
    res.json({ combat });
  }),
);

mapsRouter.post(
  "/:id/combat/end-turn",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatNextSchema, req.body ?? {});
    const combat = await nextCombatTurn(req.user!.id, req.params.id, input);
    res.json({ combat });
  }),
);

mapsRouter.post(
  "/:id/combat/prev",
  asyncHandler(async (req, res) => {
    const combat = await previousCombatTurn(req.user!.id, req.params.id);
    res.json({ combat });
  }),
);

mapsRouter.post(
  "/:id/combat/previous",
  asyncHandler(async (req, res) => {
    const combat = await previousCombatTurn(req.user!.id, req.params.id);
    res.json({ combat });
  }),
);

mapsRouter.post(
  "/:id/combat/timers",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatTimerCreateSchema, req.body);
    const combat = await addCombatTimer(req.user!.id, req.params.id, input);
    res.status(201).json({ combat });
  }),
);

mapsRouter.delete(
  "/:id/combat/timers/:timerId",
  asyncHandler(async (req, res) => {
    const combat = await removeCombatTimer(req.user!.id, req.params.id, req.params.timerId);
    res.json({ combat });
  }),
);

mapsRouter.post(
  "/:id/combat/attack",
  asyncHandler(async (req, res) => {
    const input = parseBody(combatAttackSchema, req.body);
    const result = await executeCombatAttack(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

mapsRouter.post(
  "/:id/combat/end",
  asyncHandler(async (req, res) => {
    const combat = await endCombat(req.user!.id, req.params.id);
    res.json({ combat });
  }),
);

// Tokens Router (mounted at /api/tokens)
export const tokensRouter = Router();
tokensRouter.use(requireAuth);

tokensRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parseBody(tokenUpdateSchema, req.body);
    const token = await moveOrUpdateToken(req.user!.id, req.params.id, input);
    res.json({ token });
  }),
);

tokensRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteToken(req.user!.id, req.params.id);
    res.status(204).end();
  }),
);
