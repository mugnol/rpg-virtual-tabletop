import { Router, type Request, type Response } from "express";
import { prisma } from "../../db.js";
import { asyncHandler } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError } from "../../middleware/errors.js";
import { ensureThemesSeeded } from "../themes/service.js";

export const usersRouter = Router();

const SUPPORTED_LOCALES = ["en", "pt-BR"];

usersRouter.patch(
  "/me/preferences",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { preferredTheme, preferredLocale } = req.body ?? {};

    if (preferredLocale !== undefined) {
      if (typeof preferredLocale !== "string" || !SUPPORTED_LOCALES.includes(preferredLocale)) {
        throw new ApiError(400, "INVALID_LOCALE", `Locale must be one of: ${SUPPORTED_LOCALES.join(", ")}`);
      }
    }

    if (preferredTheme !== undefined) {
      if (typeof preferredTheme !== "string" || preferredTheme.trim() === "") {
        throw new ApiError(400, "INVALID_THEME", "Theme key must be a non-empty string");
      }
      await ensureThemesSeeded();
      const theme = await prisma.themeConfig.findUnique({
        where: { key: preferredTheme },
      });
      if (!theme) {
        throw new ApiError(404, "THEME_NOT_FOUND", `Theme "${preferredTheme}" not found`);
      }
    }

    const data: { preferredTheme?: string; preferredLocale?: string } = {};
    if (preferredTheme !== undefined) data.preferredTheme = preferredTheme;
    if (preferredLocale !== undefined) data.preferredLocale = preferredLocale;

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });

    res.json({
      preferences: {
        preferredTheme: updated.preferredTheme,
        preferredLocale: updated.preferredLocale,
      },
    });
  }),
);
