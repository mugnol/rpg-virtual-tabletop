import { Router } from "express";
import { asyncHandler } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { exportSystem, getSystem, importSystem, listSystems } from "./service.js";

export const systemsRouter = Router();

systemsRouter.use(requireAuth);

systemsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ systems: await listSystems() });
  }),
);

systemsRouter.post(
  "/import",
  requireRole("GM"),
  asyncHandler(async (req, res) => {
    const system = await importSystem(req.body);
    res.status(201).json({ system });
  }),
);

systemsRouter.get(
  "/:key/export",
  asyncHandler(async (req, res) => {
    const { filename, raw } = await exportSystem(req.params.key);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(raw);
  }),
);

systemsRouter.get(
  "/:key",
  asyncHandler(async (req, res) => {
    res.json({ system: await getSystem(req.params.key) });
  }),
);
