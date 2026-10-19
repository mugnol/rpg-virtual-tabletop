import { z } from "zod";

export const sessionCreateSchema = z.object({
  name: z.string().trim().min(1, "Session name is required").max(100),
  description: z.string().trim().max(500).default(""),
});

export const sessionUpdateSchema = z.object({
  name: z.string().trim().min(1, "Session name is required").max(100).optional(),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["SCHEDULED", "ACTIVE", "PAUSED", "ENDED"]).optional(),
});

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;
