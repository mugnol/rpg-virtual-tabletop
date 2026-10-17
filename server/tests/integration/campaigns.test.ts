import { describe, expect, it } from "vitest";
import type { SuperAgentTest } from "supertest";
import { guest, registerAgent } from "../helpers.js";

async function createCampaign(
  gm: SuperAgentTest,
  payload: Record<string, unknown> = { name: "Test Campaign" },
) {
  const res = await gm.post("/api/campaigns").send(payload);
  return res;
}

describe("campaign permissions matrix", () => {
  it("guests cannot use the campaigns API (401)", async () => {
    expect((await guest().get("/api/campaigns")).status).toBe(401);
    expect((await guest().post("/api/campaigns").send({ name: "Nope" })).status).toBe(401);
  });

  it("players cannot create campaigns (403 FORBIDDEN)", async () => {
    const player = await registerAgent("pcreate@test.dev", "PLAYER", "Player Create");
    const res = await player.post("/api/campaigns").send({ name: "Sneaky Campaign" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("GMs can create campaigns (201) with defaults and become OWNER member", async () => {
    const gm = await registerAgent("gmcreate@test.dev", "GM", "GM Create");
    const res = await createCampaign(gm);
    expect(res.status).toBe(201);
    const campaign = res.body.campaign;
    expect(campaign).toMatchObject({
      name: "Test Campaign",
      description: "",
      system: "generic",
      archived: false,
    });
    expect(campaign.members).toEqual([
      expect.objectContaining({ displayName: "GM Create", role: "OWNER" }),
    ]);
    expect(campaign.invites).toEqual([]);
  });

  it("rejects invalid campaign payloads with 400", async () => {
    const gm = await registerAgent("gminvalid@test.dev", "GM", "GM Invalid");
    expect((await createCampaign(gm, { name: "ab" })).status).toBe(400);
    expect(
      (await createCampaign(gm, { name: "x".repeat(81) })).status,
    ).toBe(400);
    expect(
      (await createCampaign(gm, { name: "OK", description: "x".repeat(501) })).status,
    ).toBe(400);
  });
});

describe("listing campaigns", () => {
  it("shows owned campaigns as OWNER; other users see nothing; most-recent-updated first", async () => {
    const gm = await registerAgent("gmlist@test.dev", "GM", "GM List");
    await createCampaign(gm, { name: "First Listed" });
    await createCampaign(gm, { name: "Second Listed" });

    const mine = await gm.get("/api/campaigns");
    expect(mine.status).toBe(200);
    const names = mine.body.campaigns.map((c: { name: string }) => c.name);
    expect(names).toContain("First Listed");
    expect(names).toContain("Second Listed");
    for (const c of mine.body.campaigns) {
      expect(c.relationship).toBe("OWNER");
    }

    const stranger = await registerAgent("strangerlist@test.dev", "PLAYER", "Stranger");
    const theirs = await stranger.get("/api/campaigns");
    expect(theirs.status).toBe(200);
    expect(theirs.body.campaigns).toEqual([]);
  });

  it("shows joined campaigns as PLAYER (BR-4)", async () => {
    const gm = await registerAgent("gmlist2@test.dev", "GM", "GM List Two");
    const player = await registerAgent("plist@test.dev", "PLAYER", "List Player");
    const campaign = (await createCampaign(gm, { name: "Joinable" })).body.campaign;
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    await player.post("/api/campaigns/join").send({ token: invite.token });

    const mine = await player.get("/api/campaigns");
    const joined = mine.body.campaigns.find((c: { name: string }) => c.name === "Joinable");
    expect(joined).toMatchObject({ relationship: "PLAYER", archived: false });
  });
});

describe("reading campaign details", () => {
  it("owner and member can read; non-participant gets 404; guest gets 401 (EF-7.1)", async () => {
    const gm = await registerAgent("gmread@test.dev", "GM", "GM Read");
    const campaign = (await createCampaign(gm, { name: "Readable" })).body.campaign;
    const player = await registerAgent("pread@test.dev", "PLAYER", "P Read");
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    await player.post("/api/campaigns/join").send({ token: invite.token });

    expect((await gm.get(`/api/campaigns/${campaign.id}`)).status).toBe(200);
    expect((await player.get(`/api/campaigns/${campaign.id}`)).status).toBe(200);

    const stranger = await registerAgent("strangerread@test.dev", "PLAYER", "S Read");
    const res = await stranger.get(`/api/campaigns/${campaign.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");

    expect((await guest().get(`/api/campaigns/${campaign.id}`)).status).toBe(401);
  });

  it("owner sees invites; members see an empty invites array", async () => {
    const gm = await registerAgent("gminvview@test.dev", "GM", "GM Inv View");
    const campaign = (await createCampaign(gm, { name: "Inv View" })).body.campaign;
    await gm.post(`/api/campaigns/${campaign.id}/invites`).send({});
    const player = await registerAgent("pinvview@test.dev", "PLAYER", "P Inv View");
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    await player.post("/api/campaigns/join").send({ token: invite.token });

    const ownerView = (await gm.get(`/api/campaigns/${campaign.id}`)).body.campaign;
    expect(ownerView.invites.length).toBeGreaterThan(0);

    const memberView = (await player.get(`/api/campaigns/${campaign.id}`)).body.campaign;
    expect(memberView.invites).toEqual([]);
  });
});

describe("editing and archiving campaigns", () => {
  it("owner can edit name/description/system and archive/unarchive (UC-08, UC-09)", async () => {
    const gm = await registerAgent("gmedit@test.dev", "GM", "GM Edit");
    const campaign = (await createCampaign(gm, { name: "Before Edit" })).body.campaign;

    const patched = await gm.patch(`/api/campaigns/${campaign.id}`).send({
      name: "After Edit",
      description: "New description",
      system: "D&D 5e",
      archived: true,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.campaign).toMatchObject({
      name: "After Edit",
      description: "New description",
      system: "D&D 5e",
      archived: true,
    });

    const unarchived = await gm.patch(`/api/campaigns/${campaign.id}`).send({ archived: false });
    expect(unarchived.body.campaign.archived).toBe(false);
  });

  it("non-owner members get 403; non-participants get 404 (EF-8.1)", async () => {
    const gm = await registerAgent("gmedit2@test.dev", "GM", "GM Edit Two");
    const campaign = (await createCampaign(gm, { name: "Locked Edit" })).body.campaign;
    const player = await registerAgent("pedit@test.dev", "PLAYER", "P Edit");
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    await player.post("/api/campaigns/join").send({ token: invite.token });

    const asMember = await player.patch(`/api/campaigns/${campaign.id}`).send({ name: "Hijack" });
    expect(asMember.status).toBe(403);
    expect(asMember.body.error.code).toBe("FORBIDDEN");

    const asStranger = await registerAgent("strangeredit@test.dev", "GM", "S Edit");
    expect((await asStranger.patch(`/api/campaigns/${campaign.id}`).send({ name: "Hijack" })).status).toBe(404);
  });
});

describe("deleting campaigns", () => {
  it("owner can delete (204); campaign disappears for everyone (UC-10)", async () => {
    const gm = await registerAgent("gmdel@test.dev", "GM", "GM Delete");
    const player = await registerAgent("pdel@test.dev", "PLAYER", "P Delete");
    const campaign = (await createCampaign(gm, { name: "Doomed" })).body.campaign;
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    await player.post("/api/campaigns/join").send({ token: invite.token });

    const del = await gm.delete(`/api/campaigns/${campaign.id}`);
    expect(del.status).toBe(204);

    expect((await gm.get(`/api/campaigns/${campaign.id}`)).status).toBe(404);
    expect((await player.get(`/api/campaigns/${campaign.id}`)).status).toBe(404);
    const mine = await gm.get("/api/campaigns");
    expect(mine.body.campaigns.map((c: { id: string }) => c.id)).not.toContain(campaign.id);
  });

  it("non-owner members get 403; non-participants get 404 (EF-10.1)", async () => {
    const gm = await registerAgent("gmdel2@test.dev", "GM", "GM Delete Two");
    const campaign = (await createCampaign(gm, { name: "Not Doomed" })).body.campaign;
    const player = await registerAgent("pdel2@test.dev", "PLAYER", "P Delete Two");
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    await player.post("/api/campaigns/join").send({ token: invite.token });

    expect((await player.delete(`/api/campaigns/${campaign.id}`)).status).toBe(403);
    const stranger = await registerAgent("strangerdel@test.dev", "PLAYER", "S Delete");
    expect((await stranger.delete(`/api/campaigns/${campaign.id}`)).status).toBe(404);
  });
});
