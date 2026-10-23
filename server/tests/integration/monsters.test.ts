import { describe, expect, it } from "vitest";
import { prisma } from "../../src/db.js";
import { createSystemCampaign, registerAgent } from "../helpers.js";

let seq = 0;

describe("Monster Compendium & Token Placement Integration (Task 5)", () => {
  it("GET /api/monsters returns compendium and filters by search, level, and alignment", async () => {
    seq += 1;
    const agent = await registerAgent(`monster-user-${seq}@test.dev`, "GM", "Monster GM");

    // All monsters
    const res = await agent.get("/api/monsters");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.monsters)).toBe(true);
    expect(res.body.monsters.length).toBeGreaterThanOrEqual(150);

    // Search by name
    const searchRes = await agent.get("/api/monsters?search=skeleton");
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.monsters.length).toBeGreaterThanOrEqual(1);
    expect(
      searchRes.body.monsters.some(
        (m: any) => m.name.toLowerCase() === "skeleton",
      ),
    ).toBe(true);

    // Filter by level
    const levelRes = await agent.get("/api/monsters?level=1");
    expect(levelRes.status).toBe(200);
    expect(levelRes.body.monsters.every((m: any) => m.level === 1)).toBe(true);

    // Filter by alignment
    const alignRes = await agent.get("/api/monsters?alignment=Chaotic");
    expect(alignRes.status).toBe(200);
    expect(alignRes.body.monsters.every((m: any) => m.alignment === "Chaotic")).toBe(true);
  });

  it("GET /api/monsters/:id returns full monster details", async () => {
    seq += 1;
    const agent = await registerAgent(`monster-detail-${seq}@test.dev`, "PLAYER", "Monster Player");

    const res = await agent.get("/api/monsters/goblin");
    expect(res.status).toBe(200);
    expect(res.body.monster).toBeDefined();
    expect(res.body.monster.name).toBe("Goblin");
    expect(res.body.monster.ac).toBe(13);
    expect(res.body.monster.hp).toBe(4);
    expect(res.body.monster.level).toBe(1);
    expect(res.body.monster.attacks).toBeDefined();

    const notFound = await agent.get("/api/monsters/not-a-real-monster");
    expect(notFound.status).toBe(404);
  });

  it("GET /api/monsters/roles returns combat roles presets", async () => {
    seq += 1;
    const agent = await registerAgent(`monster-roles-${seq}@test.dev`, "GM", "Role GM");

    const res = await agent.get("/api/monsters/roles");
    expect(res.status).toBe(200);
    expect(res.body.roles).toBeDefined();
    expect(res.body.roles.Mook).toBeDefined();
    expect(res.body.roles.Soldier).toBeDefined();
    expect(res.body.roles.Striker).toBeDefined();
    expect(res.body.roles.Tank).toBeDefined();
    expect(res.body.roles.Controller).toBeDefined();
    expect(res.body.roles.Legendary).toBeDefined();
  });

  it("POST /api/monsters/generate returns procedurally generated monster", async () => {
    seq += 1;
    const agent = await registerAgent(`monster-gen-${seq}@test.dev`, "GM", "Gen GM");

    const res = await agent.post("/api/monsters/generate").send({
      partyLevel: 3,
      rollCombat: 8,
      rollQuality: 1,
      rollStrength: 1,
      rollWeakness: 1,
      mutationRolls: [
        { table: 1, roll: 12 },
        { table: 2, roll: 4 },
      ],
    });

    expect(res.status).toBe(200);
    const gen = res.body.monster;
    expect(gen).toBeDefined();
    expect(gen.ac).toBe(13); // PL (3) + 10
    expect(gen.level).toBe(3);
    expect(gen.quality).toBe("Beastlike");
    expect(gen.strength).toBe("+1 attack");
    expect(gen.weakness).toBe("Cold");
    expect(gen.mutations).toEqual(["Wings", "+1 attack"]);
  });

  it("GM places token populated from Shadowdark Monster Compendium", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`monster-token-${seq}@test.dev`, "GM", "Monster Token GM");
    const campaignId = (await createSystemCampaign(gmAgent, `Monster Camp ${seq}`)).id;

    const sessionRes = await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({
      name: "Monster Session",
    });
    const sessionId = sessionRes.body.session.id;

    const mapRes = await gmAgent.post(`/api/sessions/${sessionId}/maps`).send({
      name: "Goblin Lair",
      width: 10,
      height: 10,
    });
    const mapId = mapRes.body.map.id;

    // Place Goblin from Compendium
    const tokenRes = await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
      type: "MONSTER",
      monsterKey: "goblin",
      x: 2,
      y: 2,
    });

    expect(tokenRes.status).toBe(201);
    const token = tokenRes.body.token;
    expect(token.name).toBe("Goblin");
    expect(token.hpMax).toBe(4);
    expect(token.hpCurrent).toBe(4);
    expect(token.ac).toBe(13);
    expect(token.dexModifier).toBe(2);
    expect(token.attackBonus).toBe(2);
  });
});
