import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { generateInviteToken } from "../../lib/tokens.js";
import { ApiError } from "../../middleware/errors.js";
import type { CampaignCreateInput, CampaignUpdateInput } from "./schemas.js";

export const campaignInclude = {
  members: { include: { user: true }, orderBy: { joinedAt: "asc" as const } },
  invites: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.CampaignInclude;

export type CampaignWithRelations = Prisma.CampaignGetPayload<{
  include: typeof campaignInclude;
}>;

const CAMPAIGN_NOT_FOUND = new ApiError(404, "NOT_FOUND", "Campaign not found");
const INVITE_EXPIRED = new ApiError(
  410,
  "INVITE_EXPIRED",
  "This invite code has expired or already been used",
);
const NOT_OWNER = new ApiError(403, "FORBIDDEN", "Only the campaign owner can do this");

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function findCampaign(id: string): Promise<CampaignWithRelations> {
  const campaign = await prisma.campaign.findUnique({ where: { id }, include: campaignInclude });
  if (!campaign) {
    throw CAMPAIGN_NOT_FOUND;
  }
  return campaign;
}

function isParticipant(campaign: CampaignWithRelations, userId: string): boolean {
  return campaign.ownerId === userId || campaign.members.some((m) => m.userId === userId);
}

function assertParticipant(campaign: CampaignWithRelations, userId: string): void {
  if (!isParticipant(campaign, userId)) {
    // Existence is not revealed to non-participants (EF-7.1).
    throw CAMPAIGN_NOT_FOUND;
  }
}

function assertOwner(campaign: CampaignWithRelations, userId: string): void {
  assertParticipant(campaign, userId);
  if (campaign.ownerId !== userId) {
    throw NOT_OWNER;
  }
}

export function toListItem(campaign: CampaignWithRelations, userId: string) {
  return {
    id: campaign.id,
    name: campaign.name,
    system: campaign.system,
    archived: campaign.archived,
    relationship: campaign.ownerId === userId ? "OWNER" : "PLAYER",
    updatedAt: campaign.updatedAt,
  };
}

export function toDetail(campaign: CampaignWithRelations, userId: string) {
  const isOwner = campaign.ownerId === userId;
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    system: campaign.system,
    archived: campaign.archived,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    members: campaign.members.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      role: campaign.ownerId === m.userId ? "OWNER" : "PLAYER",
      joinedAt: m.joinedAt,
    })),
    // Active (unused, unexpired) codes only — the owner shares these (UC-11).
    invites: isOwner
      ? campaign.invites
          .filter((i) => i.usedAt === null && i.expiresAt.getTime() > Date.now())
          .map((i) => ({ id: i.id, token: i.token, expiresAt: i.expiresAt, createdAt: i.createdAt }))
      : [],
  };
}

export async function listCampaigns(userId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: campaignInclude,
    orderBy: { updatedAt: "desc" },
  });
  return campaigns.map((c) => toListItem(c, userId));
}

export async function createCampaign(userId: string, input: CampaignCreateInput) {
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: { name: input.name, description: input.description, system: input.system, ownerId: userId },
    });
    await tx.campaignMember.create({ data: { campaignId: created.id, userId } });
    return tx.campaign.findUniqueOrThrow({ where: { id: created.id }, include: campaignInclude });
  });
  return toDetail(campaign, userId);
}

export async function getCampaignForUser(userId: string, campaignId: string) {
  const campaign = await findCampaign(campaignId);
  assertParticipant(campaign, userId);
  return toDetail(campaign, userId);
}

export async function updateCampaign(userId: string, campaignId: string, input: CampaignUpdateInput) {
  const existing = await findCampaign(campaignId);
  assertOwner(existing, userId);
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: input,
    include: campaignInclude,
  });
  return toDetail(campaign, userId);
}

export async function deleteCampaign(userId: string, campaignId: string): Promise<void> {
  const existing = await findCampaign(campaignId);
  assertOwner(existing, userId);
  await prisma.campaign.delete({ where: { id: campaignId } });
}

export async function createInvite(userId: string, campaignId: string) {
  const campaign = await findCampaign(campaignId);
  assertOwner(campaign, userId);
  const invite = await prisma.campaignInvite.create({
    data: {
      campaignId,
      createdById: userId,
      token: generateInviteToken(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  return { id: invite.id, token: invite.token, expiresAt: invite.expiresAt, createdAt: invite.createdAt };
}

export async function joinCampaign(userId: string, token: string) {
  const invite = await prisma.campaignInvite.findUnique({
    where: { token },
    include: { campaign: { include: campaignInclude } },
  });
  if (!invite) {
    throw new ApiError(404, "NOT_FOUND", "Invalid invite code");
  }
  if (invite.usedAt !== null || invite.expiresAt.getTime() <= Date.now()) {
    throw INVITE_EXPIRED;
  }
  const campaign = invite.campaign;
  if (campaign.ownerId === userId || campaign.members.some((m) => m.userId === userId)) {
    throw new ApiError(409, "ALREADY_MEMBER", "You are already a member of this campaign");
  }
  await prisma.$transaction([
    prisma.campaignInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
    prisma.campaignMember.create({ data: { campaignId: campaign.id, userId } }),
  ]);
  return getCampaignForUser(userId, campaign.id);
}
