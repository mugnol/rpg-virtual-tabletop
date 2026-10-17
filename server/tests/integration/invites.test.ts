import { describe, expect, it } from "vitest";
import { prisma } from "../../src/db.js";
import { guest, registerAgent } from "../helpers.js";

async function setupCampaign(prefix: string) {
  const gm = await registerAgent(`${prefix}gm@test.dev`, "GM", `${prefix} GM`);
  const campaign = (
    await gm.post("/api/campaigns").send({ name: `${prefix} Campaign` })
  ).body.campaign;
  return { gm, campaign };
}

describe("POST /api/campaigns/:id/invites (UC-11)", () => {
  it("owner creates a single-use invite expiring in 7 days", async () => {
    const { gm, campaign } = await setupCampaign("inv");
    const before = Date.now();
    const res = await gm.post(`/api/campaigns/${campaign.id}/invites`).send({});
    expect(res.status).toBe(201);
    const invite = res.body.invite;
    expect(invite.token).toHaveLength(24);
    expect(invite.createdAt).toBeTruthy();
    const expiry = new Date(invite.expiresAt).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(expiry - before).toBeGreaterThan(sevenDays - 60_000);
    expect(expiry - before).toBeLessThan(sevenDays + 60_000);
  });

  it("non-owner members get 403; non-participants get 404; guests get 401", async () => {
    const { gm, campaign } = await setupCampaign("invperm");
    const player = await registerAgent("invpermplayer@test.dev", "PLAYER", "Inv Player");
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    await player.post("/api/campaigns/join").send({ token: invite.token });

    expect((await player.post(`/api/campaigns/${campaign.id}/invites`).send({})).status).toBe(403);
    const stranger = await registerAgent("invpermstranger@test.dev", "PLAYER", "Inv Stranger");
    expect((await stranger.post(`/api/campaigns/${campaign.id}/invites`).send({})).status).toBe(404);
    expect((await guest().post(`/api/campaigns/${campaign.id}/invites`).send({})).status).toBe(401);
  });
});

describe("POST /api/campaigns/join (UC-12)", () => {
  it("a player joins with a valid token and becomes a PLAYER member", async () => {
    const { gm, campaign } = await setupCampaign("join");
    const player = await registerAgent("joinplayer@test.dev", "PLAYER", "Joiner");
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;

    const res = await player.post("/api/campaigns/join").send({ token: invite.token });
    expect(res.status).toBe(200);
    expect(res.body.campaign.id).toBe(campaign.id);
    expect(
      res.body.campaign.members.some(
        (m: { displayName: string; role: string }) =>
          m.displayName === "Joiner" && m.role === "PLAYER",
      ),
    ).toBe(true);
  });

  it("the invite is single-use: a second redeemer gets 410 (BR-7)", async () => {
    const { gm, campaign } = await setupCampaign("single");
    const first = await registerAgent("singlefirst@test.dev", "PLAYER", "First");
    const second = await registerAgent("singlesecond@test.dev", "PLAYER", "Second");
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;

    expect((await first.post("/api/campaigns/join").send({ token: invite.token })).status).toBe(200);
    const reused = await second.post("/api/campaigns/join").send({ token: invite.token });
    expect(reused.status).toBe(410);
    expect(reused.body.error.code).toBe("INVITE_EXPIRED");
  });

  it("an expired invite returns 410", async () => {
    const { gm, campaign } = await setupCampaign("exp");
    const player = await registerAgent("expplayer@test.dev", "PLAYER", "Exp Player");
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    await prisma.campaignInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await player.post("/api/campaigns/join").send({ token: invite.token });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("INVITE_EXPIRED");
  });

  it("an unknown token returns 404 INVALID (EF-12.1)", async () => {
    const player = await registerAgent("unknownplayer@test.dev", "PLAYER", "Unknown");
    const res = await player.post("/api/campaigns/join").send({ token: "x".repeat(24) });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("the owner cannot redeem an invite for their own campaign (409 ALREADY_MEMBER)", async () => {
    const { gm, campaign } = await setupCampaign("own");
    const invite = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    const res = await gm.post("/api/campaigns/join").send({ token: invite.token });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_MEMBER");
  });

  it("an existing member cannot join again, even with a fresh token (AF-12.1, BR-8)", async () => {
    const { gm, campaign } = await setupCampaign("dup");
    const player = await registerAgent("dupplayer@test.dev", "PLAYER", "Dup Player");
    const first = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    await player.post("/api/campaigns/join").send({ token: first.token });

    const second = (await gm.post(`/api/campaigns/${campaign.id}/invites`).send({})).body.invite;
    const res = await player.post("/api/campaigns/join").send({ token: second.token });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_MEMBER");

    const detail = (await gm.get(`/api/campaigns/${campaign.id}`)).body.campaign;
    const joinerEntries = detail.members.filter(
      (m: { displayName: string }) => m.displayName === "Dup Player",
    );
    expect(joinerEntries).toHaveLength(1);
  });

  it("guests cannot join (401)", async () => {
    const res = await guest().post("/api/campaigns/join").send({ token: "x".repeat(24) });
    expect(res.status).toBe(401);
  });
});
