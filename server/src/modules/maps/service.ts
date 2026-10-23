import type { CombatState, MapToken } from "@prisma/client";
import { prisma } from "../../db.js";
import { ApiError } from "../../middleware/errors.js";
import { assertOwner, assertParticipant } from "../campaigns/service.js";
import {
  advanceTurn,
  buildTurnQueue,
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
  type InitiativeRollMeta,
  type TurnQueueEntry,
} from "../combat/combat.js";
import { findSessionWithCampaign } from "../sessions/service.js";
import {
  computeMonsterStatsFromRole,
  getShadowdarkMonster,
} from "../../rules/shadowdarkMonsters.js";
import {
  getPredefinedAvatar,
  resolveTokenAvatar,
} from "../../rules/avatars.js";
import type {
  CombatAttackInput,
  CombatNextInput,
  CombatReorderInput,
  CombatRollInitiativeInput,
  CombatSetInitiativeInput,
  CombatSettingsInput,
  CombatStartInput,
  CombatSurpriseInput,
  CombatTimerCreateInput,
  MapCreateInput,
  MapUpdateInput,
  TokenCreateInput,
  TokenUpdateInput,
} from "./schemas.js";

const MAP_NOT_FOUND = new ApiError(404, "NOT_FOUND", "Map not found");
const TOKEN_NOT_FOUND = new ApiError(404, "NOT_FOUND", "Token not found");

