import { rollDice } from "../dice/dice.js";

export interface Combatant {
  id: string;
  initiative: number;
  initiativeModifier?: number;
  name?: string;
}

export interface CombatAttackParams {
  attackerName: string;
  attackBonus: number;
  damageFormula: string;
  targetName: string;
  targetAc: number;
  targetHpCurrent: number;
  targetHpMax: number;
  forcedD20?: number;
}

export interface CombatAttackResult {
  attackerName: string;
  targetName: string;
  d20: number;
  attackBonus: number;
  attackTotal: number;
  isCritical: boolean;
  isFumble: boolean;
  hit: boolean;
  targetAc: number;
  damage: number;
  damageFormula: string;
  targetHpBefore: number;
  targetHpAfter: number;
  targetHpMax: number;
  logMessage: string;
}

export function sortInitiative(combatants: Combatant[]): string[] {
  const sorted = [...combatants].sort((a, b) => {
    if (b.initiative !== a.initiative) {
      return b.initiative - a.initiative;
    }
    const modA = a.initiativeModifier ?? 0;
    const modB = b.initiativeModifier ?? 0;
    if (modB !== modA) {
      return modB - modA;
    }
    return a.id.localeCompare(b.id);
  });
  return sorted.map((c) => c.id);
}

export function advanceTurn(
  turnOrder: string[],
  currentTurnIndex: number,
  currentRound: number,
): { nextTurnIndex: number; nextRound: number; activeTokenId: string } {
  if (turnOrder.length === 0) {
    return { nextTurnIndex: 0, nextRound: currentRound, activeTokenId: "" };
  }
  const nextTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
  const nextRound = nextTurnIndex === 0 ? currentRound + 1 : currentRound;
  return {
    nextTurnIndex,
    nextRound,
    activeTokenId: turnOrder[nextTurnIndex] ?? "",
  };
}

export function doubleDiceCount(formula: string): string {
  const trimmed = formula.trim();
  const match = /^(\d*)d(\d+)(.*)$/i.exec(trimmed);
  if (!match) return formula;
  const count = match[1] ? Number.parseInt(match[1], 10) : 1;
  const sides = match[2];
  const suffix = match[3] ?? "";
  return `${count * 2}d${sides}${suffix}`;
}

export function resolveAttack(params: CombatAttackParams): CombatAttackResult {
  const {
    attackerName,
    attackBonus,
    damageFormula,
    targetName,
    targetAc,
    targetHpCurrent,
    targetHpMax,
    forcedD20,
  } = params;

  const d20 = forcedD20 !== undefined ? forcedD20 : Math.floor(Math.random() * 20) + 1;
  const isCritical = d20 === 20;
  const isFumble = d20 === 1;
  const attackTotal = d20 + attackBonus;

  let hit = false;
  if (isCritical) {
    hit = true;
  } else if (isFumble) {
    hit = false;
  } else {
    hit = attackTotal >= targetAc;
  }

  let damage = 0;
  let effectiveFormula = damageFormula;

  if (hit) {
    if (isCritical) {
      effectiveFormula = doubleDiceCount(damageFormula);
    }
    const roll = rollDice(effectiveFormula);
    damage = Math.max(1, roll.total);
  }

  const targetHpAfter = Math.max(0, targetHpCurrent - damage);

  let logMessage = "";
  if (isCritical) {
    logMessage = `⚔️ [Combat] ${attackerName} attacks ${targetName}: CRITICAL HIT! Rolled Nat 20 (${attackTotal} vs AC ${targetAc}). Dealt ${damage} damage (${effectiveFormula}). ${targetName} HP: ${targetHpAfter}/${targetHpMax}.`;
  } else if (isFumble) {
    logMessage = `⚔️ [Combat] ${attackerName} attacks ${targetName}: FUMBLE! Rolled Nat 1 (${attackTotal} vs AC ${targetAc}) -> Automatic Miss!`;
  } else if (hit) {
    logMessage = `⚔️ [Combat] ${attackerName} attacks ${targetName}: HIT! Rolled ${attackTotal} vs AC ${targetAc} (d20: ${d20}${attackBonus ? (attackBonus > 0 ? `+${attackBonus}` : `${attackBonus}`) : ""}). Dealt ${damage} damage (${effectiveFormula}). ${targetName} HP: ${targetHpAfter}/${targetHpMax}.`;
  } else {
    logMessage = `⚔️ [Combat] ${attackerName} attacks ${targetName}: MISS! Rolled ${attackTotal} vs AC ${targetAc} (d20: ${d20}${attackBonus ? (attackBonus > 0 ? `+${attackBonus}` : `${attackBonus}`) : ""}).`;
  }

  return {
    attackerName,
    targetName,
    d20,
    attackBonus,
    attackTotal,
    isCritical,
    isFumble,
    hit,
    targetAc,
    damage,
    damageFormula: effectiveFormula,
    targetHpBefore: targetHpCurrent,
    targetHpAfter,
    targetHpMax,
    logMessage,
  };
}
