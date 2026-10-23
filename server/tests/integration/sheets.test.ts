import { describe, expect, it } from "vitest";
import {
  createPc,
  createSystemCampaign,
  guest,
  joinPlayer,
  registerAgent,
  type ApiAgent,
} from "../helpers.js";

const SD_ABILITIES = { str: 12, int: 9, dex: 14, wis: 10, con: 14, cha: 8 };
const SD_WIZARD = { str: 8, int: 16, dex: 14, wis: 10, con: 12, cha: 10 };
const DND_CLERIC = { str: 12, dex: 14, con: 13, int: 10, wis: 16, cha: 10 };

interface Fixture {
  gm: ApiAgent;
  player: ApiAgent;
  other: ApiAgent;
  campaignId: string;
}

let seq = 0;

async function setup(system = "shadowdark"): Promise<Fixture> {
  seq += 1;
  const gm = await registerAgent(`sheets-gm-${system}-${seq}@test.dev`, "GM", "Sheets GM");
  const player = await registerAgent(`sheets-p-${system}-${seq}@test.dev`, "PLAYER", "Sheets Player");
  const other = await registerAgent(`sheets-o-${system}-${seq}@test.dev`, "PLAYER", "Sheets Other");
  const campaignId = (await createSystemCampaign(gm, `Sheets ${system}`, system)).id;
  await joinPlayer(gm, player, campaignId);
  return { gm, player, other, campaignId };
}

describe("campaign system validation (supersedes BR-9 free text)", () => {
  it("rejects unknown system on create and patch with 400 UNKNOWN_SYSTEM", async () => {
    const gm = await registerAgent("sysbogus@test.dev", "GM", "Sys Bogus");
    const created = await gm.post("/api/campaigns").send({ name: "Bogus System", system: "no-such-system" });
    expect(created.status).toBe(400);
    expect(created.body.error.code).toBe("UNKNOWN_SYSTEM");

    const campaign = (await createSystemCampaign(gm, "Valid First")).id;
    const patched = await gm.patch(`/api/campaigns/${campaign}`).send({ system: "also-not-real" });
    expect(patched.status).toBe(400);
    expect(patched.body.error.code).toBe("UNKNOWN_SYSTEM");

    // Installed keys and "generic" remain valid.
    expect((await gm.patch(`/api/campaigns/${campaign}`).send({ system: "dnd5e-2024" })).status).toBe(200);
    expect((await gm.patch(`/api/campaigns/${campaign}`).send({ system: "generic" })).status).toBe(200);
  });
});

describe("sheet access control (§6 matrix)", () => {
  it("guests get 401 on every sheet route", async () => {
    const { gm, campaignId } = await setup();
    const npc = await createPc(gm, campaignId, "Auth NPC", { kind: "NPC" });
    const g = guest();
    expect((await g.get(`/api/campaigns/${campaignId}/sheets`)).status).toBe(401);
    expect((await g.post(`/api/campaigns/${campaignId}/sheets`).send({})).status).toBe(401);
    expect((await g.get(`/api/sheets/${npc.id}`)).status).toBe(401);
    expect((await g.patch(`/api/sheets/${npc.id}`).send({ name: "X" })).status).toBe(401);
    expect((await g.post(`/api/sheets/${npc.id}/levelup`).send({})).status).toBe(401);
    expect((await g.delete(`/api/sheets/${npc.id}`)).status).toBe(401);
  });

  it("non-members get 404 on every sheet route (existence not revealed)", async () => {
    const { gm, other, campaignId } = await setup();
    const npc = await createPc(gm, campaignId, "Member NPC", { kind: "NPC" });
    expect((await other.get(`/api/campaigns/${campaignId}/sheets`)).status).toBe(404);
    expect(
      (await other.post(`/api/campaigns/${campaignId}/sheets`).send({ kind: "PC", name: "Sneaky", abilities: SD_ABILITIES })).status,
    ).toBe(404);
    expect((await other.get(`/api/sheets/${npc.id}`)).status).toBe(404);
    expect((await other.patch(`/api/sheets/${npc.id}`).send({ name: "X" })).status).toBe(404);
    expect((await other.post(`/api/sheets/${npc.id}/levelup`).send({})).status).toBe(404);
    expect((await other.delete(`/api/sheets/${npc.id}`)).status).toBe(404);
  });
});