export interface FormattedCombatState {
  id: string;
  mapId: string;
  active: boolean;
  round: number;
  roundNumber: number;
  turnIndex: number;
  activeTokenId: string | null;
  activeTurnEntityId: string | null;
  turnOrder: string[];
  turnQueue: TurnQueueEntry[];
  timers: CombatTimer[];
  chaosMode: boolean;
  groupMonsterInitiative: boolean;
  isSurpriseRound: boolean;
  freeformMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function formatCombatState(
  combat: CombatState | null | undefined,
  tokens: MapToken[],
): FormattedCombatState | null {
  if (!combat) return null;
  const turnOrder = parseJsonArray<string>(combat.turnOrder);
  const timers = parseJsonArray<CombatTimer>((combat as CombatState & { timers?: string }).timers);
  const turnQueue = buildTurnQueue(turnOrder, tokens, combat.activeTokenId);

  return {
    ...combat,
    round: combat.round,
    roundNumber: combat.round,
    activeTokenId: combat.activeTokenId,
    activeTurnEntityId: combat.activeTokenId,
    turnOrder,
    turnQueue,
    timers,
    chaosMode: Boolean(combat.chaosMode),
    groupMonsterInitiative: Boolean(combat.groupMonsterInitiative),
    isSurpriseRound: Boolean(combat.isSurpriseRound),
    freeformMode: Boolean((combat as any).freeformMode),
  };
}

export function formatMapWithCombat<T extends { combat?: CombatState | null; tokens: MapToken[] }>(
  map: T,
) {
  return {
    ...map,
    combat: formatCombatState(map.combat, map.tokens),
  };
}

export async function findMapWithSession(mapId: string) {
  const map = await prisma.sessionMap.findUnique({
    where: { id: mapId },
    include: {
      session: {
        include: {
          campaign: {
            include: {
              members: { include: { user: true } },
              invites: true,
            },
          },
        },
      },
      tokens: true,
      combat: true,
    },
  });
  if (!map) {
    throw MAP_NOT_FOUND;
  }
  return map;
}

export async function listSessionMaps(userId: string, sessionId: string) {
  const session = await findSessionWithCampaign(sessionId);
  assertParticipant(session.campaign, userId);

  const maps = await prisma.sessionMap.findMany({
    where: { sessionId },
    include: {
      tokens: true,
      combat: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return maps.map(formatMapWithCombat);
}

export async function createSessionMap(
  userId: string,
  sessionId: string,
  input: MapCreateInput,
) {
  const session = await findSessionWithCampaign(sessionId);
  assertOwner(session.campaign, userId);

  const map = await prisma.sessionMap.create({
    data: {
      sessionId,
      name: input.name,
      theme: input.theme,
      width: input.width,
      height: input.height,
      allowPlayerMovement: input.allowPlayerMovement,
      combat: {
        create: {
          active: false,
          round: 1,
          turnIndex: 0,
          turnOrder: "[]",
          timers: "[]",
        },
      },
    },
    include: {
      tokens: true,
      combat: true,
    },
  });

  return formatMapWithCombat(map);
}

export async function getMap(userId: string, mapId: string) {
  const map = await findMapWithSession(mapId);
  assertParticipant(map.session.campaign, userId);
  return formatMapWithCombat(map);
}

export async function updateMap(
  userId: string,
  mapId: string,
  input: MapUpdateInput,
) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  const updated = await prisma.sessionMap.update({
    where: { id: mapId },
    data: input,
    include: {
      tokens: true,
      combat: true,
    },
  });

  return formatMapWithCombat(updated);
}

export async function placeToken(
  userId: string,
  mapId: string,
  input: TokenCreateInput,
) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  let x = input.x;
  let y = input.y;
  if (x === undefined || y === undefined) {
    const occupied = new Set(map.tokens.map((t) => `${t.x},${t.y}`));
    let found = false;
    for (let r = 0; r < map.height; r++) {
      for (let c = 0; c < map.width; c++) {
        if (!occupied.has(`${c},${r}`)) {
          x = c;
          y = r;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      x = 0;
      y = 0;
    }
  }

  if (x < 0 || x >= map.width || y < 0 || y >= map.height) {
    throw new ApiError(400, "OUT_OF_BOUNDS", "Coordinates are out of map bounds");
  }

  let name = input.name ?? "Token";
  let hpMax = input.hpMax ?? 10;
  let hpCurrent = input.hpCurrent ?? hpMax;
  let ac = input.ac ?? 10;
  let ownerId = input.ownerId ?? null;
  let attackBonus = input.attackBonus ?? 0;
  let damageFormula = input.damageFormula ?? "1d6";
  let dexModifier = input.dexModifier ?? input.initiative ?? 0;
  let initiative = input.initiative ?? dexModifier;
  let hasAdvantage = false;
  let speed = input.speed ?? 6;

  if (input.type === "MONSTER") {
    if (input.monsterKey) {
      const monster = getShadowdarkMonster(input.monsterKey);
      if (monster) {
        name = input.name ?? monster.name;
        hpMax = input.hpMax ?? monster.hp;
        hpCurrent = input.hpCurrent ?? hpMax;
        ac = input.ac ?? monster.ac;
        dexModifier = input.dexModifier ?? monster.modifiers.dex;
        initiative = input.initiative ?? dexModifier;
        attackBonus = input.attackBonus ?? (monster.attacks[0]?.bonus ?? monster.level);
        damageFormula = input.damageFormula ?? (monster.attacks[0]?.damage ?? "1d6");
        speed = input.speed ?? monster.speed ?? (monster.movement.toLowerCase().includes("double") ? 12 : 6);
      }
    } else if (input.monsterRole) {
      const roleStats = computeMonsterStatsFromRole(input.monsterRole as any, input.level ?? 1);
      hpMax = input.hpMax ?? roleStats.hp;
      hpCurrent = input.hpCurrent ?? hpMax;
      ac = input.ac ?? roleStats.ac;
      attackBonus = input.attackBonus ?? roleStats.attackBonus;
      damageFormula = input.damageFormula ?? roleStats.damageFormula;
    }
  }

  let sheet: any = null;
  if (input.type === "CHARACTER" && input.characterSheetId) {
    sheet = await prisma.characterSheet.findUnique({
      where: { id: input.characterSheetId },
    });
    if (sheet) {
      name = input.name ?? sheet.name;
      hpMax = sheet.hpMax;
      hpCurrent = sheet.hpCurrent;
      ownerId = sheet.ownerId;
      try {
        const abilities = JSON.parse(sheet.abilities) as Record<string, number>;
        const dex = abilities.dex ?? abilities.DEX ?? 10;
        const dexMod = Math.floor((dex - 10) / 2);
        const str = abilities.str ?? abilities.STR ?? 10;
        const strMod = Math.floor((str - 10) / 2);
        dexModifier = input.dexModifier ?? dexMod;
        initiative = input.initiative ?? dexModifier;
        attackBonus = Math.max(dexMod, strMod) + 2; // mod + level 1 proficiency
        ac = 10 + dexMod;
        const extras = JSON.parse(sheet.extras) as { talents?: string[] };
        hasAdvantage = hasThiefInitiativeTalent(sheet.classId, extras.talents);
      } catch {
        // use defaults
      }
    }
  }

  let initiativeMeta: InitiativeRollMeta | Record<string, never> = hasAdvantage
    ? {
        dice: [],
        keptDie: 0,
        dexModifier,
        total: initiative,
        hasAdvantage: true,
        formula: `2d20kh1${dexModifier >= 0 ? `+${dexModifier}` : `${dexModifier}`}`,
      }
    : {};

  // If combat is already active and a new CHARACTER or MONSTER joins, ensure it has an initiative score & joins turnOrder
  const isCombatant = input.type === "CHARACTER" || input.type === "MONSTER";
  if (map.combat?.active && isCombatant && input.initiative === undefined) {
    const rolled = rollInitiative(dexModifier, { hasAdvantage });
    initiative = rolled.total;
    initiativeMeta = {
      dice: rolled.dice,
      keptDie: rolled.keptDie,
      dexModifier,
      total: rolled.total,
      hasAdvantage: rolled.hasAdvantage,
      formula: rolled.formula,
    };
  }

  const resolvedAvatar = resolveTokenAvatar({
    type: input.type,
    avatarKey: input.avatarKey,
    imageUrl: input.imageUrl,
    characterClassId: sheet?.classId,
    characterLevel: sheet?.level,
    monsterKey: input.monsterKey,
    monsterRole: input.monsterRole,
  });

  const token = await prisma.mapToken.create({
    data: {
      mapId,
      type: input.type,
      name,
      characterSheetId: input.characterSheetId ?? null,
      ownerId,
      x,
      y,
      color:
        input.color ??
        (input.type === "CHARACTER"
          ? "#6366f1"
          : input.type === "MONSTER"
            ? "#ef4444"
            : "#f59e0b"),
      imageUrl: resolvedAvatar.imageUrl,
      avatarKey: resolvedAvatar.avatarKey,
      hpMax,
      hpCurrent,
      ac,
      speed,
      attackBonus,
      damageFormula,
      initiative,
      dexModifier,
      hasSurprise: input.hasSurprise ?? false,
      initiativeMeta: JSON.stringify(initiativeMeta),
    },
  });

  if (map.combat?.active && isCombatant) {
    const allTokens = [...map.tokens, token].filter(
      (t) => t.type === "CHARACTER" || t.type === "MONSTER",
    );
    const sortedOrder = sortInitiative(
      allTokens.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        initiative: t.initiative,
        dexModifier: t.dexModifier,
        hasSurprise: t.hasSurprise,
      })),
      { isSurpriseRound: map.combat.isSurpriseRound },
    );
    const currentActiveId = map.combat.activeTokenId ?? sortedOrder[0] ?? null;
    const nextIdx = currentActiveId ? Math.max(0, sortedOrder.indexOf(currentActiveId)) : 0;
    await prisma.combatState.update({
      where: { mapId },
      data: {
        turnOrder: JSON.stringify(sortedOrder),
        turnIndex: nextIdx,
        activeTokenId: sortedOrder[nextIdx] ?? null,
      },
    });
  }

  return token;
}

export async function moveOrUpdateToken(
  userId: string,
  tokenId: string,
  input: TokenUpdateInput,
) {
  const token = await prisma.mapToken.findUnique({
    where: { id: tokenId },
    include: {
      map: {
        include: {
          session: {
            include: {
              campaign: {
                include: { members: { include: { user: true } }, invites: true },
              },
            },
          },
          combat: true,
        },
      },
    },
  });
  if (!token) throw TOKEN_NOT_FOUND;

  const map = token.map;
  const isOwner = map.session.campaign.ownerId === userId;
  assertParticipant(map.session.campaign, userId);

  // Bounds check if coordinates change
  const targetX = input.x !== undefined ? input.x : token.x;
  const targetY = input.y !== undefined ? input.y : token.y;
  if (targetX < 0 || targetX >= map.width || targetY < 0 || targetY >= map.height) {
    throw new ApiError(400, "OUT_OF_BOUNDS", "Coordinates are out of map bounds");
  }

  // Authorization check for players
  if (!isOwner) {
    if (map.combat?.active) {
      if (token.type !== "CHARACTER" || token.ownerId !== userId) {
        throw new ApiError(403, "FORBIDDEN", "You can only move your own character token");
      }
      if (map.combat.activeTokenId !== token.id) {
        throw new ApiError(403, "NOT_YOUR_TURN", "It is not your turn to act");
      }
      if (input.x !== undefined || input.y !== undefined) {
        const dx = Math.abs(targetX - token.x);
        const dy = Math.abs(targetY - token.y);
        const dist = Math.max(dx, dy);
        if (dist > token.speed) {
          throw new ApiError(
            400,
            "EXCEEDS_SPEED",
            `Movement exceeds speed limit of ${token.speed} squares`,
          );
        }
      }
    } else {
      if (!map.allowPlayerMovement) {
        throw new ApiError(403, "MOVEMENT_DISABLED", "Player movement is disabled by the GM");
      }
      if (token.type !== "CHARACTER" || token.ownerId !== userId) {
        throw new ApiError(403, "FORBIDDEN", "You can only move your own character token");
      }
    }
  }

  const updateData: Record<string, any> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.x !== undefined) updateData.x = input.x;
  if (input.y !== undefined) updateData.y = input.y;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.hpMax !== undefined) updateData.hpMax = input.hpMax;
  if (input.hpCurrent !== undefined) updateData.hpCurrent = input.hpCurrent;
  if (input.ac !== undefined) updateData.ac = input.ac;
  if (input.speed !== undefined) updateData.speed = input.speed;
  if (input.attackBonus !== undefined) updateData.attackBonus = input.attackBonus;
  if (input.damageFormula !== undefined) updateData.damageFormula = input.damageFormula;
  if (input.initiative !== undefined) updateData.initiative = input.initiative;
  if (input.dexModifier !== undefined) updateData.dexModifier = input.dexModifier;
  if (input.hasSurprise !== undefined) updateData.hasSurprise = input.hasSurprise;

  if (input.imageUrl !== undefined) {
    updateData.imageUrl = input.imageUrl;
  }
  if (input.avatarKey !== undefined) {
    updateData.avatarKey = input.avatarKey;
    if (input.imageUrl === undefined && input.avatarKey) {
      const matched = getPredefinedAvatar(input.avatarKey);
      if (matched) {
        updateData.imageUrl = matched.url;
      }
    }
  }

  const updated = await prisma.mapToken.update({
    where: { id: tokenId },
    data: updateData,
  });

  return updated;
}

