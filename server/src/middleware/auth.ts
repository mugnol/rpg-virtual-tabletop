import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { verifySessionToken } from "../lib/tokens.js";
import { ApiError } from "./errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const UNAUTHENTICATED = new ApiError(401, "UNAUTHENTICATED", "Authentication required");

/** Requires a valid session cookie; attaches the fresh user row to req.user. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[config.cookieName];
    if (typeof token !== "string" || token.length === 0) {
      throw UNAUTHENTICATED;
    }
    const userId = await verifySessionToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw UNAUTHENTICATED;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : UNAUTHENTICATED);
  }
}

/** Requires req.user to hold one of the given roles (runs after requireAuth). */
export function requireRole(...roles: Array<User["role"]>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ApiError(403, "FORBIDDEN", "You do not have permission to do this"));
      return;
    }
    next();
  };
}
