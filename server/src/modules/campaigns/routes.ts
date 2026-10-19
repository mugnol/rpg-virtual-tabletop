import { Router } from "express";
import { asyncHandler, parseBody } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { campaignSheetsRouter } from "../sheets/routes.js";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  joinSchema,
} from "./schemas.js";
import {
  createCampaign,
  createInvite,
  deleteCampaign,
  getCampaignForUser,
  joinCampaign,
  listCampaigns,
  updateCampaign,
} from "./service.js";

export const campaignsRouter = Router();

campaignsRouter.use(requireAuth);

campaignsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ campaigns: await listCampaigns(req.user!.id) });
  }),
);

campaignsRouter.post(
  "/",
  requireRole("GM"),
  asyncHandler(async (req, res) => {
    const input = parseBody(campaignCreateSchema, req.body);
    res.status(201).json({ campaign: await createCampaign(req.user!.id, input) });
  }),
);

// Registered before "/:id" so "join" is never treated as a campaign id.
campaignsRouter.post(
  "/join",
  asyncHandler(async (req, res) => {
    const { token } = parseBody(joinSchema, req.body);
    res.json({ campaign: await joinCampaign(req.user!.id, token) });
  }),
);

campaignsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ campaign: await getCampaignForUser(req.user!.id, req.params.id) });
  }),
);

campaignsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parseBody(campaignUpdateSchema, req.body);
    res.json({ campaign: await updateCampaign(req.user!.id, req.params.id, input) });
  }),
);

campaignsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteCampaign(req.user!.id, req.params.id);
    res.status(204).end();
  }),
);

campaignsRouter.post(
  "/:id/invites",
  asyncHandler(async (req, res) => {
    res.status(201).json({ invite: await createInvite(req.user!.id, req.params.id) });
  }),
);

campaignsRouter.use("/:id/sheets", campaignSheetsRouter);
