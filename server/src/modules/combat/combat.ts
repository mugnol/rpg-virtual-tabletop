import { rollDice } from "../dice/dice.js";

export interface InitiativeRollMeta {
  dice: number[];
  keptDie: number;
  dexModifier: number;
  total: number;
  hasAdvantage: boolean;
  formula: string;
}

export interface Combatant {
  id: string;
  initiative: number;
  initiativeModifier?: number;
  dexModifier?: number;
  type?: string;
  hasSurprise?: boolean;
  name?: string;
}

export interface TurnQueueEntry {
  id: string;
  entityId: string;
  name: string;
  type: "CHARACTER" | "MONSTER";
  entityType: "character" | "monster";
  initiative: number;
  dexModifier: number;
  hasSurprise: boolean;
  hasInitiativeAdvantage: boolean;
  initiativeMeta: InitiativeRollMeta | null;
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
  hasAdvantage?: boolean;
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

export function hasThiefInitiativeTalent(
  characterClass?: string | null,
  talents?: string[] | null,
): boolean {
  if (Array.isArray(talents)) {
    for (const talent of talents) {
      if (
        typeof talent === "string" &&
        /advantage on initiative|initiative advantage/i.test(talent)
      ) {
        return true;
      }
    }
  }
  return false;
}

function formatSignedModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function rollInitiative(
  dexModifier = 0,
  forcedRollOrOptions?:
    | number
    | {
        hasAdvantage?: boolean;
        forcedRolls?: number[];
        characterClass?: string | null;
        talents?: string[] | null;
      },
): {
  d20: number;
  keptDie: number;
  dice: number[];
  modifier: number;
  dexModifier: number;
  total: number;
  hasAdvantage: boolean;
  formula: string;
} {
  const options =
    typeof forcedRollOrOptions === "number"
      ? { forcedRolls: [forcedRollOrOptions] }
      : (forcedRollOrOptions ?? {});

  const hasAdvantage = Boolean(
    options.hasAdvantage ||
      hasThiefInitiativeTalent(options.characterClass, options.talents),
  );

  const rollOne = (idx: number): number => {
    const forced = options.forcedRolls?.[idx];
    if (typeof forced === "number" && Number.isFinite(forced)) {
      return Math.max(1, Math.min(20, Math.trunc(forced)));
    }
    return Math.floor(Math.random() * 20) + 1;
  };

  if (hasAdvantage) {
    const d1 = rollOne(0);
    const d2 =
      options.forcedRolls && options.forcedRolls.length === 1
        ? d1
        : rollOne(1);
    const keptDie = Math.max(d1, d2);
    const total = keptDie + dexModifier;
    const formula = `2d20kh1${formatSignedModifier(dexModifier)}`;
    return {
      d20: keptDie,
      keptDie,
      dice: [d1, d2],
      modifier: dexModifier,
      dexModifier,
      total,
      hasAdvantage: true,
      formula,
    };
  }

  const d1 = rollOne(0);
  const total = d1 + dexModifier;
  const formula = `1d20${formatSignedModifier(dexModifier)}`;
  return {
    d20: d1,
    keptDie: d1,
    dice: [d1],
    modifier: dexModifier,
    dexModifier,
    total,
    hasAdvantage: false,
    formula,
  };
}

export interface EncounterInitiativeParticipant {
  id: string;
  name: string;
  type: "CHARACTER" | "MONSTER" | string;
  dexModifier?: number;
  characterClass?: string | null;
  talents?: string[] | null;
  hasAdvantage?: boolean;
  hasSurprise?: boolean;
}

export interface EncounterInitiativeResultItem {
  id: string;
  name: string;
  type: "CHARACTER" | "MONSTER";
  initiative: number;
  dexModifier: number;
  hasSurprise: boolean;
  meta: InitiativeRollMeta;
}

export function rollEncounterInitiative(
  participants: EncounterInitiativeParticipant[],
  options?: {
    groupMonsterInitiative?: boolean;
    forcedRollsById?: Record<string, number[]>;
    forcedGroupMonsterRoll?: number;
    defaultPcAdvantageBias?: boolean;
    isSurpriseRound?: boolean;
  },
): {
  results: EncounterInitiativeResultItem[];
  turnOrder: string[];
  isSurpriseRound: boolean;
} {
  const groupMonsters = Boolean(options?.groupMonsterInitiative);
  const forcedById = options?.forcedRollsById ?? {};
  const bias = Boolean(options?.defaultPcAdvantageBias);

  const sampleDie = (isChar: boolean): number => {
    if (bias) {
      return isChar
        ? Math.floor(Math.random() * 10) + 11
        : Math.floor(Math.random() * 10) + 1;
    }
    return Math.floor(Math.random() * 20) + 1;
  };

  const monsters = participants.filter(
    (p) => p.type.toUpperCase() === "MONSTER",
  );
  const highestMonsterDex =
    monsters.length > 0
      ? Math.max(...monsters.map((m) => m.dexModifier ?? 0))
      : 0;

  let sharedMonsterMeta: InitiativeRollMeta | null = null;
  if (groupMonsters && monsters.length > 0) {
    const groupDie =
      options?.forcedGroupMonsterRoll !== undefined
        ? options.forcedGroupMonsterRoll
        : sampleDie(false);
    const groupRoll = rollInitiative(highestMonsterDex, {
      hasAdvantage: false,
      forcedRolls: [groupDie],
    });
    sharedMonsterMeta = {
      dice: groupRoll.dice,
      keptDie: groupRoll.keptDie,
      dexModifier: highestMonsterDex,
      total: groupRoll.total,
      hasAdvantage: false,
      formula: groupRoll.formula,
    };
  }

  const results: EncounterInitiativeResultItem[] = participants.map((p) => {
    const upperType =
      p.type.toUpperCase() === "CHARACTER" ? "CHARACTER" : "MONSTER";
    const dexMod = p.dexModifier ?? 0;
    const hasSurprise = Boolean(p.hasSurprise);

    if (upperType === "MONSTER" && groupMonsters && sharedMonsterMeta) {
      return {
        id: p.id,
        name: p.name,
        type: "MONSTER",
        initiative: sharedMonsterMeta.total,
        dexModifier: dexMod,
        hasSurprise,
        meta: { ...sharedMonsterMeta },
      };
    }

    const adv = Boolean(
      p.hasAdvantage || hasThiefInitiativeTalent(p.characterClass, p.talents),
    );
    const forced = forcedById[p.id];
    const generatedRolls =
      forced && forced.length > 0
        ? forced
        : adv
          ? [sampleDie(upperType === "CHARACTER"), sampleDie(upperType === "CHARACTER")]
          : [sampleDie(upperType === "CHARACTER")];

    const rolled = rollInitiative(dexMod, {
      hasAdvantage: adv,
      forcedRolls: generatedRolls,
    });

    return {
      id: p.id,
      name: p.name,
      type: upperType,
      initiative: rolled.total,
      dexModifier: dexMod,
      hasSurprise,
      meta: {
        dice: rolled.dice,
        keptDie: rolled.keptDie,
        dexModifier: dexMod,
        total: rolled.total,
        hasAdvantage: rolled.hasAdvantage,
        formula: rolled.formula,
      },
    };
  });

  const isSurpriseRound =
    options?.isSurpriseRound !== undefined
      ? options.isSurpriseRound
      : results.some((r) => r.hasSurprise);

  const turnOrder = sortInitiative(
    results.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      initiative: r.initiative,
      dexModifier: r.dexModifier,
      hasSurprise: r.hasSurprise,
    })),
    { isSurpriseRound },
  );

  return {
    results,
    turnOrder,
    isSurpriseRound,
  };
}

