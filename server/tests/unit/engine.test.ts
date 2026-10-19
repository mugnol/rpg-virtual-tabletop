import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  armorClass,
  abilityModifier,
  carrySlots,
  EngineError,
  hpAtFirstLevel,
  hpPerLevel,
  nextLevelXp,
  proficiencyBonus,
} from "../../src/rules/engine.js";
import { validateSystemConfig, type SystemConfig } from "../../src/rules/schema.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/systems");

let sd: SystemConfig;
let dnd: SystemConfig;

beforeAll(() => {
  sd = mustValidate(JSON.parse(readFileSync(path.join(dataDir, "shadowdark.json"), "utf8")));
  dnd = mustValidate(JSON.parse(readFileSync(path.join(dataDir, "dnd5e-2024.json"), "utf8")));
});

function mustValidate(doc: unknown): SystemConfig {
  const result = validateSystemConfig(doc);
  if (!result.ok) throw new Error(`built-in config failed validation: ${JSON.stringify(result.errors)}`);
  return result.config;
}

const sdAbilities = { str: 12, int: 9, dex: 13, wis: 10, con: 14, cha: 8 };

describe("abilityModifier", () => {
  it("computes the Shadowdark modifier with the ±4 clamp", () => {
    expect(abilityModifier(sd, "str", 10)).toBe(0);
    expect(abilityModifier(sd, "str", 14)).toBe(2);
    expect(abilityModifier(sd, "str", 3)).toBe(-4);
    expect(abilityModifier(sd, "str", 18)).toBe(4);
    expect(abilityModifier(sd, "str", 20)).toBe(4); // raw +5, clamped to +4
  });

  it("computes the 5e modifier without a clamp", () => {
    expect(abilityModifier(dnd, "str", 20)).toBe(5);
    expect(abilityModifier(dnd, "str", 3)).toBe(-4);
    expect(abilityModifier(dnd, "str", 15)).toBe(2);
  });

  it("throws EngineError for an unknown ability", () => {
    expect(() => abilityModifier(sd, "foo", 10)).toThrow(EngineError);
  });
});

describe("proficiencyBonus", () => {
  it("is null when the configuration declares no formula (Shadowdark)", () => {
    expect(proficiencyBonus(sd, 1)).toBeNull();
    expect(proficiencyBonus(sd, 10)).toBeNull();
  });

  it("follows the 5e table 2 + floor((level - 1) / 4)", () => {
    const cases: Array<[number, number]> = [
      [1, 2],
      [5, 3],
      [9, 4],
      [13, 5],
      [17, 6],
    ];
    for (const [level, expected] of cases) {
      expect(proficiencyBonus(dnd, level)).toBe(expected);
    }
  });
});

describe("hit points", () => {
  it("Shadowdark fighter with CON 14: 10 HP at first level, +5 per level", () => {
    expect(hpAtFirstLevel(sd, "fighter", sdAbilities)).toBe(10);
    expect(hpPerLevel(sd, "fighter", sdAbilities)).toBe(5);
  });

  it("5e wizard with CON 12: 7 HP at first level, +5 per level", () => {
    const abilities = { str: 8, dex: 14, con: 12, int: 15, wis: 10, cha: 8 };
    expect(hpAtFirstLevel(dnd, "wizard", abilities)).toBe(7);
    expect(hpPerLevel(dnd, "wizard", abilities)).toBe(5);
  });

  it("5e per-level HP includes the CON modifier", () => {
    const abilities = { str: 8, dex: 14, con: 16, int: 15, wis: 10, cha: 8 };
    expect(hpPerLevel(dnd, "wizard", abilities)).toBe(7); // floor(6/2)+1+3
  });

  it("never returns less than 1 HP", () => {
    const abilities = { str: 12, int: 9, dex: 13, wis: 10, con: 3, cha: 8 };
    expect(hpAtFirstLevel(sd, "thief", abilities)).toBe(1); // 4 + (-4) = 0 → 1
  });

  it("throws EngineError for an unknown class", () => {
    expect(() => hpAtFirstLevel(sd, "lich", sdAbilities)).toThrow(EngineError);
    expect(() => hpPerLevel(dnd, "witch", sdAbilities)).toThrow(EngineError);
  });
});

