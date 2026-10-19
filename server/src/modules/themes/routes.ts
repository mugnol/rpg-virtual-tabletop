import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../lib/http.js";
import {
  exportTheme,
  getTheme,
  importTheme,
  listThemes,
} from "./service.js";

export const themesRouter = Router();

themesRouter.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const themes = await listThemes();
    res.json({ themes });
  }),
);

themesRouter.get(
  "/:key",
  asyncHandler(async (req: Request, res: Response) => {
    const theme = await getTheme(req.params.key);
    res.json({ theme });
  }),
);

themesRouter.get(
  "/:key/export",
  asyncHandler(async (req: Request, res: Response) => {
    const { filename, raw } = await exportTheme(req.params.key);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(raw);
  }),
);

themesRouter.post(
  "/import",
  asyncHandler(async (req: Request, res: Response) => {
    const { theme, created } = await importTheme(req.body);
    res.status(created ? 201 : 200).json({ theme });
  }),
);
