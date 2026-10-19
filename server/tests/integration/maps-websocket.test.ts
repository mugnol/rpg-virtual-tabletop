import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db.js";
import { signSessionToken } from "../../src/lib/tokens.js";
import { attachWebSocketServer, closeWebSocketServer } from "../../src/websocket/server.js";
import { createPc, createSystemCampaign, joinPlayer, registerAgent } from "../helpers.js";

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
      } catch {}
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
      reject(new Error(`Timed out waiting for WebSocket message after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.waiters.push(waiter);
  });
}

describe("WebSocket Real-time Maps, Tokens & Combat (BR-35..BR-50)", () => {
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

  it("delivers default map on session_state, syncs token movement and combat in real-time", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`ws-map-gm-${seq}@test.dev`, "GM", "WS Map GM");
    const playerAgent = await registerAgent(`ws-map-p-${seq}@test.dev`, "PLAYER", "WS Map Player");
    const campaignId = (await createSystemCampaign(gmAgent, `WS Map Camp ${seq}`)).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);
    const sheet = await createPc(playerAgent, campaignId, "WS Hero");
    const sheetId = sheet.id as string;

    const sessionId = (
      await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Tactical Arena" })
    ).body.session.id;

    const gmUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-map-gm-${seq}@test.dev` },
    });
    const playerUser = await prisma.user.findUniqueOrThrow({
      where: { email: `ws-map-p-${seq}@test.dev` },
    });
    const gmToken = await signSessionToken(gmUser.id);
    const playerToken = await signSessionToken(playerUser.id);

    const gmWs = await connectWs(testServer!.port, sessionId, gmToken);
    const playerWs = await connectWs(testServer!.port, sessionId, playerToken);

    const gmState = await waitForMessage(gmWs, (msg) => msg.type === "session_state");
    const playerState = await waitForMessage(playerWs, (msg) => msg.type === "session_state");

    expect(Array.isArray(gmState.maps)).toBe(true);
    expect((gmState.maps as any[]).length).toBeGreaterThanOrEqual(1);
    const mapId = (gmState.maps as any[])[0].id;

    // GM places character token; playerWs receives token_placed
    const placePromise = waitForMessage(playerWs, (msg) => msg.type === "token_placed");
    gmWs.send(
      JSON.stringify({
        type: "place_token",
        mapId,
        token: {
          type: "CHARACTER",
          characterSheetId: sheetId,
          x: 2,
          y: 2,
        },
      }),
    );
    const placedMsg = await placePromise;
    expect((placedMsg.token as any).name).toBe("WS Hero");
    const tokenId = (placedMsg.token as any).id;
    // GM enables player movement; playerWs receives map_updated
    const mapUpdatedPromise = waitForMessage(playerWs, (msg) => msg.type === "map_updated");
    gmWs.send(
      JSON.stringify({
        type: "update_map",
        mapId,
        data: { allowPlayerMovement: true },
      }),
    );
    await mapUpdatedPromise;

    // Player moves their character token; GM receives token_moved
    const movePromise = waitForMessage(gmWs, (msg) => msg.type === "token_moved");
    playerWs.send(
      JSON.stringify({
        type: "move_token",
        tokenId,
        x: 3,
        y: 3,
      }),
    );
    const movedMsg = await movePromise;
    expect((movedMsg.token as any).x).toBe(3);
    expect((movedMsg.token as any).y).toBe(3);

    // GM places a Monster
    const monsterPromise = waitForMessage(playerWs, (msg) => msg.type === "token_placed");
    gmWs.send(
      JSON.stringify({
        type: "place_token",
        mapId,
        token: {
          type: "MONSTER",
          name: "Cave Troll",
          hpMax: 30,
          hpCurrent: 30,
          ac: 14,
          x: 5,
          y: 5,
        },
      }),
    );
    const trollMsg = await monsterPromise;
    const trollId = (trollMsg.token as any).id;

    // GM starts combat; both clients receive combat_started
    const combatPromise = waitForMessage(playerWs, (msg) => msg.type === "combat_started");
    gmWs.send(JSON.stringify({ type: "start_combat", mapId }));
    const combatMsg = await combatPromise;
    expect((combatMsg.combat as any).active).toBe(true);
    expect((combatMsg.combat as any).turnOrder.length).toBe(2);

    // GM triggers combat attack; playerWs receives combat_attack
    const attackPromise = waitForMessage(playerWs, (msg) => msg.type === "combat_attack");
    gmWs.send(
      JSON.stringify({
        type: "combat_attack",
        mapId,
        attackerId: tokenId,
        targetId: trollId,
        forcedD20: 18,
      }),
    );
    const attackMsg = await attackPromise;
    expect((attackMsg.attack as any).hit).toBe(true);
    expect((attackMsg.targetToken as any).hpCurrent).toBeLessThan(30);

    // GM ends combat; playerWs receives combat_ended
    const endPromise = waitForMessage(playerWs, (msg) => msg.type === "combat_ended");
    gmWs.send(JSON.stringify({ type: "end_combat", mapId }));
    const endMsg = await endPromise;
    expect((endMsg.combat as any).active).toBe(false);

    gmWs.close();
    playerWs.close();
  });
});
