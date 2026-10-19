import { Router } from "express";
import { asyncHandler, parseBody } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { sheetCreateSchema, sheetUpdateSchema } from "./schemas.js";
import {
  createSheet,
  deleteSheet,
  getSheet,
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
    const sheet = await levelUpSheet(req.user!.id, req.params.id);
    res.json({ sheet });
  }),
);

sheetsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteSheet(req.user!.id, req.params.id);
    res.status(204).end();
  }),
);