export async function deleteToken(userId: string, tokenId: string) {
  const token = await prisma.mapToken.findUnique({
    where: { id: tokenId },
    include: {
      map: {
        include: {
          session: {
            include: {
              campaign: {
                include: { members: { include: { user: true } }, invites: true },
              },
            },
          },
          combat: true,
        },
      },
    },
  });
  if (!token) throw TOKEN_NOT_FOUND;

  assertOwner(token.map.session.campaign, userId);

  await prisma.mapToken.delete({ where: { id: tokenId } });

  // Remove deleted token from active turnOrder if present
  if (token.map.combat?.active) {
    const order = parseJsonArray<string>(token.map.combat.turnOrder).filter((id) => id !== tokenId);
    const nextIdx = order.length > 0 ? Math.min(token.map.combat.turnIndex, order.length - 1) : 0;
    const nextActiveId = order[nextIdx] ?? null;
    await prisma.combatState.update({
      where: { mapId: token.mapId },
      data: {
        turnOrder: JSON.stringify(order),
        turnIndex: nextIdx,
        activeTokenId: nextActiveId,
        active: order.length > 0,
      },
    });
  }
}

async function buildParticipantsWithSheetInfo(combatants: MapToken[]) {
  const sheetIds = combatants
    .map((t) => t.characterSheetId)
    .filter((id): id is string => Boolean(id));
  const sheets =
    sheetIds.length > 0
      ? await prisma.characterSheet.findMany({ where: { id: { in: sheetIds } } })
      : [];
  const sheetMap = new Map(sheets.map((s) => [s.id, s]));

  return combatants.map((t) => {
    const sheet = t.characterSheetId ? sheetMap.get(t.characterSheetId) : undefined;
    let dexModifier = t.dexModifier ?? 0;
    let talents: string[] = [];
    const characterClass = sheet?.classId ?? null;
    if (sheet) {
      try {
        const abilities = JSON.parse(sheet.abilities) as Record<string, number>;
        const dex = abilities.dex ?? abilities.DEX ?? 10;
        dexModifier = Math.floor((dex - 10) / 2);
      } catch {
        // fallback to token.dexModifier
      }
      try {
        const extras = JSON.parse(sheet.extras) as { talents?: string[] };
        if (Array.isArray(extras.talents)) {
          talents = extras.talents;
        }
      } catch {
        // ignore
      }
    }
    return {
      id: t.id,
      name: t.name,
      type: t.type as "CHARACTER" | "MONSTER",
      dexModifier,
      characterClass,
      talents,
      hasSurprise: Boolean(t.hasSurprise),
    };
  });
}

