import { rollDice } from "../dice/dice.js";

export interface Combatant {
  id: string;
  initiative: number;
  initiativeModifier?: number;
  name?: string;
}

export interface TurnQueueEntry {
  id: string;
  entityId: string;
  name: string;
  type: "CHARACTER" | "MONSTER";
  entityType: "character" | "monster";
  initiative: number;
  ownerId: string | null;
  characterSheetId: string | null;
  hpCurrent: number;
  hpMax: number;
  ac: number;
  speed: number;
  isActive: boolean;
}

export interface CombatTimer {
  id: string;
  name: string;
  category: "spell" | "light" | "dying" | "custom";
  scope: "personal" | "gm";
  entityId: string | null;
  entityName?: string | null;
  remainingRounds: number;
  initialRounds: number;
  expired: boolean;
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

export function buildTurnQueue(
  turnOrder: string[],
  tokens: Array<{
    id: string;
    name: string;
    type: string;
    initiative: number;
    ownerId?: string | null;
    characterSheetId?: string | null;
    hpCurrent: number;
    hpMax: number;
    ac: number;
    speed?: number;
  }>,
  activeTokenId: string | null,
): TurnQueueEntry[] {
  const tokenMap = new Map(tokens.map((t) => [t.id, t]));
  const queue: TurnQueueEntry[] = [];
  for (const id of turnOrder) {
    const token = tokenMap.get(id);
    if (!token) continue;
    const upperType = token.type.toUpperCase();
    if (upperType !== "CHARACTER" && upperType !== "MONSTER") continue;
    queue.push({
      id: token.id,
      entityId: token.id,
      name: token.name,
      type: upperType,
      entityType: upperType === "CHARACTER" ? "character" : "monster",
      initiative: token.initiative,
      ownerId: token.ownerId ?? null,
      characterSheetId: token.characterSheetId ?? null,
      hpCurrent: token.hpCurrent,
      hpMax: token.hpMax,
      ac: token.ac,
      speed: token.speed ?? 6,
      isActive: token.id === activeTokenId,
    });
  }
  return queue;
}

export function advanceTurn(
  turnOrder: string[],
  currentTurnIndex: number,
  currentRound: number,
): {
  nextTurnIndex: number;
  nextRound: number;
  roundNumber: number;
  activeTokenId: string;
  activeTurnEntityId: string;
  wrappedRound: boolean;
} {
  if (turnOrder.length === 0) {
    return {
      nextTurnIndex: 0,
      nextRound: currentRound,
      roundNumber: currentRound,
      activeTokenId: "",
      activeTurnEntityId: "",
      wrappedRound: false,
    };
  }
  const nextTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
  const wrappedRound = nextTurnIndex === 0;
  const nextRound = wrappedRound ? currentRound + 1 : currentRound;
  const activeTokenId = turnOrder[nextTurnIndex] ?? "";
  return {
    nextTurnIndex,
    nextRound,
    roundNumber: nextRound,
    activeTokenId,
    activeTurnEntityId: activeTokenId,
    wrappedRound,
  };
}

export function revertTurn(
  turnOrder: string[],
  currentTurnIndex: number,
  currentRound: number,
): {
  prevTurnIndex: number;
  prevRound: number;
  roundNumber: number;
  activeTokenId: string;
  activeTurnEntityId: string;
  wrappedBack: boolean;
} {
  if (turnOrder.length === 0) {
    return {
      prevTurnIndex: 0,
      prevRound: currentRound,
      roundNumber: currentRound,
      activeTokenId: "",
      activeTurnEntityId: "",
      wrappedBack: false,
    };
  }
  if (currentTurnIndex > 0) {
    const prevTurnIndex = currentTurnIndex - 1;
    const activeTokenId = turnOrder[prevTurnIndex] ?? "";
    return {
      prevTurnIndex,
      prevRound: currentRound,
      roundNumber: currentRound,
      activeTokenId,
      activeTurnEntityId: activeTokenId,
      wrappedBack: false,
    };
  }
  if (currentRound > 1) {
    const prevTurnIndex = turnOrder.length - 1;
    const prevRound = currentRound - 1;
    const activeTokenId = turnOrder[prevTurnIndex] ?? "";
    return {
      prevTurnIndex,
      prevRound,
      roundNumber: prevRound,
      activeTokenId,
      activeTurnEntityId: activeTokenId,
      wrappedBack: true,
    };
  }
  const activeTokenId = turnOrder[0] ?? "";
  return {
    prevTurnIndex: 0,
    prevRound: 1,
    roundNumber: 1,
    activeTokenId,
    activeTurnEntityId: activeTokenId,
    wrappedBack: false,
  };
}

export function tickCombatTimers(timers: CombatTimer[], delta = -1): CombatTimer[] {
  return timers.map((timer) => {
    const nextRemaining =
      delta < 0
        ? Math.max(0, timer.remainingRounds + delta)
        : Math.min(timer.initialRounds, timer.remainingRounds + delta);
    return {
      ...timer,
      remainingRounds: nextRemaining,
      expired: nextRemaining === 0,
    };
  });
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
