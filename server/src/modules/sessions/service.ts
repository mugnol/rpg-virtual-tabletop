import { prisma } from "../../db.js";
import { ApiError } from "../../middleware/errors.js";
import { assertOwner, assertParticipant, findCampaign } from "../campaigns/service.js";
import type { SessionCreateInput, SessionUpdateInput } from "./schemas.js";

const SESSION_NOT_FOUND = new ApiError(404, "NOT_FOUND", "Game session not found");

export async function findSessionWithCampaign(sessionId: string) {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      campaign: {
        include: {
          members: { include: { user: true } },
          invites: true,
        },
      },
    },
  });
  if (!session) {
    throw SESSION_NOT_FOUND;
  }
  return session;
}

export function toSessionDetail(session: {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: session.id,
    campaignId: session.campaignId,
    name: session.name,
    description: session.description,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function listCampaignSessions(userId: string, campaignId: string) {
  const campaign = await findCampaign(campaignId);
  assertParticipant(campaign, userId);

  const sessions = await prisma.gameSession.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
  });
  return sessions.map(toSessionDetail);
}

export async function createSession(
  userId: string,
  campaignId: string,
  input: SessionCreateInput,
) {
  const campaign = await findCampaign(campaignId);
  assertOwner(campaign, userId);

  const session = await prisma.gameSession.create({
    data: {
      campaignId,
      name: input.name,
      description: input.description,
      status: "SCHEDULED",
    },
  });
  return toSessionDetail(session);
}

export async function getSession(userId: string, sessionId: string) {
  const session = await findSessionWithCampaign(sessionId);
  assertParticipant(session.campaign, userId);
  return toSessionDetail(session);
}

export async function updateSession(
  userId: string,
  sessionId: string,
  input: SessionUpdateInput,
) {
  const session = await findSessionWithCampaign(sessionId);
  assertOwner(session.campaign, userId);

  let startedAt = session.startedAt;
  let endedAt = session.endedAt;

  if (input.status === "ACTIVE" && !startedAt) {
    startedAt = new Date();
  }
  if (input.status === "ENDED" && !endedAt) {
    endedAt = new Date();
  }

  const updated = await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status, startedAt, endedAt } : {}),
    },
  });
  return toSessionDetail(updated);
}

export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  const session = await findSessionWithCampaign(sessionId);
  assertOwner(session.campaign, userId);
  await prisma.gameSession.delete({ where: { id: sessionId } });
}

export async function listSessionMessages(
  userId: string,
  sessionId: string,
  limit = 50,
) {
  const session = await findSessionWithCampaign(sessionId);
  assertParticipant(session.campaign, userId);

  const messages = await prisma.sessionMessage.findMany({
    where: { sessionId, deleted: false },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return messages.map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    userId: m.userId,
    userName: m.user?.displayName ?? "System",
    type: m.type,
    content: m.content,
    deleted: m.deleted,
    createdAt: m.createdAt,
  }));
}
