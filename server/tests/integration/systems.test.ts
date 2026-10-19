import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/db.js";
import { guest, registerAgent } from "../helpers.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/systems");

function builtinFile(key: string): string {
  const file = key.endsWith(".json") ? key : `${key}.json`;
  return readFileSync(path.join(dataDir, file), "utf8");
}

beforeEach(async () => {
  await prisma.systemConfig.deleteMany({ where: { builtin: false } });
});

describe("GET /api/systems", () => {
  it("lists both built-ins with name, version, attribution and builtin flag (UC-13)", async () => {
    const user = await registerAgent("syslist@test.dev", "PLAYER", "Sys List");
    const res = await user.get("/api/systems");
    expect(res.status).toBe(200);
    const systems = res.body.systems;
    expect(systems.length).toBe(2);
    expect(systems[0].key).toBe("dnd5e-2024"); // key asc
    expect(systems[1].key).toBe("shadowdark");
    for (const system of systems) {
      expect(system.builtin).toBe(true);
      expect(system.attribution.length).toBeGreaterThan(0);
      expect(system).not.toHaveProperty("config"); // no full document in the list
    }
    expect(systems.find((s: { key: string }) => s.key === "shadowdark")).toMatchObject({
      version: "1.0.0",
      name: "Shadowdark RPG",
    });
  });

  it("guests get 401 (§6)", async () => {
    expect((await guest().get("/api/systems")).status).toBe(401);
  });
});

describe("GET /api/systems/:key", () => {
  it("returns the full configuration document (UC-14)", async () => {
    const user = await registerAgent("sysget@test.dev", "PLAYER", "Sys Get");
    const res = await user.get("/api/systems/shadowdark");
    expect(res.status).toBe(200);
    expect(res.body.system).toMatchObject({
      key: "shadowdark",
      name: "Shadowdark RPG",
      abilities: expect.arrayContaining([expect.objectContaining({ key: "str", abbreviation: "STR" })]),
      classes: expect.arrayContaining([expect.objectContaining({ key: "fighter", hitDie: 8 })]),
    });
  });

  it("returns 404 NOT_FOUND for an unknown key", async () => {
    const user = await registerAgent("sysget404@test.dev", "PLAYER", "Sys Get 404");
    const res = await user.get("/api/systems/unknown-system");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("guests get 401", async () => {
    expect((await guest().get("/api/systems/shadowdark")).status).toBe(401);
  });
});

describe("GET /api/systems/:key/export", () => {
  it("returns the exact committed file bytes with attachment disposition (UC-15)", async () => {
    const user = await registerAgent("sysexport@test.dev", "PLAYER", "Sys Export");
    for (const key of ["shadowdark", "dnd5e-2024"]) {
      const res = await user.get(`/api/systems/${key}/export`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.headers["content-disposition"]).toBe(`attachment; filename="${key}-${key === "shadowdark" ? "1.0.0" : "5.2.1"}.json"`);
      expect(res.text).toBe(builtinFile(key));
    }
  });

  it("guests get 401", async () => {
    expect((await guest().get("/api/systems/shadowdark/export")).status).toBe(401);
  });
});

describe("POST /api/systems/import", () => {
  it("GM import round-trip: export, rename key, import, appears in list (UC-16)", async () => {
    const gm = await registerAgent("sysimport@test.dev", "GM", "Sys Import");
    const exported = (await gm.get("/api/systems/shadowdark/export")).text;
    const renamed = exported.replaceAll('"key": "shadowdark"', '"key": "my-dark"');
    expect(renamed).not.toBe(exported);

    const res = await gm.post("/api/systems/import").send(JSON.parse(renamed));
    expect(res.status).toBe(201);
    expect(res.body.system.key).toBe("my-dark");
    expect(res.body.system.name).toBe("Shadowdark RPG");

    const list = (await gm.get("/api/systems")).body.systems;
    const imported = list.find((s: { key: string }) => s.key === "my-dark");
    expect(imported).toMatchObject({ version: "1.0.0", name: "Shadowdark RPG", builtin: false });

    // Imported document is served back and exportable too.
    const fetched = await gm.get("/api/systems/my-dark");
    expect(fetched.status).toBe(200);
    expect(fetched.body.system.key).toBe("my-dark");
  });

  it("AF-16.1: malformed JSON body → 400 and nothing stored", async () => {
    const gm = await registerAgent("sysimportbadjson@test.dev", "GM", "Sys Import Bad JSON");
    const res = await gm.post("/api/systems/import").set("Content-Type", "application/json").send("{ not json");
    expect(res.status).toBe(400);

    const list = (await gm.get("/api/systems")).body.systems;
    expect(list.length).toBe(2);
  });

  it("AF-16.2: schema violation → 422 INVALID_SYSTEM_CONFIG with field details", async () => {
    const gm = await registerAgent("sysimportinvalid@test.dev", "GM", "Sys Import Invalid");
    const doc = JSON.parse(builtinFile("shadowdark.json"));
    doc.abilities = [];
    const res = await gm.post("/api/systems/import").send(doc);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_SYSTEM_CONFIG");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "abilities" })]),
    );
  });

  it("AF-16.3: duplicate (key, version) → 409 SYSTEM_EXISTS, nothing stored", async () => {
    const gm = await registerAgent("sysimportdup@test.dev", "GM", "Sys Import Dup");
    const doc = JSON.parse(builtinFile("dnd5e-2024.json"));
    const res = await gm.post("/api/systems/import").send(doc);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SYSTEM_EXISTS");
    expect(res.body.error.message).toContain("already installed");
  });

  it("EF-16.1: players get 403 (§6)", async () => {
    const player = await registerAgent("sysimportplayer@test.dev", "PLAYER", "Sys Import Player");
    const doc = JSON.parse(builtinFile("shadowdark.json"));
    doc.key = "player-import";
    const res = await player.post("/api/systems/import").send(doc);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("guests get 401", async () => {
    const doc = JSON.parse(builtinFile("shadowdark.json"));
    doc.key = "guest-import";
    expect((await guest().post("/api/systems/import").send(doc)).status).toBe(401);
  });
});
