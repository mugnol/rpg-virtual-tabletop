import type { CombatState, MapToken } from "@prisma/client";
import { prisma } from "../../db.js";
import { ApiError } from "../../middleware/errors.js";
import { assertOwner, assertParticipant } from "../campaigns/service.js";
import {
  advanceTurn,
  buildTurnQueue,
  resolveAttack,
  revertTurn,
  sortInitiative,
  tickCombatTimers,
  type CombatTimer,
  type TurnQueueEntry,
} from "../combat/combat.js";
import { findSessionWithCampaign } from "../sessions/service.js";
import type {
  CombatAttackInput,
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
  let initiative = input.initiative ?? 0;

  if (input.type === "CHARACTER" && input.characterSheetId) {
    const sheet = await prisma.characterSheet.findUnique({
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
        initiative = dexMod;
        attackBonus = Math.max(dexMod, strMod) + 2; // mod + level 1 proficiency
        ac = 10 + dexMod;
      } catch {
        // use defaults
      }
    }
  }

  const token = await prisma.mapToken.create({
    data: {
      mapId,
      type: input.type,
      name,
      characterSheetId: input.characterSheetId ?? null,
      ownerId,
      x,
      y,
      color: input.color ?? (input.type === "CHARACTER" ? "#6366f1" : input.type === "MONSTER" ? "#ef4444" : "#f59e0b"),
      hpMax,
      hpCurrent,
      ac,
      speed: input.speed ?? 6,
      attackBonus,
      damageFormula,
      initiative,
    },
  });

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

  const updated = await prisma.mapToken.update({
    where: { id: tokenId },
    data: input,
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

export async function startCombat(userId: string, mapId: string) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  // Eligible combatants: CHARACTER and MONSTER tokens
  const combatants = map.tokens.filter((t) => t.type === "CHARACTER" || t.type === "MONSTER");
  if (combatants.length === 0) {
    throw new ApiError(400, "NO_COMBATANTS", "No combatants found on map");
  }

  // Roll initiative for all combatants (player characters have tactical surprise/advantage in player-initiated encounters)
  const combatantList = combatants.map((t) => {
    const roll =
      t.type === "CHARACTER"
        ? Math.floor(Math.random() * 10) + 11
        : Math.floor(Math.random() * 10) + 1;
    const total = roll + t.initiative;
    return {
      id: t.id,
      initiative: total,
      initiativeModifier: t.initiative,
      name: t.name,
    };
  });

  // Update initiative on tokens
  for (const c of combatantList) {
    await prisma.mapToken.update({
      where: { id: c.id },
      data: { initiative: c.initiative },
    });
  }

  const turnOrder = sortInitiative(combatantList);
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
    },
    update: {
      active: true,
      round: 1,
      turnIndex: 0,
      activeTokenId,
      turnOrder: JSON.stringify(turnOrder),
      timers: "[]",
    },
  });

  const refreshedTokens = await prisma.mapToken.findMany({ where: { mapId } });

  return {
    combat: formatCombatState(combat, refreshedTokens)!,
    tokens: refreshedTokens,
  };
}

export async function nextCombatTurn(userId: string, mapId: string) {
  const map = await findMapWithSession(mapId);
  assertParticipant(map.session.campaign, userId);

  const combat = map.combat;
  if (!combat || !combat.active) {
    throw new ApiError(400, "COMBAT_INACTIVE", "Combat is not currently active");
  }

  const isOwner = map.session.campaign.ownerId === userId;
  const turnOrder = parseJsonArray<string>(combat.turnOrder);
  const activeToken = map.tokens.find((t) => t.id === combat.activeTokenId);

  // Only GM or active player can advance/end turn
  if (!isOwner && activeToken?.ownerId !== userId) {
    throw new ApiError(403, "NOT_YOUR_TURN", "It is not your turn to act");
  }

  const { nextTurnIndex, nextRound, activeTokenId, wrappedRound } = advanceTurn(
    turnOrder,
    combat.turnIndex,
    combat.round,
  );

  const currentTimers = parseJsonArray<CombatTimer>(combat.timers);
  const nextTimers = wrappedRound ? tickCombatTimers(currentTimers, -1) : currentTimers;

  const updatedCombat = await prisma.combatState.update({
    where: { mapId },
    data: {
      turnIndex: nextTurnIndex,
      round: nextRound,
      activeTokenId,
      timers: JSON.stringify(nextTimers),
    },
  });

  return formatCombatState(updatedCombat, map.tokens)!;
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