export function sortInitiative(
  combatants: Combatant[],
  options?: { isSurpriseRound?: boolean },
): string[] {
  const considerSurprise = options?.isSurpriseRound !== false;
  const sorted = [...combatants].sort((a, b) => {
    if (considerSurprise) {
      const surpA = Boolean(a.hasSurprise);
      const surpB = Boolean(b.hasSurprise);
      if (surpA !== surpB) {
        return surpB ? 1 : -1;
      }
    }
    if (b.initiative !== a.initiative) {
      return b.initiative - a.initiative;
    }
    const modA = a.dexModifier ?? a.initiativeModifier ?? 0;
    const modB = b.dexModifier ?? b.initiativeModifier ?? 0;
    if (modB !== modA) {
      return modB - modA;
    }
    const prioA = a.type?.toUpperCase() === "CHARACTER" ? 1 : a.type?.toUpperCase() === "MONSTER" ? 0 : 0;
    const prioB = b.type?.toUpperCase() === "CHARACTER" ? 1 : b.type?.toUpperCase() === "MONSTER" ? 0 : 0;
    if (prioB !== prioA) {
      return prioB - prioA;
    }
    return a.id.localeCompare(b.id);
  });
  return sorted.map((c) => c.id);
}

export function moveTurnQueueEntry(
  turnOrder: string[],
  tokenId: string,
  direction: "up" | "down",
  activeTokenId: string | null,
): {
  turnOrder: string[];
  activeTokenId: string;
  turnIndex: number;
} {
  const list = [...turnOrder];
  const idx = list.indexOf(tokenId);
  if (idx === -1) {
    const activeId = activeTokenId ?? list[0] ?? "";
    const activeIdx = list.indexOf(activeId);
    return { turnOrder: list, activeTokenId: activeId, turnIndex: Math.max(0, activeIdx) };
  }

  if (direction === "up" && idx > 0) {
    const temp = list[idx - 1];
    list[idx - 1] = list[idx];
    list[idx] = temp;
  } else if (direction === "down" && idx < list.length - 1) {
    const temp = list[idx + 1];
    list[idx + 1] = list[idx];
    list[idx] = temp;
  }

  const resolvedActive =
    activeTokenId && list.includes(activeTokenId) ? activeTokenId : list[0] ?? "";
  const newActiveIndex = resolvedActive ? list.indexOf(resolvedActive) : 0;

  return {
    turnOrder: list,
    activeTokenId: resolvedActive,
    turnIndex: Math.max(0, newActiveIndex),
  };
}

