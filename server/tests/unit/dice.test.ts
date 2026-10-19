import { describe, expect, it } from "vitest";
import { parseDiceFormula, rollDice, DiceParseError } from "../../src/modules/dice/dice.js";

describe("Dice Parser & Roll Engine (BR-32, BR-33)", () => {
  it("parses single polyhedral dice without count prefix (e.g. d20, d6)", () => {
    for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
      const parsed = parseDiceFormula(`d${sides}`);
      expect(parsed).toEqual({ count: 1, sides, modifier: 0 });
    }
  });

  it("parses multi-dice formulas (e.g. 2d6, 4d8, 10d10)", () => {
    expect(parseDiceFormula("2d6")).toEqual({ count: 2, sides: 6, modifier: 0 });
    expect(parseDiceFormula("4d8")).toEqual({ count: 4, sides: 8, modifier: 0 });
    expect(parseDiceFormula("10d100")).toEqual({ count: 10, sides: 100, modifier: 0 });
  });

  it("parses positive and negative modifiers (e.g. 1d20+5, 2d6-2)", () => {
    expect(parseDiceFormula("1d20+5")).toEqual({ count: 1, sides: 20, modifier: 5 });
    expect(parseDiceFormula("d20-3")).toEqual({ count: 1, sides: 20, modifier: -3 });
    expect(parseDiceFormula("3d8+12")).toEqual({ count: 3, sides: 8, modifier: 12 });
  });

  it("handles case-insensitivity and whitespace", () => {
    expect(parseDiceFormula("  2D6+3  ")).toEqual({ count: 2, sides: 6, modifier: 3 });
    expect(parseDiceFormula("D12-1")).toEqual({ count: 1, sides: 12, modifier: -1 });
  });

  it("rejects invalid formulas with DiceParseError", () => {
    const invalid = [
      "",
      "d",
      "2d",
      "d7", // non-standard polyhedral
      "d3",
      "d50",
      "0d6",
      "-1d20",
      "101d6", // count exceeds 100 limit
      "1d20+1000", // modifier exceeds 999 limit
      "abc",
      "1d20+abc",
    ];
    for (const formula of invalid) {
      expect(() => parseDiceFormula(formula)).toThrow(DiceParseError);
    }
  });

  it("rolls authoritative random values within range for each die", () => {
    for (let i = 0; i < 50; i += 1) {
      const result = rollDice("2d6+3");
      expect(result.formula).toBe("2d6+3");
      expect(result.dice.length).toBe(2);
      expect(result.dice[0]).toBeGreaterThanOrEqual(1);
      expect(result.dice[0]).toBeLessThanOrEqual(6);
      expect(result.dice[1]).toBeGreaterThanOrEqual(1);
      expect(result.dice[1]).toBeLessThanOrEqual(6);
      expect(result.modifier).toBe(3);
      expect(result.total).toBe(result.dice[0] + result.dice[1] + 3);
    }
  });

  it("supports d100 rolls and negative modifiers", () => {
    const result = rollDice("d100-5", "Percentile Check");
    expect(result.dice.length).toBe(1);
    expect(result.dice[0]).toBeGreaterThanOrEqual(1);
    expect(result.dice[0]).toBeLessThanOrEqual(100);
    expect(result.modifier).toBe(-5);
    expect(result.total).toBe(result.dice[0] - 5);
    expect(result.label).toBe("Percentile Check");
  });
});
