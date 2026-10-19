import { Router } from "express";
import { asyncHandler, parseBody } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { sessionMapsRouter } from "../maps/routes.js";
import { sessionCreateSchema, sessionUpdateSchema } from "./schemas.js";
import {
  createSession,
  deleteSession,
  getSession,
  listCampaignSessions,
  listSessionMessages,
  updateSession,
} from "./service.js";

/** Mounted at /api/campaigns/:id/sessions (mergeParams: true). */
export const campaignSessionsRouter = Router({ mergeParams: true });

campaignSessionsRouter.use(requireAuth);

campaignSessionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ sessions: await listCampaignSessions(req.user!.id, req.params.id) });
  }),
);

campaignSessionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parseBody(sessionCreateSchema, req.body);
    const session = await createSession(req.user!.id, req.params.id, input);
    res.status(201).json({ session });
  }),
);

/** Mounted at /api/sessions. */
export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);
sessionsRouter.use("/:sessionId/maps", sessionMapsRouter);

sessionsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ session: await getSession(req.user!.id, req.params.id) });
  }),
);

sessionsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parseBody(sessionUpdateSchema, req.body);
    res.json({ session: await updateSession(req.user!.id, req.params.id, input) });
  }),
);

sessionsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteSession(req.user!.id, req.params.id);
    res.status(204).end();
  }),
);

sessionsRouter.get(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const limit = Number.parseInt(req.query.limit as string, 10) || 50;
    res.json({ messages: await listSessionMessages(req.user!.id, req.params.id, limit) });
  }),
);
