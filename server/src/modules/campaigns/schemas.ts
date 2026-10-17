import { z } from "zod";

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(80),
  description: z.string().trim().max(500).default(""),
  system: z.string().trim().max(40).default("generic"),
});

export const campaignUpdateSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(80).optional(),
  description: z.string().trim().max(500).optional(),
  system: z.string().trim().max(40).optional(),
  archived: z.boolean().optional(),
});

export const joinSchema = z.object({
  token: z.string().trim().min(1, "Invite code is required"),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
