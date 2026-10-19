import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../../src/app.js";
import { attachWebSocketServer, closeWebSocketServer } from "../../src/websocket/server.js";
import { signSessionToken } from "../../src/lib/tokens.js";
import { prisma } from "../../src/db.js";
import { createSystemCampaign, joinPlayer, registerAgent } from "../helpers.js";

interface TestServer {
  server: http.Server;
  port: number;
}

let testServer: TestServer | null = null;
let seq = 0;

interface TestWs extends WebSocket {
  receivedMessages: Array<Record<string, unknown>>;
  waiters: Array<{
    predicate: (msg: Record<string, unknown>) => boolean;
    resolve: (msg: Record<string, unknown>) => void;
  }>;
}

function connectWs(port: number, sessionId: string, token: string): Promise<TestWs> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/sessions/${sessionId}`, {
      headers: { Cookie: `rpg_session=${token}` },
    }) as TestWs;

    ws.receivedMessages = [];
    ws.waiters = [];

    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as Record<string, unknown>;
        const waiterIdx = ws.waiters.findIndex((w) => w.predicate(parsed));
        if (waiterIdx !== -1) {
          const [waiter] = ws.waiters.splice(waiterIdx, 1);
          waiter.resolve(parsed);
        } else {
          ws.receivedMessages.push(parsed);
        }
      } catch {
        // ignore non-json
      }
    });

    ws.on("open", () => resolve(ws));
    ws.on("error", (err) => reject(err));
  });
}

function waitForMessage(
  ws: TestWs,
  predicate: (data: Record<string, unknown>) => boolean,
  timeoutMs = 5000,
): Promise<Record<string, unknown>> {
  const existingIdx = ws.receivedMessages.findIndex(predicate);
  if (existingIdx !== -1) {
    const [msg] = ws.receivedMessages.splice(existingIdx, 1);
    return Promise.resolve(msg);
  }

  return new Promise((resolve, reject) => {
    const waiter = {
      predicate,
      resolve: (msg: Record<string, unknown>) => {
        clearTimeout(timer);
        resolve(msg);
      },
    };
    const timer = setTimeout(() => {
      const idx = ws.waiters.indexOf(waiter);
      if (idx !== -1) ws.waiters.splice(idx, 1);
      reject(new Error(`Timed out waiting for WebSocket message after ${timeoutMs}ms. Received: ${JSON.stringify(ws.receivedMessages)}`));
    }, timeoutMs);

    ws.waiters.push(waiter);
  });
}

describe("WebSocket Real-time Sessions & Chat & Dice (BR-28..BR-34)", () => {
  beforeEach(async () => {
    const app = createApp();
    const server = http.createServer(app);
    attachWebSocketServer(server);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    testServer = { server, port };
  });

  afterEach(async () => {
    closeWebSocketServer();
    if (testServer) {
      await new Promise<void>((resolve) => testServer!.server.close(() => resolve()));
      testServer = null;
    }
  });

  it("authenticates connection and delivers session_state with presence and messages", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`ws-gm-${seq}@test.dev`, "GM", "WS GM");
    const campaignId = (await createSystemCampaign(gmAgent, `WS Camp ${seq}`)).id;
    const sessionRes = await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({
      name: "Live Session",
    });
    const sessionId = sessionRes.body.session.id;

    const gmUser = await prisma.user.findUniqueOrThrow({ where: { email: `ws-gm-${seq}@test.dev` } });
    const gmToken = await signSessionToken(gmUser.id);

    const ws = await connectWs(testServer!.port, sessionId, gmToken);
    const stateMsg = await waitForMessage(ws, (msg) => msg.type === "session_state");
    expect(stateMsg.type).toBe("session_state");
    expect((stateMsg.session as { id: string }).id).toBe(sessionId);
    const presence = stateMsg.presence as Array<{ userId: string; displayName: string }>;
    expect(presence.some((p) => p.userId === gmUser.id)).toBe(true);

    ws.close();
  });

  it("rejects unauthorized users with 4404 / connection error", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`ws-gm2-${seq}@test.dev`, "GM", "WS GM 2");
    const otherAgent = await registerAgent(`ws-other-${seq}@test.dev`, "PLAYER", "WS Other");
    const campaignId = (await createSystemCampaign(gmAgent, `WS Camp 2 ${seq}`)).id;
    const sessionId = (
      await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Private Room" })
    ).body.session.id;

    const otherUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-other-${seq}@test.dev` },
    });
    const otherToken = await signSessionToken(otherUser.id);

    await expect(connectWs(testServer!.port, sessionId, otherToken)).rejects.toThrow();
  });

  it("broadcasts presence updates when multiple clients connect and disconnect", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`ws-gm3-${seq}@test.dev`, "GM", "Multi GM");
    const playerAgent = await registerAgent(`ws-p3-${seq}@test.dev`, "PLAYER", "Multi Player");
    const campaignId = (await createSystemCampaign(gmAgent, `WS Camp 3 ${seq}`)).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);

    const sessionRes = await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({
      name: "Presence Session",
    });
    const sessionId = sessionRes.body.session.id;

    const gmUser = await prisma.user.findUniqueOrThrow({ where: { email: `ws-gm3-${seq}@test.dev` } });
    const playerUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-p3-${seq}@test.dev` },
    });
    const gmToken = await signSessionToken(gmUser.id);
    const playerToken = await signSessionToken(playerUser.id);

    const gmWs = await connectWs(testServer!.port, sessionId, gmToken);
    await waitForMessage(gmWs, (msg) => msg.type === "session_state");

    // Player connects; GM should receive presence_update with 2 members
    const presencePromise = waitForMessage(
      gmWs,
      (msg) =>
        msg.type === "presence_update" &&
        Array.isArray(msg.presence) &&
        msg.presence.length === 2,
    );

    const playerWs = await connectWs(testServer!.port, sessionId, playerToken);
    const presenceMsg = await presencePromise;
    expect(presenceMsg.type).toBe("presence_update");

    // Player disconnects; GM receives presence_update with 1 member
    const leavePromise = waitForMessage(
      gmWs,
      (msg) =>
        msg.type === "presence_update" &&
        Array.isArray(msg.presence) &&
        msg.presence.length === 1,
    );
    playerWs.close();
    await leavePromise;

    gmWs.close();
  });

  it("broadcasts real-time chat messages to all connected clients", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`ws-chat-gm-${seq}@test.dev`, "GM", "Chat GM");
    const playerAgent = await registerAgent(`ws-chat-p-${seq}@test.dev`, "PLAYER", "Chat Player");
    const campaignId = (await createSystemCampaign(gmAgent, `Chat Camp ${seq}`)).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);
    const sessionId = (
      await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Chat Session" })
    ).body.session.id;

    const gmUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-chat-gm-${seq}@test.dev` },
    });
    const playerUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-chat-p-${seq}@test.dev` },
    });
    const gmToken = await signSessionToken(gmUser.id);
    const playerToken = await signSessionToken(playerUser.id);

    const gmWs = await connectWs(testServer!.port, sessionId, gmToken);
    const playerWs = await connectWs(testServer!.port, sessionId, playerToken);
    await waitForMessage(gmWs, (msg) => msg.type === "session_state");
    await waitForMessage(playerWs, (msg) => msg.type === "session_state");

    const gmChatPromise = waitForMessage(
      gmWs,
      (msg) =>
        msg.type === "chat_message" &&
        (msg.message as { content: string }).content === "Hello fellow adventurers!",
    );

    playerWs.send(
      JSON.stringify({
        type: "chat_message",
        content: "Hello fellow adventurers!",
      }),
    );

    const received = await gmChatPromise;
    expect((received.message as { userName: string }).userName).toBe("Chat Player");

    gmWs.close();
    playerWs.close();
  });

  it("server validates dice formulas, generates authoritative roll, and broadcasts dice_roll event", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`ws-dice-gm-${seq}@test.dev`, "GM", "Dice GM");
    const playerAgent = await registerAgent(`ws-dice-p-${seq}@test.dev`, "PLAYER", "Dice Player");
    const campaignId = (await createSystemCampaign(gmAgent, `Dice Camp ${seq}`)).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);
    const sessionId = (
      await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Dice Session" })
    ).body.session.id;

    const gmUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-dice-gm-${seq}@test.dev` },
    });
    const playerUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-dice-p-${seq}@test.dev` },
    });
    const gmToken = await signSessionToken(gmUser.id);
    const playerToken = await signSessionToken(playerUser.id);

    const gmWs = await connectWs(testServer!.port, sessionId, gmToken);
    const playerWs = await connectWs(testServer!.port, sessionId, playerToken);
    await waitForMessage(gmWs, (msg) => msg.type === "session_state");
    await waitForMessage(playerWs, (msg) => msg.type === "session_state");

    const rollPromise = waitForMessage(
      gmWs,
      (msg) => msg.type === "dice_roll" && (msg.roll as { formula: string }).formula === "2d6+3",
    );

    playerWs.send(
      JSON.stringify({
        type: "roll_dice",
        formula: "2d6+3",
        label: "Sword Strike",
      }),
    );

    const rollMsg = await rollPromise;
    const roll = rollMsg.roll as {
      formula: string;
      dice: number[];
      modifier: number;
      total: number;
      label?: string;
    };
    expect(roll.formula).toBe("2d6+3");
    expect(roll.dice.length).toBe(2);
    expect(roll.modifier).toBe(3);
    expect(roll.total).toBe(roll.dice[0] + roll.dice[1] + 3);
    expect(roll.label).toBe("Sword Strike");

    gmWs.close();
    playerWs.close();
  });

  it("GM can moderate (delete) messages in real time; players cannot", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`ws-mod-gm-${seq}@test.dev`, "GM", "Mod GM");
    const playerAgent = await registerAgent(`ws-mod-p-${seq}@test.dev`, "PLAYER", "Mod Player");
    const campaignId = (await createSystemCampaign(gmAgent, `Mod Camp ${seq}`)).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);
    const sessionId = (
      await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Mod Session" })
    ).body.session.id;

    const gmUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-mod-gm-${seq}@test.dev` },
    });
    const playerUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-mod-p-${seq}@test.dev` },
    });
    const gmToken = await signSessionToken(gmUser.id);
    const playerToken = await signSessionToken(playerUser.id);

    const gmWs = await connectWs(testServer!.port, sessionId, gmToken);
    const playerWs = await connectWs(testServer!.port, sessionId, playerToken);
    await waitForMessage(gmWs, (msg) => msg.type === "session_state");
    await waitForMessage(playerWs, (msg) => msg.type === "session_state");

    // Player sends message
    const msgPromise = waitForMessage(gmWs, (msg) => msg.type === "chat_message");
    playerWs.send(JSON.stringify({ type: "chat_message", content: "Oops bad word" }));
    const chatEvent = await msgPromise;
    const messageId = (chatEvent.message as { id: string }).id;

    // GM moderates message
    const playerDeletePromise = waitForMessage(
      playerWs,
      (msg) => msg.type === "message_deleted" && msg.messageId === messageId,
    );
    gmWs.send(JSON.stringify({ type: "delete_message", messageId }));
    await playerDeletePromise;

    // Player cannot delete
    const errorPromise = waitForMessage(playerWs, (msg) => msg.type === "error");
    playerWs.send(JSON.stringify({ type: "delete_message", messageId }));
    const errEvent = await errorPromise;
    expect(errEvent.code).toBe("FORBIDDEN");

    gmWs.close();
    playerWs.close();
  });
});
