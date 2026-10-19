import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  doubleDiceCount,
  resolveAttack,
  sortInitiative,
} from "../../src/modules/combat/combat.js";

describe("Combat Engine (BR-43..BR-50)", () => {
  describe("Initiative & Turn Order Sorting", () => {
    it("sorts combatants descending by initiative score", () => {
      const combatants = [
        { id: "c1", initiative: 12, initiativeModifier: 1 },
        { id: "c2", initiative: 19, initiativeModifier: 3 },
        { id: "c3", initiative: 8, initiativeModifier: 0 },
      ];
      const order = sortInitiative(combatants);
      expect(order).toEqual(["c2", "c1", "c3"]);
    });

    it("breaks initiative ties by higher initiative modifier", () => {
      const combatants = [
        { id: "c1", initiative: 15, initiativeModifier: 1 },
        { id: "c2", initiative: 15, initiativeModifier: 3 },
      ];
      const order = sortInitiative(combatants);
      expect(order).toEqual(["c2", "c1"]);
    });
  });

  describe("Turn & Round Cycling", () => {
    it("advances turn to next combatant in the order", () => {
      const turnOrder = ["t1", "t2", "t3"];
      const res = advanceTurn(turnOrder, 0, 1);
      expect(res.nextTurnIndex).toBe(1);
      expect(res.nextRound).toBe(1);
      expect(res.activeTokenId).toBe("t2");
    });

    it("wraps around to the first combatant and increments the round", () => {
      const turnOrder = ["t1", "t2", "t3"];
      const res = advanceTurn(turnOrder, 2, 1);
      expect(res.nextTurnIndex).toBe(0);
      expect(res.nextRound).toBe(2);
      expect(res.activeTokenId).toBe("t1");
    });
  });

  describe("Critical Hit Damage Doubling", () => {
    it("doubles the dice count in simple and modified formulas", () => {
      expect(doubleDiceCount("1d8")).toBe("2d8");
      expect(doubleDiceCount("d20")).toBe("2d20");
      expect(doubleDiceCount("2d6+3")).toBe("4d6+3");
      expect(doubleDiceCount("1d12-1")).toBe("2d12-1");
    });
  });

  describe("Attack Resolution Mechanics", () => {
    it("resolves a regular hit when attack total >= target AC", () => {
      const result = resolveAttack({
        attackerName: "Fighter",
        attackBonus: 4,
        damageFormula: "1d8+2",
        targetName: "Goblin",
        targetAc: 14,
        targetHpCurrent: 10,
        targetHpMax: 10,
        forcedD20: 11, // total = 15 >= 14
      });

      expect(result.d20).toBe(11);
      expect(result.attackTotal).toBe(15);
      expect(result.hit).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.isFumble).toBe(false);
      expect(result.damage).toBeGreaterThanOrEqual(3); // 1 + 2
      expect(result.damage).toBeLessThanOrEqual(10); // 8 + 2
      expect(result.targetHpAfter).toBe(10 - result.damage);
      expect(result.logMessage).toContain("HIT");
    });

    it("resolves a regular miss when attack total < target AC", () => {
      const result = resolveAttack({
        attackerName: "Fighter",
        attackBonus: 2,
        damageFormula: "1d8+2",
        targetName: "Goblin",
        targetAc: 15,
        targetHpCurrent: 10,
        targetHpMax: 10,
        forcedD20: 8, // total = 10 < 15
      });

      expect(result.hit).toBe(false);
      expect(result.damage).toBe(0);
      expect(result.targetHpAfter).toBe(10);
      expect(result.logMessage).toContain("MISS");
    });

    it("resolves an automatic critical hit on a natural 20 and doubles dice count", () => {
      const result = resolveAttack({
        attackerName: "Paladin",
        attackBonus: 0,
        damageFormula: "1d6+2",
        targetName: "Dragon",
        targetAc: 25, // AC is higher than 20, but nat 20 always hits
        targetHpCurrent: 50,
        targetHpMax: 50,
        forcedD20: 20,
      });

      expect(result.hit).toBe(true);
      expect(result.isCritical).toBe(true);
      expect(result.isFumble).toBe(false);
      expect(result.damageFormula).toBe("2d6+2");
      expect(result.damage).toBeGreaterThanOrEqual(4); // 2*1 + 2
      expect(result.targetHpAfter).toBe(50 - result.damage);
      expect(result.logMessage).toContain("CRITICAL HIT");
    });

    it("resolves an automatic miss on a natural 1 (fumble)", () => {
      const result = resolveAttack({
        attackerName: "Barbarian",
        attackBonus: 20, // bonus + 1 would beat AC 10, but nat 1 always misses
        damageFormula: "2d6+5",
        targetName: "Zombie",
        targetAc: 10,
        targetHpCurrent: 15,
        targetHpMax: 15,
        forcedD20: 1,
      });

      expect(result.hit).toBe(false);
      expect(result.isFumble).toBe(true);
      expect(result.damage).toBe(0);
      expect(result.targetHpAfter).toBe(15);
      expect(result.logMessage).toContain("FUMBLE");
    });

    it("clamps target HP at 0 when damage exceeds current HP", () => {
      const result = resolveAttack({
        attackerName: "Wizard",
        attackBonus: 5,
        damageFormula: "4d6",
        targetName: "Kobold",
        targetAc: 10,
        targetHpCurrent: 3,
        targetHpMax: 8,
        forcedD20: 15,
      });

      expect(result.hit).toBe(true);
      expect(result.targetHpAfter).toBe(0);
    });
  });
});