describe("armorClass", () => {
  it("is 10 + DEX when unarmored", () => {
    expect(armorClass(sd, null, false, { dex: 14 })).toBe(12);
    expect(armorClass(dnd, null, false, { dex: 16 })).toBe(13);
  });

  it("applies negative DEX modifiers when unarmored and in full-DEX armor", () => {
    expect(armorClass(sd, null, false, { dex: 8 })).toBe(9);
    expect(armorClass(sd, "leather", false, { dex: 8 })).toBe(10); // 11 + (-1)
  });

  it("applies the full DEX modifier for 'full' mode armor", () => {
    expect(armorClass(sd, "leather", false, { dex: 14 })).toBe(13); // 11 + 2
    expect(armorClass(sd, "chainmail", false, { dex: 16 })).toBe(16); // 13 + 3
    expect(armorClass(dnd, "leather", false, { dex: 14 })).toBe(13);
  });

  it("ignores DEX for 'none' mode armor", () => {
    expect(armorClass(sd, "plate", false, { dex: 18 })).toBe(15);
    expect(armorClass(sd, "plate", false, { dex: 8 })).toBe(15);
    expect(armorClass(dnd, "plate", false, { dex: 20 })).toBe(18);
  });

  it("caps the DEX modifier at the integer cap", () => {
    expect(armorClass(dnd, "chain-shirt", false, { dex: 16 })).toBe(15); // 13 + min(3, 2)
    expect(armorClass(dnd, "chain-shirt", false, { dex: 20 })).toBe(15); // 13 + min(5, 2)
    expect(armorClass(dnd, "hide", false, { dex: 10 })).toBe(12); // 12 + min(0, 2)
    expect(armorClass(dnd, "half-plate", false, { dex: 20 })).toBe(17); // 15 + min(5, 2)
  });

  it("adds the shield bonus on top of any armor", () => {
    expect(armorClass(sd, "leather", true, { dex: 14 })).toBe(15); // 11 + 2 + 2
    expect(armorClass(sd, null, true, { dex: 14 })).toBe(14); // 10 + 2 + 2
    expect(armorClass(sd, "plate", true, { dex: 10 })).toBe(17); // 15 + 2
    expect(armorClass(dnd, "chain-shirt", true, { dex: 16 })).toBe(17); // 13 + 2 + 2
  });

  it("throws EngineError for an unknown armor key", () => {
    expect(() => armorClass(sd, "tower-shield", false, { dex: 10 })).toThrow(EngineError);
  });
});

describe("carrySlots", () => {
  it("is max(STR score, 10) for Shadowdark", () => {
    expect(carrySlots(sd, { str: 8 })).toBe(10);
    expect(carrySlots(sd, { str: 16 })).toBe(16);
  });

  it("is null when the configuration declares no carry formula (5e)", () => {
    expect(carrySlots(dnd, { str: 18 })).toBeNull();
  });
});

describe("nextLevelXp", () => {
  it("is level × multiplier for Shadowdark and null at max level", () => {
    expect(nextLevelXp(sd, 1)).toBe(10);
    expect(nextLevelXp(sd, 3)).toBe(30);
    expect(nextLevelXp(sd, 9)).toBe(90);
    expect(nextLevelXp(sd, 10)).toBeNull();
  });

  it("indexes the threshold table for 5e and is null at max level", () => {
    expect(nextLevelXp(dnd, 1)).toBe(300);
    expect(nextLevelXp(dnd, 3)).toBe(2700);
    expect(nextLevelXp(dnd, 19)).toBe(355000);
    expect(nextLevelXp(dnd, 20)).toBeNull();
  });
});