describe("POST /api/campaigns/:id/sheets (UC-18, UC-19)", () => {
  it("participant creates a PC (201): ownerId set, HP initialized from config", async () => {
    const { player, campaignId } = await setup();
    const res = await player.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "PC",
      name: "Borin",
      ancestryId: "dwarf",
      classId: "fighter",
      backgroundId: "mercenary",
      abilities: SD_ABILITIES,
    });
    expect(res.status).toBe(201);
    const sheet = res.body.sheet;
    expect(sheet).toMatchObject({
      kind: "PC",
      name: "Borin",
      ancestryId: "dwarf",
      classId: "fighter",
      backgroundId: "mercenary",
      level: 1,
      xp: 0,
      hpCurrent: 10,
      hpMax: 10, // fighter d8 + con 14 (+2)
      systemKey: "shadowdark",
    });
    expect(sheet.ownerId).toBeTruthy();
    expect(sheet.abilities.con).toEqual({ score: 14, modifier: 2 });
  });

  it("requires the abilities object to cover exactly the configured abilities", async () => {
    const { player, campaignId } = await setup();
    const missing = await player.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "PC",
      name: "Incomplete",
      abilities: { str: 12, int: 9, dex: 14, wis: 10, con: 14 },
    });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_ERROR");
    expect(missing.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "abilities" })]),
    );

    const extra = await player.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "PC",
      name: "Extra",
      abilities: { ...SD_ABILITIES, luck: 10 },
    });
    expect(extra.status).toBe(400);
  });

  it("BR-20: score below the configured range is rejected (400)", async () => {
    const { player, campaignId } = await setup();
    const res = await player.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "PC",
      name: "Weakling",
      abilities: { ...SD_ABILITIES, str: 2 },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "abilities.str" })]),
    );
  });

  it("BR-20: unknown classId is rejected (400)", async () => {
    const { player, campaignId } = await setup();
    const res = await player.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "PC",
      name: "Warlord",
      classId: "warlord",
      abilities: SD_ABILITIES,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "classId" })]),
    );
  });

  it("players cannot create NPCs (403); campaign owner can (201, ownerId null)", async () => {
    const { gm, player, campaignId } = await setup();
    const denied = await player.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "NPC",
      name: "Sneaky NPC",
      abilities: SD_ABILITIES,
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");

    const allowed = await gm.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "NPC",
      name: "Village Guard",
      classId: "fighter",
      abilities: SD_ABILITIES,
    });
    expect(allowed.status).toBe(201);
    expect(allowed.body.sheet.kind).toBe("NPC");
    expect(allowed.body.sheet.ownerId).toBeNull();
  });

  it("SYSTEM_REQUIRED (400) when the campaign has no system (BR-16)", async () => {
    const gm = await registerAgent("sheetsgeneric@test.dev", "GM", "Sheets Generic");
    const player = await registerAgent("sheetsgenericp@test.dev", "PLAYER", "Sheets Generic P");
    const campaign = (
      await gm.post("/api/campaigns").send({ name: "Generic Campaign" })
    ).body.campaign;
    await joinPlayer(gm, player, campaign.id);
    const res = await player.post(`/api/campaigns/${campaign.id}/sheets`).send({
      kind: "PC",
      name: "Orphan",
      abilities: SD_ABILITIES,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SYSTEM_REQUIRED");
  });
});

