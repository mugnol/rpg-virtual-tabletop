import http from "node:http";
import type { User } from "@prisma/client";
import WebSocket, { WebSocketServer } from "ws";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { verifySessionToken } from "../lib/tokens.js";
import { rollDice } from "../modules/dice/dice.js";
import { findSessionWithCampaign } from "../modules/sessions/service.js";

interface SessionClient {
  ws: WebSocket;
  user: User;
  sessionId: string;
}

interface PresenceUser {
  userId: string;
  displayName: string;
  role: string;
}

let wss: WebSocketServer | null = null;
const rooms = new Map<string, Set<SessionClient>>();

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name) {
      list[name] = decodeURIComponent(rest.join("="));
    }
  }
  return list;
}

function broadcastToRoom(sessionId: string, payload: unknown, excludeWs?: WebSocket): void {
  const room = rooms.get(sessionId);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const client of room) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function getRoomPresence(sessionId: string): PresenceUser[] {
  const room = rooms.get(sessionId);
  if (!room) return [];
  const map = new Map<string, PresenceUser>();
  for (const client of room) {
    if (!map.has(client.user.id)) {
      map.set(client.user.id, {
        userId: client.user.id,
        displayName: client.user.displayName,
        role: client.user.role,
      });
    }
  }
  return Array.from(map.values());
}

export function closeWebSocketServer(): void {
  if (wss) {
    for (const room of rooms.values()) {
      for (const client of room) {
        client.ws.close();
      }
    }
    rooms.clear();
    wss.close();
    wss = null;
  }
}