export async function startCombat(
  userId: string,
  mapId: string,
  input?: CombatStartInput,
) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  // Eligible combatants: CHARACTER and MONSTER tokens
  const combatants = map.tokens.filter((t) => t.type === "CHARACTER" || t.type === "MONSTER");
  if (combatants.length === 0) {
    throw new ApiError(400, "NO_COMBATANTS", "No combatants found on map");
  }

  const groupMonsterInitiative =
    input?.groupMonsterInitiative ?? map.combat?.groupMonsterInitiative ?? false;
  const chaosMode = input?.chaosMode ?? map.combat?.chaosMode ?? false;

  const participants = await buildParticipantsWithSheetInfo(combatants);
  const { results, turnOrder, isSurpriseRound } = rollEncounterInitiative(participants, {
    groupMonsterInitiative,
    forcedRollsById: input?.forcedRollsById,
    forcedGroupMonsterRoll: input?.forcedGroupMonsterRoll,
    defaultPcAdvantageBias: true,
  });

  // Update initiative, dexModifier, and initiativeMeta on tokens
  for (const r of results) {
    await prisma.mapToken.update({
      where: { id: r.id },
      data: {
        initiative: r.initiative,
        dexModifier: r.dexModifier,
        initiativeMeta: JSON.stringify(r.meta),
      },
    });
  }

  const activeTokenId = turnOrder[0] ?? null;

  const combat = await prisma.combatState.upsert({
    where: { mapId },
    create: {
      mapId,
      active: true,
      round: 1,
      turnIndex: 0,
      activeTokenId,
      turnOrder: JSON.stringify(turnOrder),
      timers: "[]",
      chaosMode,
      groupMonsterInitiative,
      isSurpriseRound,
    },
    update: {
      active: true,
      round: 1,
      turnIndex: 0,
      activeTokenId,
      turnOrder: JSON.stringify(turnOrder),
      timers: "[]",
      chaosMode,
      groupMonsterInitiative,
      isSurpriseRound,
    },
  });

  const refreshedTokens = await prisma.mapToken.findMany({ where: { mapId } });

  return {
    combat: formatCombatState(combat, refreshedTokens)!,
    tokens: refreshedTokens,
  };
}