describe("GET /api/campaigns/:id/sheets (UC-20)", () => {
  it("lists PCs first, then NPCs, alphabetical within each group", async () => {
    const { gm, player, campaignId } = await setup();
    await createPc(player, campaignId, "Zed");
    await createPc(gm, campaignId, "Alpha", { kind: "NPC" });
    await createPc(player, campaignId, "Mira");
    await createPc(gm, campaignId, "Brutus", { kind: "NPC" });

    const res = await gm.get(`/api/campaigns/${campaignId}/sheets`);
    expect(res.status).toBe(200);
    const kinds = res.body.sheets.map((s: { kind: string }) => s.kind);
    expect(kinds).toEqual(["PC", "PC", "NPC", "NPC"]);
    const names = res.body.sheets.map((s: { name: string }) => s.name);
    expect(names).toEqual(["Mira", "Zed", "Alpha", "Brutus"]);
    const first = res.body.sheets[0];
    expect(first).toMatchObject({
      id: expect.any(String),
      kind: "PC",
      name: "Mira",
      systemKey: "shadowdark",
      level: 1,
    });
    expect(first).not.toHaveProperty("abilities"); // summary only
  });
});

describe("GET /api/sheets/:id (UC-21)", () => {
  it("Shadowdark wizard: computed modifiers, AC with leather+shield, XP target, spellcasting", async () => {
    const { player, campaignId } = await setup();
    const sheet = await createPc(player, campaignId, "Fizban", {
      classId: "wizard",
      ancestryId: "elf",
      armorId: "leather",
      shield: true,
      abilities: SD_WIZARD,
    });

    const res = await player.get(`/api/sheets/${sheet.id}`);
    expect(res.status).toBe(200);
    const body = res.body.sheet;
    expect(body.abilities.int).toEqual({ score: 16, modifier: 3 });
    expect(body.derived).toMatchObject({
      armorClass: 15, // leather 11 + dex 2 + shield 2
      initiative: 2,
      proficiencyBonus: null,
      carrySlots: 10, // max(str 8, 10)
      nextLevelXp: 10,
      spellcasting: { ability: "int", known: 0, allowed: 3 },
    });
  });

  it("5e cleric: proficiency bonus +2, chain mail ignores DEX, threshold XP", async () => {
    const gm = await registerAgent("sheets5eget@test.dev", "GM", "Sheets 5e Get");
    const campaignId = (await createSystemCampaign(gm, "Sheets 5e", "dnd5e-2024")).id;
    const created = await gm.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "NPC",
      name: "Cleric NPC",
      classId: "cleric",
      armorId: "chain-mail",
      abilities: DND_CLERIC,
    });
    expect(created.status).toBe(201);

    const res = await gm.get(`/api/sheets/${created.body.sheet.id}`);
    expect(res.status).toBe(200);
    expect(res.body.sheet.derived).toMatchObject({
      armorClass: 16,
      proficiencyBonus: 2,
      carrySlots: null,
      nextLevelXp: 300,
      spellcasting: null,
    });
  });

  it("BR-20 on the 5e range: score 21 is rejected", async () => {
    const gm = await registerAgent("sheets5erange@test.dev", "GM", "Sheets 5e Range");
    const campaignId = (await createSystemCampaign(gm, "Sheets 5e Range", "dnd5e-2024")).id;
    const res = await gm.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "NPC",
      name: "Too Strong",
      abilities: { ...DND_CLERIC, str: 21 },
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/sheets/:id (UC-22)", () => {
  it("player edits their own PC (200); derived stats recompute automatically", async () => {
    const { player, campaignId } = await setup();
    const sheet = await createPc(player, campaignId, "Grower");

    const res = await player.patch(`/api/sheets/${sheet.id}`).send({
      name: "Grower the Great",
      xp: 25,
      abilities: { str: 17 },
      hpCurrent: 7,
    });
    expect(res.status).toBe(200);
    expect(res.body.sheet).toMatchObject({ name: "Grower the Great", xp: 25, hpCurrent: 7 });
    expect(res.body.sheet.abilities.str).toEqual({ score: 17, modifier: 3 });
    expect(res.body.sheet.abilities.dex).toEqual({ score: 14, modifier: 2 });
  });

  it("player cannot edit another's PC or any NPC (403); owner can edit anything (200)", async () => {
    const { gm, player, other, campaignId } = await setup();
    await joinPlayer(gm, other, campaignId);
    const mine = await createPc(player, campaignId, "Mine");
    const npc = await createPc(gm, campaignId, "Owned NPC", { kind: "NPC" });

    const foreign = await other.patch(`/api/sheets/${mine.id}`).send({ name: "Stolen" });
    expect(foreign.status).toBe(403);

    const npcEdit = await player.patch(`/api/sheets/${npc.id}`).send({ name: "Hijacked" });
    expect(npcEdit.status).toBe(403);

    const ownerEdit = await gm.patch(`/api/sheets/${mine.id}`).send({ xp: 5 });
    expect(ownerEdit.status).toBe(200);
    expect(ownerEdit.body.sheet.xp).toBe(5);
  });

  it("re-validates input: hpCurrent above hpMax and bad option ids are 400", async () => {
    const { player, campaignId } = await setup();
    const sheet = await createPc(player, campaignId, "Bounded");

    const hp = await player.patch(`/api/sheets/${sheet.id}`).send({ hpCurrent: 500 });
    expect(hp.status).toBe(400);

    const armor = await player.patch(`/api/sheets/${sheet.id}`).send({ armorId: "magic-plate" });
    expect(armor.status).toBe(400);

    const score = await player.patch(`/api/sheets/${sheet.id}`).send({ abilities: { wis: 99 } });
    expect(score.status).toBe(400);
  });

  it("level is not directly editable (BR-22)", async () => {
    const { player, campaignId } = await setup();
    const sheet = await createPc(player, campaignId, "No Shortcut");
    const res = await player.patch(`/api/sheets/${sheet.id}`).send({ level: 5 });
    expect(res.status).toBe(200);
    expect(res.body.sheet.level).toBe(1);
  });

  it("extras accept talents/spells/notes/coins and round-trip", async () => {
    const { player, campaignId } = await setup();
    const sheet = await createPc(player, campaignId, "Extras");
    const res = await player.patch(`/api/sheets/${sheet.id}`).send({
      extras: { talents: ["Alert"], spells: ["Magic Missile"], notes: "Has a cat.", coins: { gp: 12, sp: 3 } },
    });
    expect(res.status).toBe(200);
    expect(res.body.sheet.extras).toEqual({
      talents: ["Alert"],
      spells: ["Magic Missile"],
      notes: "Has a cat.",
      coins: { gp: 12, sp: 3 },
    });

    const read = await player.get(`/api/sheets/${sheet.id}`);
    expect(read.body.sheet.extras.coins).toEqual({ gp: 12, sp: 3 });
  });
});

