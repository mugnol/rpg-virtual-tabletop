import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

export interface FieldError {
  path: string;
  message: string;
}

/** Application error with an HTTP status and a machine-readable error code. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: FieldError[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiNotFound(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as { status?: number }).status === 400
  ) {
    res.status(400).json({
      error: { code: "BAD_JSON", message: "Invalid JSON" },
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json({
      error: { code: "CONFLICT", message: "A record with this value already exists" },
    });
    return;
  }
  console.error("[error]", req.method, req.originalUrl, err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong, please try again" },
  });
}
