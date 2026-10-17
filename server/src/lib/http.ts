import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";
import { ApiError } from "../middleware/errors.js";

/** Wraps an async Express handler so rejected promises reach the error handler. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/** Validates a request body with a Zod schema; throws a 400 ApiError with field details. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    );
  }
  return result.data;
}
