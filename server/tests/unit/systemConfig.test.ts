import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateSystemConfig } from "../../src/rules/schema.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/systems");

function loadBuiltin(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8")) as Record<string, unknown>;
}

const sd = () => loadBuiltin("shadowdark.json");
const dnd = () => loadBuiltin("dnd5e-2024.json");

function expectRejected(doc: unknown, pathFragment?: string, messageFragment?: string) {
  const result = validateSystemConfig(doc);
  expect(result.ok).toBe(false);
  if (!result.ok && pathFragment) {
    expect(result.errors.some((e) => e.path === pathFragment)).toBe(true);
  }
  if (!result.ok && messageFragment) {
    expect(result.errors.some((e) => e.message.includes(messageFragment))).toBe(true);
  }
}

describe("validateSystemConfig: built-in systems", () => {
  it("accepts the committed shadowdark.json", () => {
    const result = validateSystemConfig(sd());
    expect(result.ok).toBe(true);
  });

  it("accepts the committed dnd5e-2024.json", () => {
    const result = validateSystemConfig(dnd());
    expect(result.ok).toBe(true);
  });

  it("never throws on non-object input", () => {
    for (const bad of [null, undefined, 42, "config", [1, 2, 3], true]) {
      const result = validateSystemConfig(bad);
      expect(result.ok).toBe(false);
    }
  });
});

describe("validateSystemConfig: rejection matrix", () => {
  it("rejects a document missing a required section", () => {
    const doc = sd();
    delete doc.levels;
    expectRejected(doc, "levels");

    const doc2 = sd();
    delete doc2.armor;
    expectRejected(doc2, "armor");
  });

  it("rejects a key outside the slug pattern", () => {
    expectRejected({ ...sd(), key: "Shadowdark!" }, "key");
    expectRejected({ ...sd(), key: "x" }, "key");
    expectRejected({ ...sd(), key: "-shadowdark" }, "key");
  });

  it("rejects an ability score range where min >= max", () => {
    expectRejected({ ...sd(), abilityScoreRange: { min: 18, max: 18 } }, "abilityScoreRange");
    expectRejected({ ...sd(), abilityScoreRange: { min: 20, max: 3 } }, "abilityScoreRange");
  });

  it("rejects thresholds whose length differs from levels.max", () => {
    const doc = dnd();
    const levels = doc.levels as { advancement: { thresholds: number[] } };
    levels.advancement.thresholds = levels.advancement.thresholds.slice(0, 19);
    expectRejected(doc, "levels.advancement.thresholds");
  });

  it("rejects non-monotonic thresholds and a non-zero first threshold", () => {
    const doc = dnd();
    const levels = doc.levels as { advancement: { thresholds: number[] } };
    levels.advancement.thresholds = [0, 900, 300, ...levels.advancement.thresholds.slice(3)];
    expectRejected(doc, "levels.advancement.thresholds", "non-decreasing");

    const doc2 = dnd();
    const levels2 = doc2.levels as { advancement: { thresholds: number[] } };
    levels2.advancement.thresholds = [100, ...levels2.advancement.thresholds.slice(1)];
    expectRejected(doc2, "levels.advancement.thresholds", "0");
  });

  it("rejects duplicate ability keys", () => {
    const doc = sd();
    const abilities = doc.abilities as Array<Record<string, string>>;
    abilities.push({ ...abilities[0] });
    expectRejected(doc, "abilities", "duplicate");
  });

  it("rejects a formula using an identifier outside the whitelist", () => {
    const doc = sd();
    doc.derived = { ...(doc.derived as object), initiative: "foo.bar + 1" };
    expectRejected(doc, "derived.initiative", "unknown identifier in formula: foo.bar");
  });

  it("rejects a formula with a syntax error", () => {
    const doc = sd();
    doc.derived = { ...(doc.derived as object), initiative: "dex.mod +" };
    expectRejected(doc, "derived.initiative");

    const doc2 = sd();
    doc2.abilityModifier = { ...(doc2.abilityModifier as object), formula: "((score" };
    expectRejected(doc2, "abilityModifier.formula");
  });

  it("rejects a missing standardArray while the method is declared", () => {
    const doc = dnd();
    const creation = doc.creation as Record<string, unknown>;
    delete creation.standardArray;
    expectRejected(doc, "creation.standardArray");
  });

  it("rejects a standardArray whose length differs from the abilities count", () => {
    const doc = dnd();
    const creation = doc.creation as { standardArray: number[] };
    creation.standardArray = creation.standardArray.slice(0, 5);
    expectRejected(doc, "creation.standardArray");
  });

  it("rejects an empty abilities list", () => {
    expectRejected({ ...sd(), abilities: [] }, "abilities");
  });

  it("rejects a class whose spellcasting ability is not a configured ability", () => {
    const doc = sd();
    const classes = doc.classes as Array<{ spellcasting?: { ability: string } }>;
    classes[1].spellcasting = { ...classes[1].spellcasting!, ability: "foo" };
    expectRejected(doc, "classes.1.spellcasting.ability");
  });

  it("rejects spellcasting knownByLevel whose length differs from levels.max", () => {
    const doc = sd();
    const classes = doc.classes as Array<{ spellcasting?: { knownByLevel: number[] } }>;
    classes[3].spellcasting = { ...classes[3].spellcasting!, knownByLevel: [3, 4, 5] };
    expectRejected(doc, "classes.3.spellcasting.knownByLevel");
  });
});
