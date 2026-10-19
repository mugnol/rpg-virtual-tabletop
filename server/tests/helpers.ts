import request from "supertest";
import { app } from "../src/app.js";

export const TEST_PASSWORD = "password123";

export type ApiAgent = ReturnType<typeof request.agent>;

/** Register a user via the API and return a cookie-preserving supertest agent. */
export async function registerAgent(
  email: string,
  role: "GM" | "PLAYER" = "GM",
  displayName = "Test User",
): Promise<ApiAgent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/register").send({
    email,
    password: TEST_PASSWORD,
    displayName,
    role,
  });
  if (res.status !== 201) {
    throw new Error(`registerAgent(${email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

/** Fresh unauthenticated supertest client. */
export const guest = () => request(app);

/** Create a campaign with an installed game system (default shadowdark). */
export async function createSystemCampaign(
  gm: ApiAgent,
  name: string,
  system = "shadowdark",
): Promise<{ id: string }> {
  const res = await gm.post("/api/campaigns").send({ name, system });
  if (res.status !== 201) {
    throw new Error(`createSystemCampaign(${name}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.campaign;
}

/** Add a player to a campaign via an invite created by the GM. */
export async function joinPlayer(gm: ApiAgent, player: ApiAgent, campaignId: string): Promise<void> {
  const invite = (await gm.post(`/api/campaigns/${campaignId}/invites`).send({})).body.invite;
  const res = await player.post("/api/campaigns/join").send({ token: invite.token });
  if (res.status !== 200) {
    throw new Error(`joinPlayer failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

const SD_ABILITIES = { str: 12, int: 9, dex: 14, wis: 10, con: 14, cha: 8 };

/** Create a PC through the API (Shadowdark defaults). */
export async function createPc(
  agent: ApiAgent,
  campaignId: string,
  name = "Test Character",
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const res = await agent.post(`/api/campaigns/${campaignId}/sheets`).send({
    kind: "PC",
    name,
    abilities: SD_ABILITIES,
    ...overrides,
  });
  if (res.status !== 201) {
    throw new Error(`createPc(${name}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.sheet;
}
