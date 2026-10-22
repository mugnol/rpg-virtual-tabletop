import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  buildTurnQueue,
  doubleDiceCount,
  hasThiefInitiativeTalent,
  moveTurnQueueEntry,
  reorderTurnQueue,
  resolveAttack,
  revertTurn,
  rollEncounterInitiative,
  rollInitiative,
  sortInitiative,
  tickCombatTimers,
  type CombatTimer,
} from "../../src/modules/combat/combat.js";

describe("Combat Engine (BR-43..BR-50)", () => {
  describe("Shadowdark Initiative Rolling & Sorting (BR-44)", () => {
    it("calculates standard initiative as 1d20 + DEX modifier", () => {
      const res = rollInitiative(2, { forcedRolls: [14] });
      expect(res.d20).toBe(14);
      expect(res.keptDie).toBe(14);
      expect(res.dice).toEqual([14]);
      expect(res.modifier).toBe(2);
      expect(res.dexModifier).toBe(2);
      expect(res.total).toBe(16);
      expect(res.hasAdvantage).toBe(false);
      expect(res.formula).toBe("1d20+2");
    });

    it("detects Thief talent 'Gain advantage on initiative rolls' and rolls 2d20kh1 + DEX modifier recording both dice", () => {
      expect(
        hasThiefInitiativeTalent("Thief", ["Backstab", "Gain advantage on initiative rolls"])
      ).toBe(true);
      expect(hasThiefInitiativeTalent("Fighter", ["Weapon Mastery"])).toBe(false);

      const res = rollInitiative(3, {
        hasAdvantage: true,
        forcedRolls: [6, 17],
      });
      expect(res.dice).toEqual([6, 17]);
      expect(res.keptDie).toBe(17);
      expect(res.d20).toBe(17);
      expect(res.dexModifier).toBe(3);
      expect(res.total).toBe(20);
      expect(res.hasAdvantage).toBe(true);
      expect(res.formula).toBe("2d20kh1+3");
    });

    it("places hasSurprise: true entities at the top of the queue during a surprise round", () => {
      const combatants = [
        { id: "c-fast", type: "CHARACTER" as const, initiative: 22, dexModifier: 4, hasSurprise: false },
        { id: "m-ambush", type: "MONSTER" as const, initiative: 9, dexModifier: 1, hasSurprise: true },
        { id: "c-thief", type: "CHARACTER" as const, initiative: 15, dexModifier: 3, hasSurprise: true },
      ];
      const surpriseOrder = sortInitiative(combatants, { isSurpriseRound: true });
      expect(surpriseOrder).toEqual(["c-thief", "m-ambush", "c-fast"]);

      const standardOrder = sortInitiative(combatants, { isSurpriseRound: false });
      expect(standardOrder).toEqual(["c-fast", "c-thief", "m-ambush"]);
    });

    it("supports Grouped Monster Initiative (shared d20 + highest monster DEX modifier) vs Individual Monster Initiative", () => {
      const participants = [
        {
          id: "pc-1",
          name: "Thief",
          type: "CHARACTER" as const,
          dexModifier: 3,
          talents: ["Gain advantage on initiative rolls"],
          hasSurprise: false,
        },
        {
          id: "m-1",
          name: "Goblin Scout",
          type: "MONSTER" as const,
          dexModifier: 2,
          hasSurprise: false,
        },
        {
          id: "m-2",
          name: "Goblin Brute",
          type: "MONSTER" as const,
          dexModifier: -1,
          hasSurprise: false,
        },
      ];

      // Grouped monster initiative: monsters share 1 roll + max monster DEX (+2)
      const grouped = rollEncounterInitiative(participants, {
        groupMonsterInitiative: true,
        forcedRollsById: {
          "pc-1": [5, 16], // 2d20kh1(5,16) + 3 = 19
        },
        forcedGroupMonsterRoll: 12, // 12 + max(2, -1) = 14 for both monsters
      });

      const pcRes = grouped.results.find((r) => r.id === "pc-1")!;
      const m1Res = grouped.results.find((r) => r.id === "m-1")!;
      const m2Res = grouped.results.find((r) => r.id === "m-2")!;

      expect(pcRes.initiative).toBe(19);
      expect(pcRes.meta.dice).toEqual([5, 16]);
      expect(pcRes.meta.hasAdvantage).toBe(true);
      expect(m1Res.initiative).toBe(14);
      expect(m2Res.initiative).toBe(14);
      expect(grouped.turnOrder).toEqual(["pc-1", "m-1", "m-2"]);

      // Individual monster initiative: each monster rolls its own d20 + own DEX
      const individual = rollEncounterInitiative(participants, {
        groupMonsterInitiative: false,
        forcedRollsById: {
          "pc-1": [4, 8], // 8 + 3 = 11
          "m-1": [15], // 15 + 2 = 17
          "m-2": [10], // 10 - 1 = 9
        },
      });
      expect(individual.results.find((r) => r.id === "m-1")!.initiative).toBe(17);
      expect(individual.results.find((r) => r.id === "pc-1")!.initiative).toBe(11);
      expect(individual.results.find((r) => r.id === "m-2")!.initiative).toBe(9);
      expect(individual.turnOrder).toEqual(["m-1", "pc-1", "m-2"]);
    });

    it("sorts combatants descending by initiative score", () => {
      const combatants = [
        { id: "c1", initiative: 12, initiativeModifier: 1 },
        { id: "c2", initiative: 19, initiativeModifier: 3 },
        { id: "c3", initiative: 8, initiativeModifier: 0 },
      ];
      const order = sortInitiative(combatants);
      expect(order).toEqual(["c2", "c1", "c3"]);
    });

    it("breaks initiative ties by higher DEX modifier, then character before monster", () => {
      const combatants = [
        { id: "m1", type: "MONSTER" as const, initiative: 15, dexModifier: 2 },
        { id: "c1", type: "CHARACTER" as const, initiative: 15, dexModifier: 1 },
        { id: "c2", type: "CHARACTER" as const, initiative: 15, dexModifier: 2 },
      ];
      const order = sortInitiative(combatants);
      expect(order).toEqual(["c2", "m1", "c1"]);
    });

    it("builds a synchronized turnQueue with character and monster participant metadata including surprise and advantage", () => {
      const tokens = [
        {
          id: "t-mon",
          name: "Goblin Boss",
          type: "MONSTER",
          initiative: 12,
          dexModifier: 1,
          hasSurprise: false,
          initiativeMeta: JSON.stringify({
            dice: [11],
            keptDie: 11,
            dexModifier: 1,
            total: 12,
            hasAdvantage: false,
            formula: "1d20+1",
          }),
          ownerId: null,
          characterSheetId: null,
          hpCurrent: 15,
          hpMax: 15,
          ac: 14,
          speed: 6,
        },
        {
          id: "t-pc",
          name: "Aria",
          type: "CHARACTER",
          initiative: 18,
          dexModifier: 3,
          hasSurprise: true,
          initiativeMeta: JSON.stringify({
            dice: [7, 15],
            keptDie: 15,
            dexModifier: 3,
            total: 18,
            hasAdvantage: true,
            formula: "2d20kh1+3",
          }),
          ownerId: "user-1",
          characterSheetId: "sheet-1",
          hpCurrent: 10,
          hpMax: 10,
          ac: 15,
          speed: 6,
        },
      ];
      const queue = buildTurnQueue(["t-pc", "t-mon"], tokens, "t-pc");
      expect(queue).toHaveLength(2);
      expect(queue[0]).toMatchObject({
        id: "t-pc",
        entityId: "t-pc",
        name: "Aria",
        type: "CHARACTER",
        entityType: "character",
        initiative: 18,
        dexModifier: 3,
        hasSurprise: true,
        hasInitiativeAdvantage: true,
        isActive: true,
      });
      expect(queue[0].initiativeMeta?.dice).toEqual([7, 15]);
      expect(queue[1]).toMatchObject({
        id: "t-mon",
        entityId: "t-mon",
        name: "Goblin Boss",
        type: "MONSTER",
        entityType: "monster",
        initiative: 12,
        dexModifier: 1,
        hasSurprise: false,
        hasInitiativeAdvantage: false,
        isActive: false,
      });
    });
  });

  describe("GM Manual Turn Queue Reorganization (BR-49)", () => {
    it("moves an entry up or down by 1 position and updates turnOrder", () => {
      const initialOrder = ["t1", "t2", "t3"];
      // Move t2 up -> ["t2", "t1", "t3"]
      const movedUp = moveTurnQueueEntry(initialOrder, "t2", "up", "t1");
      expect(movedUp.turnOrder).toEqual(["t2", "t1", "t3"]);
      expect(movedUp.activeTokenId).toBe("t1");
      expect(movedUp.turnIndex).toBe(1);

      // Move t2 down -> ["t1", "t2", "t3"]
      const movedDown = moveTurnQueueEntry(movedUp.turnOrder, "t2", "down", "t1");
      expect(movedDown.turnOrder).toEqual(["t1", "t2", "t3"]);
      expect(movedDown.turnIndex).toBe(0);
    });

    it("clamps boundaries when moving top element up or bottom element down", () => {
      const order = ["t1", "t2", "t3"];
      const clampUp = moveTurnQueueEntry(order, "t1", "up", "t1");
      expect(clampUp.turnOrder).toEqual(["t1", "t2", "t3"]);
      expect(clampUp.turnIndex).toBe(0);

      const clampDown = moveTurnQueueEntry(order, "t3", "down", "t1");
      expect(clampDown.turnOrder).toEqual(["t1", "t2", "t3"]);
      expect(clampDown.turnIndex).toBe(0);
    });

    it("strictly preserves active combatant when the active combatant itself moves", () => {
      const order = ["t1", "t2", "t3"];
      // t2 is active (index 1), moves up to index 0
      const res = moveTurnQueueEntry(order, "t2", "up", "t2");
      expect(res.turnOrder).toEqual(["t2", "t1", "t3"]);
      expect(res.activeTokenId).toBe("t2");
      expect(res.turnIndex).toBe(0);
    });

    it("reorders turn queue with arbitrary custom sequence and recalculates active index", () => {
      const order = ["t1", "t2", "t3", "t4"];
      const newSequence = ["t4", "t2", "t1", "t3"];
      const res = reorderTurnQueue(order, newSequence, "t2");
      expect(res.turnOrder).toEqual(["t4", "t2", "t1", "t3"]);
      expect(res.activeTokenId).toBe("t2");
      expect(res.turnIndex).toBe(1);
    });
  });

  describe("Turn & Round Cycling (Next Turn & Previous Turn)", () => {
    it("advances turn to next combatant in the order and tracks activeTurnEntityId and roundNumber", () => {
      const turnOrder = ["t1", "t2", "t3"];
      const res = advanceTurn(turnOrder, 0, 1);
      expect(res.nextTurnIndex).toBe(1);
      expect(res.nextRound).toBe(1);
      expect(res.roundNumber).toBe(1);
      expect(res.activeTokenId).toBe("t2");
      expect(res.activeTurnEntityId).toBe("t2");
      expect(res.wrappedRound).toBe(false);
    });

    it("wraps around to the first combatant and increments the round", () => {
      const turnOrder = ["t1", "t2", "t3"];
      const res = advanceTurn(turnOrder, 2, 1);
      expect(res.nextTurnIndex).toBe(0);
      expect(res.nextRound).toBe(2);
      expect(res.roundNumber).toBe(2);
      expect(res.activeTokenId).toBe("t1");
      expect(res.activeTurnEntityId).toBe("t1");
      expect(res.wrappedRound).toBe(true);
    });

    it("reverts turn to previous combatant within the same round", () => {
      const turnOrder = ["t1", "t2", "t3"];
      const res = revertTurn(turnOrder, 2, 2);
      expect(res.prevTurnIndex).toBe(1);
      expect(res.prevRound).toBe(2);
      expect(res.roundNumber).toBe(2);
      expect(res.activeTokenId).toBe("t2");
      expect(res.activeTurnEntityId).toBe("t2");
      expect(res.wrappedBack).toBe(false);
    });

    it("wraps backward to the last combatant of the previous round when reverting at index 0 on round > 1", () => {
      const turnOrder = ["t1", "t2", "t3"];
      const res = revertTurn(turnOrder, 0, 2);
      expect(res.prevTurnIndex).toBe(2);
      expect(res.prevRound).toBe(1);
      expect(res.roundNumber).toBe(1);
      expect(res.activeTokenId).toBe("t3");
      expect(res.activeTurnEntityId).toBe("t3");
      expect(res.wrappedBack).toBe(true);
    });

    it("clamps at Round 1, index 0 when reverting at the start of Round 1", () => {
      const turnOrder = ["t1", "t2", "t3"];
      const res = revertTurn(turnOrder, 0, 1);
      expect(res.prevTurnIndex).toBe(0);
      expect(res.prevRound).toBe(1);
      expect(res.roundNumber).toBe(1);
      expect(res.activeTokenId).toBe("t1");
      expect(res.activeTurnEntityId).toBe("t1");
      expect(res.wrappedBack).toBe(false);
    });
  });

  describe("Personal & GM Round Timer Countdowns", () => {
    it("decrements spell, light, and dying timers on full round wrap and marks expired at 0", () => {
      const timers: CombatTimer[] = [
        {
          id: "tm-1",
          name: "Torch Light",
          category: "light",
          scope: "personal",
          entityId: "t1",
          remainingRounds: 2,
          initialRounds: 3,
          expired: false,
        },
        {
          id: "tm-2",
          name: "Bless Spell",
          category: "spell",
          scope: "gm",
          entityId: null,
          remainingRounds: 1,
          initialRounds: 2,
          expired: false,
        },
        {
          id: "tm-3",
          name: "Dying (Aria)",
          category: "dying",
          scope: "personal",
          entityId: "t1",
          remainingRounds: 3,
          initialRounds: 3,
          expired: false,
        },
      ];

      const ticked = tickCombatTimers(timers, -1);
      expect(ticked[0].remainingRounds).toBe(1);
      expect(ticked[0].expired).toBe(false);
      expect(ticked[1].remainingRounds).toBe(0);
      expect(ticked[1].expired).toBe(true);
      expect(ticked[2].remainingRounds).toBe(2);
      expect(ticked[2].expired).toBe(false);

      // Restoring on previous turn round wrap
      const restored = tickCombatTimers(ticked, 1);
      expect(restored[0].remainingRounds).toBe(2);
      expect(restored[1].remainingRounds).toBe(1);
      expect(restored[1].expired).toBe(false);
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