export async function rollCombatInitiative(
  userId: string,
  mapId: string,
  input?: CombatRollInitiativeInput,
) {
  const map = await findMapWithSession(mapId);
  assertParticipant(map.session.campaign, userId);

  const isOwner = map.session.campaign.ownerId === userId;
  const combatants = map.tokens.filter((t) => t.type === "CHARACTER" || t.type === "MONSTER");
  if (combatants.length === 0) {
    throw new ApiError(400, "NO_COMBATANTS", "No combatants found on map");
  }

  const participants = await buildParticipantsWithSheetInfo(combatants);
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  let targetTokenIds: string[] = [];
  if (input?.tokenId) {
    const token = combatants.find((t) => t.id === input.tokenId);
    if (!token) throw TOKEN_NOT_FOUND;
    if (!isOwner && token.ownerId !== userId) {
      throw new ApiError(403, "FORBIDDEN", "You can only roll initiative for your own character");
    }
    targetTokenIds = [token.id];
  } else if (!isOwner) {
    const owned = combatants.filter((t) => t.ownerId === userId);
    if (owned.length === 0) {
      throw new ApiError(403, "FORBIDDEN", "No owned character token found on this map");
    }
    targetTokenIds = owned.map((t) => t.id);
  } else {
    targetTokenIds = combatants.map((t) => t.id);
  }

  const forcedById: Record<string, number[]> = { ...(input?.forcedRollsById ?? {}) };
  if (input?.tokenId && input?.forcedRolls) {
    forcedById[input.tokenId] = input.forcedRolls;
  }

  const logParts: string[] = [];

  if (isOwner && !input?.tokenId) {
    const groupMonsters = Boolean(map.combat?.groupMonsterInitiative);
    const { results } = rollEncounterInitiative(participants, {
      groupMonsterInitiative: groupMonsters,
      forcedRollsById: forcedById,
      forcedGroupMonsterRoll: input?.forcedGroupMonsterRoll,
    });
    for (const r of results) {
      await prisma.mapToken.update({
        where: { id: r.id },
        data: {
          initiative: r.initiative,
          dexModifier: r.dexModifier,
          initiativeMeta: JSON.stringify(r.meta),
        },
      });
      const diceStr = r.meta.hasAdvantage
        ? `2d20kh1 [${r.meta.dice.join(", ")}] -> ${r.meta.keptDie}`
        : `d20: ${r.meta.keptDie}`;
      const modStr =
        r.meta.dexModifier >= 0 ? `+${r.meta.dexModifier}` : `${r.meta.dexModifier}`;
      logParts.push(`${r.name}: ${r.initiative} (${diceStr}${modStr})`);
    }
  } else {
    for (const tid of targetTokenIds) {
      const p = participantMap.get(tid);
      if (!p) continue;
      const adv = hasThiefInitiativeTalent(p.characterClass, p.talents);
      const rolled = rollInitiative(p.dexModifier, {
        hasAdvantage: adv,
        forcedRolls: forcedById[tid] ?? input?.forcedRolls,
      });
      const meta: InitiativeRollMeta = {
        dice: rolled.dice,
        keptDie: rolled.keptDie,
        dexModifier: p.dexModifier,
        total: rolled.total,
        hasAdvantage: rolled.hasAdvantage,
        formula: rolled.formula,
      };
      await prisma.mapToken.update({
        where: { id: tid },
        data: {
          initiative: rolled.total,
          dexModifier: p.dexModifier,
          initiativeMeta: JSON.stringify(meta),
        },
      });
      const diceStr = meta.hasAdvantage
        ? `2d20kh1 [${meta.dice.join(", ")}] -> ${meta.keptDie}`
        : `d20: ${meta.keptDie}`;
      const modStr = meta.dexModifier >= 0 ? `+${meta.dexModifier}` : `${meta.dexModifier}`;
      logParts.push(`${p.name}: ${rolled.total} (${diceStr}${modStr})`);
    }
  }

  const refreshedTokens = await prisma.mapToken.findMany({ where: { mapId } });
  const refreshedCombatants = refreshedTokens.filter(
    (t) => t.type === "CHARACTER" || t.type === "MONSTER",
  );
  const isSurpriseRound = Boolean(map.combat?.isSurpriseRound);
  const sortedOrder = sortInitiative(
    refreshedCombatants.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      initiative: t.initiative,
      dexModifier: t.dexModifier,
      hasSurprise: t.hasSurprise,
    })),
    { isSurpriseRound },
  );

  const nextIdx = map.combat
    ? Math.min(map.combat.turnIndex, Math.max(0, sortedOrder.length - 1))
    : 0;
  const nextActiveId = sortedOrder[nextIdx] ?? null;

  const updatedCombat = await prisma.combatState.upsert({
    where: { mapId },
    create: {
      mapId,
      active: false,
      round: 1,
      turnIndex: 0,
      activeTokenId: nextActiveId,
      turnOrder: JSON.stringify(sortedOrder),
      timers: "[]",
    },
    update: {
      turnOrder: JSON.stringify(sortedOrder),
      turnIndex: nextIdx,
      activeTokenId: nextActiveId,
    },
  });

  const content = `🎲 [Initiative] Rolled Initiative — ${logParts.join(" | ")}`;
  const chatMsg = await prisma.sessionMessage.create({
    data: {
      sessionId: map.sessionId,
      userId,
      type: "COMBAT",
      content,
    },
  });

  return {
    combat: formatCombatState(updatedCombat, refreshedTokens)!,
    tokens: refreshedTokens,
    message: chatMsg,
  };
}

