import { Router } from "express";
import { asyncHandler, parseBody } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  shadowdarkActionSchema,
  sheetCreateSchema,
  sheetGenerateSchema,
  sheetLevelUpSchema,
  sheetUpdateSchema,
} from "./schemas.js";
import {
  createSheet,
  deleteSheet,
  executeShadowdarkAction,
  exportSheetShadowdarklings,
  generateRandomSheet,
  getSheet,
  importSheetShadowdarklings,
  levelUpSheet,
  listCampaignSheets,
  updateSheet,
} from "./service.js";

/** Mounted at /api/campaigns/:id/sheets (mergeParams: true). */
export const campaignSheetsRouter = Router({ mergeParams: true });

campaignSheetsRouter.use(requireAuth);

campaignSheetsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const sheets = await listCampaignSheets(req.user!.id, req.params.id);
    res.json({ sheets });
  }),
);

campaignSheetsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parseBody(sheetCreateSchema, req.body);
    const sheet = await createSheet(req.user!.id, req.params.id, input);
    res.status(201).json({ sheet });
  }),
);

campaignSheetsRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const input = parseBody(sheetGenerateSchema, req.body ?? {});
    const sheet = await generateRandomSheet(req.user!.id, req.params.id, input);
    res.status(201).json({ sheet });
  }),
);

campaignSheetsRouter.post(
  "/shadowdarklings",
  asyncHandler(async (req, res) => {
    const sheet = await importSheetShadowdarklings(
      req.user!.id,
      req.params.id,
      req.body,
    );
    res.status(201).json({ sheet });
  }),
);

/** Mounted at /api/sheets. */
export const sheetsRouter = Router();

sheetsRouter.use(requireAuth);

sheetsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sheet = await getSheet(req.user!.id, req.params.id);
    res.json({ sheet });
  }),
);

sheetsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parseBody(sheetUpdateSchema, req.body);
    const sheet = await updateSheet(req.user!.id, req.params.id, input);
    res.json({ sheet });
  }),
);

sheetsRouter.post(
  "/:id/levelup",
  asyncHandler(async (req, res) => {
    const input = parseBody(sheetLevelUpSchema, req.body ?? {});
    const sheet = await levelUpSheet(req.user!.id, req.params.id, input);
    res.json({ sheet });
  }),
);

sheetsRouter.get(
  "/:id/shadowdarklings",
  asyncHandler(async (req, res) => {
    const character = await exportSheetShadowdarklings(req.user!.id, req.params.id);
    res.json({ character });
  }),
);

sheetsRouter.post(
  "/:id/shadowdark-action",
  asyncHandler(async (req, res) => {
    const input = parseBody(shadowdarkActionSchema, req.body);
    const outcome = await executeShadowdarkAction(req.user!.id, req.params.id, input);
    res.json(outcome);
  }),
);

sheetsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteSheet(req.user!.id, req.params.id);
    res.status(204).end();
  }),
);
