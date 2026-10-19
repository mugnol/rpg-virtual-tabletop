import { describe, expect, it } from "vitest";
import {
  createSystemCampaign,
  guest,
  joinPlayer,
  registerAgent,
  type ApiAgent,
} from "../helpers.js";

interface Fixture {
  gm: ApiAgent;
  player: ApiAgent;
  other: ApiAgent;
  campaignId: string;
}

let seq = 0;

async function setup(): Promise<Fixture> {
  seq += 1;
  const gm = await registerAgent(`sess-gm-${seq}@test.dev`, "GM", "Session GM");
  const player = await registerAgent(`sess-p-${seq}@test.dev`, "PLAYER", "Session Player");
  const other = await registerAgent(`sess-o-${seq}@test.dev`, "PLAYER", "Session Other");
  const campaignId = (await createSystemCampaign(gm, `Sessions Campaign ${seq}`, "shadowdark")).id;
  await joinPlayer(gm, player, campaignId);
  return { gm, player, other, campaignId };
}

describe("Sessions REST API (UC-26, UC-27)", () => {
  it("GM can create a game session (201) with default SCHEDULED status", async () => {
    const { gm, campaignId } = await setup();
    const res = await gm.post(`/api/campaigns/${campaignId}/sessions`).send({
      name: "Chapter 1: The Dark Forest",
      description: "First session in the woods.",
    });
    expect(res.status).toBe(201);
    const session = res.body.session;
    expect(session).toMatchObject({
      name: "Chapter 1: The Dark Forest",
      description: "First session in the woods.",
      status: "SCHEDULED",
      campaignId,
    });
    expect(session.id).toBeDefined();
  });

  it("players cannot create a session (403)", async () => {
    const { player, campaignId } = await setup();
    const res = await player.post(`/api/campaigns/${campaignId}/sessions`).send({
      name: "Unauthorized Session",
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("guests get 401; non-campaign participants get 404 (existence not revealed)", async () => {
    const { gm, other, campaignId } = await setup();
    const created = (
      await gm.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Auth Test Session" })
    ).body.session;

    expect((await guest().get(`/api/campaigns/${campaignId}/sessions`)).status).toBe(401);
    expect((await guest().get(`/api/sessions/${created.id}`)).status).toBe(401);

    expect((await other.get(`/api/campaigns/${campaignId}/sessions`)).status).toBe(404);
    expect((await other.get(`/api/sessions/${created.id}`)).status).toBe(404);
  });

  it("campaign participants can list sessions and get session details", async () => {
    const { gm, player, campaignId } = await setup();
    await gm.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Session 1" });
    await gm.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Session 2" });

    const listRes = await player.get(`/api/campaigns/${campaignId}/sessions`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.sessions.length).toBe(2);
    const names = listRes.body.sessions.map((s: { name: string }) => s.name);
    expect(names).toContain("Session 1");
    expect(names).toContain("Session 2");

    const detailRes = await player.get(`/api/sessions/${listRes.body.sessions[0].id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.session.id).toBe(listRes.body.sessions[0].id);
  });

  it("GM can update session status (SCHEDULED -> ACTIVE -> PAUSED -> ENDED) (UC-27)", async () => {
    const { gm, player, campaignId } = await setup();
    const session = (
      await gm.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Lifecycle Session" })
    ).body.session;

    // Start session
    const started = await gm.patch(`/api/sessions/${session.id}`).send({ status: "ACTIVE" });
    expect(started.status).toBe(200);
    expect(started.body.session.status).toBe("ACTIVE");
    expect(started.body.session.startedAt).toBeDefined();

    // Pause session
    const paused = await gm.patch(`/api/sessions/${session.id}`).send({ status: "PAUSED" });
    expect(paused.status).toBe(200);
    expect(paused.body.session.status).toBe("PAUSED");

    // Player cannot change status
    const playerAttempt = await player.patch(`/api/sessions/${session.id}`).send({ status: "ACTIVE" });
    expect(playerAttempt.status).toBe(403);

    // End session
    const ended = await gm.patch(`/api/sessions/${session.id}`).send({ status: "ENDED" });
    expect(ended.status).toBe(200);
    expect(ended.body.session.status).toBe("ENDED");
    expect(ended.body.session.endedAt).toBeDefined();
  });

  it("messages endpoint returns session messages list", async () => {
    const { gm, player, campaignId } = await setup();
    const session = (
      await gm.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Messages Test" })
    ).body.session;

    const res = await player.get(`/api/sessions/${session.id}/messages`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });
});