export async function setCombatInitiative(
  userId: string,
  mapId: string,
  input: CombatSetInitiativeInput,
) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  const token = map.tokens.find((t) => t.id === input.tokenId);
  if (!token) throw TOKEN_NOT_FOUND;

  const existingMeta = (() => {
    try {
      return JSON.parse(token.initiativeMeta) as Partial<InitiativeRollMeta>;
    } catch {
      return {};
    }
  })();

  const meta: InitiativeRollMeta = {
    dice: Array.isArray(existingMeta.dice) ? existingMeta.dice : [input.initiative - token.dexModifier],
    keptDie:
      typeof existingMeta.keptDie === "number"
        ? existingMeta.keptDie
        : input.initiative - token.dexModifier,
    dexModifier: token.dexModifier,
    total: input.initiative,
    hasAdvantage: Boolean(existingMeta.hasAdvantage),
    formula: typeof existingMeta.formula === "string" ? existingMeta.formula : "manual",
  };

  const updatedToken = await prisma.mapToken.update({
    where: { id: token.id },
    data: {
      initiative: input.initiative,
      initiativeMeta: JSON.stringify(meta),
    },
  });

  const refreshedTokens = await prisma.mapToken.findMany({ where: { mapId } });
  const refreshedCombatants = refreshedTokens.filter(
    (t) => t.type === "CHARACTER" || t.type === "MONSTER",
  );
  const isSurpriseRound = Boolean(map.combat?.isSurpriseRound);
  const sortedOrder = sortInitiative(
    refreshedCombatants.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      initiative: t.initiative,
      dexModifier: t.dexModifier,
      hasSurprise: t.hasSurprise,
    })),
    { isSurpriseRound },
  );

  const nextIdx = map.combat
    ? Math.min(map.combat.turnIndex, Math.max(0, sortedOrder.length - 1))
    : 0;
  const nextActiveId = sortedOrder[nextIdx] ?? null;

  const updatedCombat = await prisma.combatState.upsert({
    where: { mapId },
    create: {
      mapId,
      active: false,
      round: 1,
      turnIndex: 0,
      activeTokenId: nextActiveId,
      turnOrder: JSON.stringify(sortedOrder),
      timers: "[]",
    },
    update: {
      turnOrder: JSON.stringify(sortedOrder),
      turnIndex: nextIdx,
      activeTokenId: nextActiveId,
    },
  });

  return {
    token: updatedToken,
    combat: formatCombatState(updatedCombat, refreshedTokens)!,
    tokens: refreshedTokens,
  };
}

export async function toggleTokenSurprise(
  userId: string,
  mapId: string,
  input: CombatSurpriseInput,
) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  const token = map.tokens.find((t) => t.id === input.tokenId);
  if (!token) throw TOKEN_NOT_FOUND;

  const nextSurprise =
    input.hasSurprise !== undefined ? input.hasSurprise : !token.hasSurprise;

  const updatedToken = await prisma.mapToken.update({
    where: { id: token.id },
    data: { hasSurprise: nextSurprise },
  });

  const refreshedTokens = await prisma.mapToken.findMany({ where: { mapId } });
  const refreshedCombatants = refreshedTokens.filter(
    (t) => t.type === "CHARACTER" || t.type === "MONSTER",
  );
  const anySurprise = refreshedCombatants.some((t) => t.hasSurprise);
  const isSurpriseRound =
    anySurprise && (!map.combat || !map.combat.active || map.combat.round === 1);

  const sortedOrder = sortInitiative(
    refreshedCombatants.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      initiative: t.initiative,
      dexModifier: t.dexModifier,
      hasSurprise: t.hasSurprise,
    })),
    { isSurpriseRound },
  );

  const nextIdx = map.combat
    ? Math.min(map.combat.turnIndex, Math.max(0, sortedOrder.length - 1))
    : 0;
  const nextActiveId = sortedOrder[nextIdx] ?? null;

  const updatedCombat = await prisma.combatState.upsert({
    where: { mapId },
    create: {
      mapId,
      active: false,
      round: 1,
      turnIndex: 0,
      activeTokenId: nextActiveId,
      turnOrder: JSON.stringify(sortedOrder),
      timers: "[]",
      isSurpriseRound,
    },
    update: {
      turnOrder: JSON.stringify(sortedOrder),
      turnIndex: nextIdx,
      activeTokenId: nextActiveId,
      isSurpriseRound,
    },
  });

  return {
    token: updatedToken,
    combat: formatCombatState(updatedCombat, refreshedTokens)!,
    tokens: refreshedTokens,
  };
}

export async function updateCombatSettings(
  userId: string,
  mapId: string,
  input: CombatSettingsInput,
) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  const data: { chaosMode?: boolean; groupMonsterInitiative?: boolean; freeformMode?: boolean } = {};
  if (input.chaosMode !== undefined) data.chaosMode = input.chaosMode;
  if (input.groupMonsterInitiative !== undefined) {
    data.groupMonsterInitiative = input.groupMonsterInitiative;
  }
  if (input.freeformMode !== undefined) {
    data.freeformMode = input.freeformMode;
  }

  const updatedCombat = await prisma.combatState.upsert({
    where: { mapId },
    create: {
      mapId,
      active: false,
      round: 1,
      turnIndex: 0,
      turnOrder: "[]",
      timers: "[]",
      ...data,
    },
    update: data,
  });

  return {
    combat: formatCombatState(updatedCombat, map.tokens)!,
    tokens: map.tokens,
  };
}