export function reorderTurnQueue(
  turnOrder: string[],
  orderedTokenIds: string[],
  activeTokenId: string | null,
): {
  turnOrder: string[];
  activeTokenId: string;
  turnIndex: number;
} {
  const currentSet = new Set(turnOrder);
  const reordered: string[] = [];
  for (const id of orderedTokenIds) {
    if (currentSet.has(id) && !reordered.includes(id)) {
      reordered.push(id);
    }
  }
  for (const id of turnOrder) {
    if (!reordered.includes(id)) {
      reordered.push(id);
    }
  }

  const resolvedActive =
    activeTokenId && reordered.includes(activeTokenId) ? activeTokenId : reordered[0] ?? "";
  const newActiveIndex = resolvedActive ? reordered.indexOf(resolvedActive) : 0;

  return {
    turnOrder: reordered,
    activeTokenId: resolvedActive,
    turnIndex: Math.max(0, newActiveIndex),
  };
}

function parseInitiativeMeta(raw?: string | InitiativeRollMeta | null): InitiativeRollMeta | null {
  if (!raw) return null;
  if (typeof raw === "object") {
    return Array.isArray(raw.dice) ? raw : null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<InitiativeRollMeta>;
    if (Array.isArray(parsed.dice) && typeof parsed.total === "number") {
      return {
        dice: parsed.dice,
        keptDie: typeof parsed.keptDie === "number" ? parsed.keptDie : parsed.dice[0] ?? 0,
        dexModifier: typeof parsed.dexModifier === "number" ? parsed.dexModifier : 0,
        total: parsed.total,
        hasAdvantage: Boolean(parsed.hasAdvantage),
        formula: typeof parsed.formula === "string" ? parsed.formula : "1d20",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildTurnQueue(
  turnOrder: string[],
  tokens: Array<{
    id: string;
    name: string;
    type: string;
    initiative: number;
    dexModifier?: number;
    hasSurprise?: boolean;
    initiativeMeta?: string | InitiativeRollMeta | null;
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
    const meta = parseInitiativeMeta(token.initiativeMeta);
    const dexModifier = token.dexModifier ?? meta?.dexModifier ?? 0;
    queue.push({
      id: token.id,
      entityId: token.id,
      name: token.name,
      type: upperType,
      entityType: upperType === "CHARACTER" ? "character" : "monster",
      initiative: token.initiative,
      dexModifier,
      hasSurprise: Boolean(token.hasSurprise),
      hasInitiativeAdvantage: Boolean(meta?.hasAdvantage),
      initiativeMeta: meta,
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