describe("POST /api/sheets/:id/levelup (UC-23)", () => {
  it("Shadowdark: level+1, hpMax += config hp-per-level, XP resets to 0", async () => {
    const { player, campaignId } = await setup();
    const sheet = await createPc(player, campaignId, "Riser", { classId: "fighter" });
    await player.patch(`/api/sheets/${sheet.id}`).send({ xp: 10 });

    const res = await player.post(`/api/sheets/${sheet.id}/levelup`).send({});
    expect(res.status).toBe(200);
    expect(res.body.sheet).toMatchObject({ level: 2, hpMax: 15, xp: 0, hpCurrent: 10 });
  });

  it("5e: XP is kept on advance", async () => {
    const gm = await registerAgent("sheets5elvl@test.dev", "GM", "Sheets 5e Level");
    const campaignId = (await createSystemCampaign(gm, "Sheets 5e Level", "dnd5e-2024")).id;
    const created = await gm.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "NPC",
      name: "5e Riser",
      classId: "cleric",
      abilities: DND_CLERIC,
    });
    await gm.patch(`/api/sheets/${created.body.sheet.id}`).send({ xp: 300 });

    const res = await gm.post(`/api/sheets/${created.body.sheet.id}/levelup`).send({});
    expect(res.status).toBe(200);
    expect(res.body.sheet).toMatchObject({ level: 2, xp: 300 });
    expect(res.body.sheet.hpMax).toBe(9 + 6); // d8 → floor(8/2)+1+con 1
  });

  it("400 at maximum level; a player cannot level someone else's PC (403)", async () => {
    const { gm, player, other, campaignId } = await setup();
    await joinPlayer(gm, other, campaignId);
    const sheet = await createPc(player, campaignId, "Maxed", { classId: "thief" });
    const denied = await other.post(`/api/sheets/${sheet.id}/levelup`).send({});
    expect(denied.status).toBe(403);

    for (let i = 1; i < 10; i += 1) {
      const res = await player.post(`/api/sheets/${sheet.id}/levelup`).send({});
      expect(res.status).toBe(200);
    }
    const atMax = await player.post(`/api/sheets/${sheet.id}/levelup`).send({});
    expect(atMax.status).toBe(400);
    expect(atMax.body.error.message).toContain("Maximum level");

    const ownerCan = await gm.post(`/api/sheets/${sheet.id}/levelup`).send({});
    expect(ownerCan.status).toBe(400); // owner authority OK, still maxed
  });
});