export async function reorderCombatTurnQueue(
  userId: string,
  mapId: string,
  input: CombatReorderInput,
) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  const combat = map.combat;
  if (!combat) {
    throw new ApiError(400, "COMBAT_INACTIVE", "Combat state not found");
  }

  const currentTurnOrder = parseJsonArray<string>(combat.turnOrder);
  let res: { turnOrder: string[]; activeTokenId: string; turnIndex: number };

  if (input.orderedTokenIds && Array.isArray(input.orderedTokenIds)) {
    res = reorderTurnQueue(currentTurnOrder, input.orderedTokenIds, combat.activeTokenId);
  } else if (input.tokenId && input.direction) {
    res = moveTurnQueueEntry(currentTurnOrder, input.tokenId, input.direction, combat.activeTokenId);
  } else {
    throw new ApiError(400, "INVALID_REORDER_INPUT", "Must provide orderedTokenIds or tokenId and direction");
  }

  const updatedCombat = await prisma.combatState.update({
    where: { mapId },
    data: {
      turnOrder: JSON.stringify(res.turnOrder),
      turnIndex: res.turnIndex,
      activeTokenId: res.activeTokenId,
    },
  });

  return {
    combat: formatCombatState(updatedCombat, map.tokens)!,
    tokens: map.tokens,
  };
}

export async function nextCombatTurn(
  userId: string,
  mapId: string,
  input?: CombatNextInput,
) {
  const map = await findMapWithSession(mapId);
  assertParticipant(map.session.campaign, userId);

  const combat = map.combat;
  if (!combat || !combat.active) {
    throw new ApiError(400, "COMBAT_INACTIVE", "Combat is not currently active");
  }

  const isOwner = map.session.campaign.ownerId === userId;
  let turnOrder = parseJsonArray<string>(combat.turnOrder);
  const activeToken = map.tokens.find((t) => t.id === combat.activeTokenId);

  // Only GM or active player can advance/end turn
  if (!isOwner && activeToken?.ownerId !== userId) {
    throw new ApiError(403, "NOT_YOUR_TURN", "It is not your turn to act");
  }

  let { nextTurnIndex, nextRound, activeTokenId, wrappedRound } = advanceTurn(
    turnOrder,
    combat.turnIndex,
    combat.round,
  );

  const currentTimers = parseJsonArray<CombatTimer>(combat.timers);
  const nextTimers = wrappedRound ? tickCombatTimers(currentTimers, -1) : currentTimers;
  let nextIsSurpriseRound = combat.isSurpriseRound;
  let currentTokens = map.tokens;

  if (wrappedRound) {
    nextIsSurpriseRound = false;
    const combatants = map.tokens.filter(
      (t) => t.type === "CHARACTER" || t.type === "MONSTER",
    );

    if (combat.chaosMode && combatants.length > 0) {
      // Chaos Mode: automatically re-roll initiative and re-sort Turn Queue at start of new round
      const participants = await buildParticipantsWithSheetInfo(combatants);
      const rerolled = rollEncounterInitiative(participants, {
        groupMonsterInitiative: combat.groupMonsterInitiative,
        forcedRollsById: input?.forcedRollsById,
        forcedGroupMonsterRoll: input?.forcedGroupMonsterRoll,
        isSurpriseRound: false,
      });

      for (const r of rerolled.results) {
        await prisma.mapToken.update({
          where: { id: r.id },
          data: {
            initiative: r.initiative,
            dexModifier: r.dexModifier,
            initiativeMeta: JSON.stringify(r.meta),
          },
        });
      }

      turnOrder = rerolled.turnOrder;
      nextTurnIndex = 0;
      activeTokenId = turnOrder[0] ?? "";
      currentTokens = await prisma.mapToken.findMany({ where: { mapId } });
    } else if (combat.isSurpriseRound && combatants.length > 0) {
      // Exiting surprise round into normal initiative order
      turnOrder = sortInitiative(
        combatants.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type,
          initiative: t.initiative,
          dexModifier: t.dexModifier,
          hasSurprise: t.hasSurprise,
        })),
        { isSurpriseRound: false },
      );
      nextTurnIndex = 0;
      activeTokenId = turnOrder[0] ?? "";
    }
  }

  const updatedCombat = await prisma.combatState.update({
    where: { mapId },
    data: {
      turnOrder: JSON.stringify(turnOrder),
      turnIndex: nextTurnIndex,
      round: nextRound,
      activeTokenId,
      timers: JSON.stringify(nextTimers),
      isSurpriseRound: nextIsSurpriseRound,
    },
  });

  return formatCombatState(updatedCombat, currentTokens)!;
}

export async function previousCombatTurn(userId: string, mapId: string) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  const combat = map.combat;
  if (!combat || !combat.active) {
    throw new ApiError(400, "COMBAT_INACTIVE", "Combat is not currently active");
  }

  const turnOrder = parseJsonArray<string>(combat.turnOrder);
  const { prevTurnIndex, prevRound, activeTokenId, wrappedBack } = revertTurn(
    turnOrder,
    combat.turnIndex,
    combat.round,
  );

  const currentTimers = parseJsonArray<CombatTimer>(combat.timers);
  const nextTimers = wrappedBack ? tickCombatTimers(currentTimers, 1) : currentTimers;

  const updatedCombat = await prisma.combatState.update({
    where: { mapId },
    data: {
      turnIndex: prevTurnIndex,
      round: prevRound,
      activeTokenId,
      timers: JSON.stringify(nextTimers),
    },
  });

  return formatCombatState(updatedCombat, map.tokens)!;
}