export function attachWebSocketServer(server: http.Server): WebSocketServer {
  closeWebSocketServer();

  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const match = /^\/ws\/sessions\/([a-z0-9_-]+)$/i.exec(url.pathname);
      if (!match) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      const sessionId = match[1];
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[config.cookieName] ?? url.searchParams.get("token");

      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      let userId: string;
      try {
        userId = await verifySessionToken(token);
      } catch {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      let session;
      try {
        session = await findSessionWithCampaign(sessionId);
      } catch {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      const isParticipant =
        session.campaign.ownerId === user.id ||
        session.campaign.members.some((m) => m.userId === user.id);

      if (!isParticipant) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      wss!.handleUpgrade(req, socket, head, (ws) => {
        const client: SessionClient = { ws, user, sessionId };

        if (!rooms.has(sessionId)) {
          rooms.set(sessionId, new Set());
        }
        rooms.get(sessionId)!.add(client);

        // Send initial session state to the newly connected client
        prisma.sessionMessage
          .findMany({
            where: { sessionId, deleted: false },
            include: { user: { select: { id: true, displayName: true } } },
            orderBy: { createdAt: "asc" },
            take: 50,
          })
          .then((messages) => {
            const presence = getRoomPresence(sessionId);
            ws.send(
              JSON.stringify({
                type: "session_state",
                session: {
                  id: session.id,
                  campaignId: session.campaignId,
                  name: session.name,
                  description: session.description,
                  status: session.status,
                  startedAt: session.startedAt,
                  endedAt: session.endedAt,
                },
                presence,
                messages: messages.map((m) => ({
                  id: m.id,
                  sessionId: m.sessionId,
                  userId: m.userId,
                  userName: m.user?.displayName ?? "System",
                  type: m.type,
                  content: m.content,
                  deleted: m.deleted,
                  createdAt: m.createdAt,
                })),
              }),
            );

            // Broadcast presence to all other participants
            broadcastToRoom(sessionId, { type: "presence_update", presence }, ws);
          });

        ws.on("message", async (raw) => {
          try {
            const payload = JSON.parse(raw.toString()) as Record<string, unknown>;
            const currentSession = await findSessionWithCampaign(sessionId);
            const isOwner = currentSession.campaign.ownerId === user.id;

            switch (payload.type) {
              case "chat_message": {
                if (currentSession.status === "PAUSED" && !isOwner) {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      code: "PAUSED",
                      message: "Session is paused by the GM",
                    }),
                  );
                  return;
                }
                if (currentSession.status === "ENDED") {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      code: "ENDED",
                      message: "Session has ended",
                    }),
                  );
                  return;
                }
                const content = typeof payload.content === "string" ? payload.content.trim() : "";
                if (!content) return;

                const msg = await prisma.sessionMessage.create({
                  data: {
                    sessionId,
                    userId: user.id,
                    type: "TEXT",
                    content,
                  },
                });

                broadcastToRoom(sessionId, {
                  type: "chat_message",
                  message: {
                    id: msg.id,
                    sessionId: msg.sessionId,
                    userId: user.id,
                    userName: user.displayName,
                    type: "TEXT",
                    content: msg.content,
                    deleted: false,
                    createdAt: msg.createdAt,
                  },
                });
                break;
              }

              case "roll_dice": {
                if (currentSession.status === "PAUSED" && !isOwner) {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      code: "PAUSED",
                      message: "Session is paused by the GM",
                    }),
                  );
                  return;
                }
                if (currentSession.status === "ENDED") {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      code: "ENDED",
                      message: "Session has ended",
                    }),
                  );
                  return;
                }

                const formula = typeof payload.formula === "string" ? payload.formula : "d20";
                const label = typeof payload.label === "string" ? payload.label : undefined;

                try {
                  const rollResult = rollDice(formula, label);
                  const msg = await prisma.sessionMessage.create({
                    data: {
                      sessionId,
                      userId: user.id,
                      type: "DICE",
                      content: JSON.stringify(rollResult),
                    },
                  });

                  broadcastToRoom(sessionId, {
                    type: "dice_roll",
                    roll: {
                      id: msg.id,
                      userId: user.id,
                      userName: user.displayName,
                      ...rollResult,
                      createdAt: msg.createdAt,
                    },
                  });
                } catch (err) {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      code: "INVALID_FORMULA",
                      message: err instanceof Error ? err.message : "Invalid dice formula",
                    }),
                  );
                }
                break;
              }

              case "delete_message": {
                if (!isOwner) {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      code: "FORBIDDEN",
                      message: "Only the GM can delete messages",
                    }),
                  );
                  return;
                }
                const messageId = typeof payload.messageId === "string" ? payload.messageId : "";
                if (!messageId) return;

                await prisma.sessionMessage.update({
                  where: { id: messageId },
                  data: { deleted: true },
                });

                broadcastToRoom(sessionId, {
                  type: "message_deleted",
                  messageId,
                });
                break;
              }

              case "set_status": {
                if (!isOwner) {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      code: "FORBIDDEN",
                      message: "Only the GM can change session status",
                    }),
                  );
                  return;
                }
                const newStatus = payload.status as "ACTIVE" | "PAUSED" | "ENDED";
                if (!["ACTIVE", "PAUSED", "ENDED"].includes(newStatus)) return;

                let startedAt = currentSession.startedAt;
                let endedAt = currentSession.endedAt;
                if (newStatus === "ACTIVE" && !startedAt) startedAt = new Date();
                if (newStatus === "ENDED" && !endedAt) endedAt = new Date();

                await prisma.gameSession.update({
                  where: { id: sessionId },
                  data: { status: newStatus, startedAt, endedAt },
                });

                broadcastToRoom(sessionId, {
                  type: "status_changed",
                  status: newStatus,
                });
                break;
              }

              default:
                break;
            }
          } catch (err) {
            console.error("[ws message error]", err);
          }
        });

        ws.on("close", () => {
          const room = rooms.get(sessionId);
          if (room) {
            room.delete(client);
            if (room.size === 0) {
              rooms.delete(sessionId);
            } else {
              broadcastToRoom(sessionId, {
                type: "presence_update",
                presence: getRoomPresence(sessionId),
              });
            }
          }
        });
      });
    } catch {
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    }
  });

  return wss;
}