describe("DELETE /api/sheets/:id (UC-24)", () => {
  it("owner of a PC can delete it; others cannot; campaign owner can delete anything", async () => {
    const { gm, player, other, campaignId } = await setup();
    await joinPlayer(gm, other, campaignId);
    const mine = await createPc(player, campaignId, "Deletable");
    const foreign = await createPc(other, campaignId, "Foreign");
    const npc = await createPc(gm, campaignId, "Guard", { kind: "NPC" });

    expect((await other.delete(`/api/sheets/${mine.id}`)).status).toBe(403);
    expect((await player.delete(`/api/sheets/${foreign.id}`)).status).toBe(403);
    expect((await player.delete(`/api/sheets/${npc.id}`)).status).toBe(403);

    expect((await player.delete(`/api/sheets/${mine.id}`)).status).toBe(204);
    expect((await player.get(`/api/sheets/${mine.id}`)).status).toBe(404);
    expect((await gm.delete(`/api/sheets/${foreign.id}`)).status).toBe(204);
    expect((await gm.delete(`/api/sheets/${npc.id}`)).status).toBe(204);

    const list = await gm.get(`/api/campaigns/${campaignId}/sheets`);
    expect(list.body.sheets).toEqual([]);
  });
});

describe("Shadowdark RPG Completeness & Shadowdarklings Parity (UC-26..UC-28)", () => {
  it("supports Level 0 (Gauntlet) character creation and graduation to Level 1 on levelup", async () => {
    const { player, campaignId } = await setup();
    const res = await player.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "PC",
      name: "Peasant Pip",
      level: 0,
      ancestryId: "halfling",
      backgroundId: "urchin",
      abilities: { str: 10, int: 10, dex: 14, wis: 10, con: 14, cha: 10 },
      extras: { alignment: "Neutral" },
    });
    expect(res.status).toBe(201);
    expect(res.body.sheet.level).toBe(0);
    expect(res.body.sheet.hpMax).toBe(2); // CON 14 -> +2

    const grad = await player.post(`/api/sheets/${res.body.sheet.id}/levelup`).send({
      classId: "thief",
    });
    expect(grad.status).toBe(200);
    expect(grad.body.sheet.level).toBe(1);
    expect(grad.body.sheet.classId).toBe("thief");
    expect(grad.body.sheet.hpMax).toBeGreaterThanOrEqual(3);
  });

  it("generates random 0-level and 1st-level Shadowdark characters (POST /api/campaigns/:id/sheets/generate)", async () => {
    const { player, campaignId } = await setup();
    const lv0 = await player
      .post(`/api/campaigns/${campaignId}/sheets/generate`)
      .send({ level: 0 });
    expect(lv0.status).toBe(201);
    expect(lv0.body.sheet.level).toBe(0);
    expect(lv0.body.sheet.ancestryId).toBeTruthy();
    expect(lv0.body.sheet.backgroundId).toBeTruthy();

    const lv1 = await player
      .post(`/api/campaigns/${campaignId}/sheets/generate`)
      .send({ level: 1, name: "Creeg" });
    expect(lv1.status).toBe(201);
    expect(lv1.body.sheet.level).toBe(1);
    expect(lv1.body.sheet.name).toBe("Creeg");
    expect(lv1.body.sheet.classId).toBeTruthy();
    expect(lv1.body.sheet.derived.shadowdark).toBeDefined();
    expect(lv1.body.sheet.derived.shadowdark.title).toBeTruthy();
  });

  it("exports and imports Shadowdarklings JSON bidirectionally", async () => {
    const { player, campaignId } = await setup();
    const created = await player.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "PC",
      name: "Jorbin",
      ancestryId: "dwarf",
      classId: "fighter",
      backgroundId: "soldier",
      armorId: "chainmail",
      shield: true,
      abilities: { str: 16, int: 8, dex: 9, wis: 11, con: 14, cha: 10 },
      extras: {
        alignment: "Lawful",
        deity: "Saint Terragnis",
        talents: ["Weapon Mastery (greataxe)"],
        weapons: ["greataxe"],
        weaponMastery: ["greataxe"],
        coins: { gp: 15, sp: 5, cp: 0 },
      },
    });
    expect(created.status).toBe(201);

    const exportedRes = await player.get(
      `/api/sheets/${created.body.sheet.id}/shadowdarklings`,
    );
    expect(exportedRes.status).toBe(200);
    const sdJson = exportedRes.body.character;
    expect(sdJson.name).toBe("Jorbin");
    expect(sdJson.ancestry).toBe("Dwarf");
    expect(sdJson.class).toBe("Fighter");
    expect(sdJson.alignment).toBe("Lawful");
    expect(sdJson.deity).toBe("Saint Terragnis");
    expect(sdJson.title).toBe("Squire");
    expect(sdJson.stats.STR).toBe(16);

    const importedRes = await player
      .post(`/api/campaigns/${campaignId}/sheets/shadowdarklings`)
      .send({ ...sdJson, name: "Jorbin Clone" });
    expect(importedRes.status).toBe(201);
    expect(importedRes.body.sheet.name).toBe("Jorbin Clone");
    expect(importedRes.body.sheet.ancestryId).toBe("dwarf");
    expect(importedRes.body.sheet.classId).toBe("fighter");
    expect(importedRes.body.sheet.abilities.str.score).toBe(16);
  });

  it("executes Shadowdark sheet actions (cast_spell, rest, carouse)", async () => {
    const { player, campaignId } = await setup();
    const created = await player.post(`/api/campaigns/${campaignId}/sheets`).send({
      kind: "PC",
      name: "Iraga",
      ancestryId: "half-orc",
      classId: "priest",
      backgroundId: "acolyte",
      abilities: { str: 14, int: 10, dex: 10, wis: 16, con: 12, cha: 10 },
      hpMax: 8,
      hpCurrent: 3,
      extras: {
        alignment: "Lawful",
        deity: "Saint Terragnis",
        spells: ["cure-wounds", "light"],
        coins: { gp: 100, sp: 0, cp: 0 },
      },
    });
    const sheetId = created.body.sheet.id;

    // Failed spell cast marks spell as lost until rest
    const castFail = await player.post(`/api/sheets/${sheetId}/shadowdark-action`).send({
      action: "cast_spell",
      spellKey: "light",
      forcedD20: 2, // 2 + 3 = 5 < DC 11
    });
    expect(castFail.status).toBe(200);
    expect(castFail.body.result.success).toBe(false);
    expect(castFail.body.sheet.extras.lostSpells).toContain("light");

    // Rest restores full HP and clears lostSpells
    const restRes = await player.post(`/api/sheets/${sheetId}/shadowdark-action`).send({
      action: "rest",
    });
    expect(restRes.status).toBe(200);
    expect(restRes.body.sheet.hpCurrent).toBe(8);
    expect(restRes.body.sheet.extras.lostSpells).toEqual([]);

    // Carouse awards XP and deducts event cost
    const carouseRes = await player.post(`/api/sheets/${sheetId}/shadowdark-action`).send({
      action: "carouse",
      eventCostGp: 30,
      forcedD8: 8,
    });
    expect(carouseRes.status).toBe(200);
    expect(carouseRes.body.result.xpGained).toBe(4);
    expect(carouseRes.body.sheet.xp).toBe(4);
    expect(carouseRes.body.sheet.extras.coins.gp).toBe(70);
  });
});