export async function addCombatTimer(
  userId: string,
  mapId: string,
  input: CombatTimerCreateInput,
) {
  const map = await findMapWithSession(mapId);
  assertParticipant(map.session.campaign, userId);

  const combat = map.combat;
  if (!combat) {
    throw new ApiError(400, "COMBAT_INACTIVE", "Combat state not initialized");
  }

  const currentTimers = parseJsonArray<CombatTimer>(combat.timers);
  const entity = input.entityId ? map.tokens.find((t) => t.id === input.entityId) : null;

  const newTimer: CombatTimer = {
    id: `timer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name,
    category: input.category ?? "custom",
    scope: input.scope ?? (input.entityId ? "personal" : "gm"),
    entityId: input.entityId ?? null,
    entityName: entity?.name ?? null,
    remainingRounds: input.durationRounds,
    initialRounds: input.durationRounds,
    expired: false,
  };

  const nextTimers = [...currentTimers, newTimer];
  const updatedCombat = await prisma.combatState.update({
    where: { mapId },
    data: {
      timers: JSON.stringify(nextTimers),
    },
  });

  return formatCombatState(updatedCombat, map.tokens)!;
}

export async function removeCombatTimer(userId: string, mapId: string, timerId: string) {
  const map = await findMapWithSession(mapId);
  assertParticipant(map.session.campaign, userId);

  const combat = map.combat;
  if (!combat) {
    throw new ApiError(400, "COMBAT_INACTIVE", "Combat state not initialized");
  }

  const currentTimers = parseJsonArray<CombatTimer>(combat.timers);
  const nextTimers = currentTimers.filter((t) => t.id !== timerId);

  const updatedCombat = await prisma.combatState.update({
    where: { mapId },
    data: {
      timers: JSON.stringify(nextTimers),
    },
  });

  return formatCombatState(updatedCombat, map.tokens)!;
}

export async function executeCombatAttack(
  userId: string,
  mapId: string,
  input: CombatAttackInput,
) {
  const map = await findMapWithSession(mapId);
  assertParticipant(map.session.campaign, userId);

  const isOwner = map.session.campaign.ownerId === userId;
  const attacker = map.tokens.find((t) => t.id === input.attackerId);
  const target = map.tokens.find((t) => t.id === input.targetId);

  if (!attacker || !target) {
    throw new ApiError(404, "TOKEN_NOT_FOUND", "Attacker or target token not found");
  }

  // Permission check: GM can attack with any token, player can only attack with own token on own turn
  if (!isOwner) {
    if (map.combat?.active) {
      const activeToken = map.tokens.find((t) => t.id === map.combat?.activeTokenId);
      if (activeToken?.ownerId !== userId || map.combat.activeTokenId !== attacker.id) {
        throw new ApiError(403, "NOT_YOUR_TURN", "It is not your turn to act");
      }
    }
    if (attacker.ownerId !== userId) {
      throw new ApiError(403, "FORBIDDEN", "You can only attack with your own token");
    }
  }

  const attackResult = resolveAttack({
    attackerName: attacker.name,
    attackBonus: attacker.attackBonus,
    damageFormula: attacker.damageFormula,
    targetName: target.name,
    targetAc: target.ac,
    targetHpCurrent: target.hpCurrent,
    targetHpMax: target.hpMax,
    forcedD20: input.forcedD20,
  });

  // Update target token HP
  const updatedTarget = await prisma.mapToken.update({
    where: { id: target.id },
    data: { hpCurrent: attackResult.targetHpAfter },
  });

  // If target has linked CharacterSheet, sync sheet HP
  if (target.characterSheetId) {
    await prisma.characterSheet.update({
      where: { id: target.characterSheetId },
      data: { hpCurrent: attackResult.targetHpAfter },
    });
  }

  // If a CHARACTER drops to 0 HP during active combat, auto-register a personal dying timer if not present
  let updatedCombatState = map.combat;
  if (
    map.combat?.active &&
    target.type === "CHARACTER" &&
    attackResult.targetHpBefore > 0 &&
    attackResult.targetHpAfter === 0
  ) {
    const currentTimers = parseJsonArray<CombatTimer>(map.combat.timers);
    const hasDying = currentTimers.some(
      (t) => t.category === "dying" && t.entityId === target.id && !t.expired,
    );
    if (!hasDying) {
      const dyingTimer: CombatTimer = {
        id: `timer-dying-${target.id}-${Date.now()}`,
        name: `Dying (${target.name})`,
        category: "dying",
        scope: "personal",
        entityId: target.id,
        entityName: target.name,
        remainingRounds: 3,
        initialRounds: 3,
        expired: false,
      };
      updatedCombatState = await prisma.combatState.update({
        where: { mapId },
        data: { timers: JSON.stringify([...currentTimers, dyingTimer]) },
      });
    }
  }

  // Create session combat message
  await prisma.sessionMessage.create({
    data: {
      sessionId: map.sessionId,
      userId,
      type: "COMBAT",
      content: attackResult.logMessage,
    },
  });

  const refreshedTokens = map.tokens.map((t) => (t.id === updatedTarget.id ? updatedTarget : t));

  return {
    attack: attackResult,
    targetToken: updatedTarget,
    combat: formatCombatState(updatedCombatState, refreshedTokens),
  };
}

export async function endCombat(userId: string, mapId: string) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  const combat = await prisma.combatState.update({
    where: { mapId },
    data: {
      active: false,
      turnOrder: "[]",
      timers: "[]",
      activeTokenId: null,
      turnIndex: 0,
      round: 1,
    },
  });

  return formatCombatState(combat, map.tokens)!;
}
