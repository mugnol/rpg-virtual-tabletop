import { Router, type Request, type Response } from "express";
import { config } from "../../config.js";
import { asyncHandler, parseBody } from "../../lib/http.js";
import { signSessionToken } from "../../lib/tokens.js";
import { requireAuth } from "../../middleware/auth.js";
import { loginSchema, registerSchema } from "./schemas.js";
import { loginUser, registerUser, toPublicUser } from "./service.js";

export const authRouter = Router();

async function issueSessionCookie(_req: Request, res: Response, userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: config.sessionTtlSeconds * 1000,
    path: "/",
  });
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req.body);
    const user = await registerUser(input);
    await issueSessionCookie(req, res, user.id);
    res.status(201).json({ user: toPublicUser(user) });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = parseBody(loginSchema, req.body);
    const user = await loginUser(input);
    await issueSessionCookie(req, res, user.id);
    res.json({ user: toPublicUser(user) });
  }),
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(config.cookieName, { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user!) });
});
