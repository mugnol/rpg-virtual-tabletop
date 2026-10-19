import { prisma } from "../../db.js";
import { ApiError } from "../../middleware/errors.js";
import { assertOwner, assertParticipant } from "../campaigns/service.js";
import { advanceTurn, resolveAttack, sortInitiative } from "../combat/combat.js";
import { findSessionWithCampaign } from "../sessions/service.js";
import type {
  CombatAttackInput,
  MapCreateInput,
  MapUpdateInput,
  TokenCreateInput,
  TokenUpdateInput,
} from "./schemas.js";

const MAP_NOT_FOUND = new ApiError(404, "NOT_FOUND", "Map not found");
const TOKEN_NOT_FOUND = new ApiError(404, "NOT_FOUND", "Token not found");

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

  return prisma.sessionMap.findMany({
    where: { sessionId },
    include: {
      tokens: true,
      combat: true,
    },
    orderBy: { createdAt: "asc" },
  });
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
        },
      },
    },
    include: {
      tokens: true,
      combat: true,
    },
  });

  return map;
}

export async function getMap(userId: string, mapId: string) {
  const map = await findMapWithSession(mapId);
  assertParticipant(map.session.campaign, userId);
  return map;
}

export async function updateMap(
  userId: string,
  mapId: string,
  input: MapUpdateInput,
) {
  const map = await findMapWithSession(mapId);
  assertOwner(map.session.campaign, userId);

  return prisma.sessionMap.update({
    where: { id: mapId },
    data: input,
    include: {
      tokens: true,
      combat: true,
    },
  });
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
    if (!map.allowPlayerMovement) {
      throw new ApiError(403, "MOVEMENT_DISABLED", "Player movement is disabled by the GM");
    }
    if (token.type !== "CHARACTER" || token.ownerId !== userId) {
      throw new ApiError(403, "FORBIDDEN", "You can only move your own character token");
    }
    if (map.combat?.active) {
      if (map.combat.activeTokenId !== token.id) {
        throw new ApiError(403, "NOT_YOUR_TURN", "It is not your turn to act");
      }
      if (input.x !== undefined || input.y !== undefined) {
        const dx = Math.abs(targetX - token.x);
        const dy = Math.abs(targetY - token.y);
        const dist = Math.max(dx, dy);
        if (dist > token.speed) {
          throw new ApiError(400, "EXCEEDS_SPEED", `Movement exceeds speed limit of ${token.speed} squares`);
        }
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
        },
      },
    },
  });
  if (!token) throw TOKEN_NOT_FOUND;

  assertOwner(token.map.session.campaign, userId);

  await prisma.mapToken.delete({ where: { id: tokenId } });
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
    },
    update: {
      active: true,
      round: 1,
      turnIndex: 0,
      activeTokenId,
      turnOrder: JSON.stringify(turnOrder),
    },
  });

  const refreshedTokens = await prisma.mapToken.findMany({ where: { mapId } });

  return {
    combat: {
      ...combat,
      turnOrder: JSON.parse(combat.turnOrder) as string[],
    },
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
  const turnOrder = JSON.parse(combat.turnOrder) as string[];
  const activeToken = map.tokens.find((t) => t.id === combat.activeTokenId);

  // Only GM or active player can advance turn
  if (!isOwner && activeToken?.ownerId !== userId) {
    throw new ApiError(403, "NOT_YOUR_TURN", "Only the GM or active player can advance turn");
  }

  const { nextTurnIndex, nextRound, activeTokenId } = advanceTurn(
    turnOrder,
    combat.turnIndex,
    combat.round,
  );

  const updatedCombat = await prisma.combatState.update({
    where: { mapId },
    data: {
      turnIndex: nextTurnIndex,
      round: nextRound,
      activeTokenId,
    },
  });

  return {
    ...updatedCombat,
    turnOrder,
  };
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
    if (attacker.ownerId !== userId) {
      throw new ApiError(403, "FORBIDDEN", "You can only attack with your own token");
    }
    if (map.combat?.active && map.combat.activeTokenId !== attacker.id) {
      throw new ApiError(403, "NOT_YOUR_TURN", "It is not your turn to attack");
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

  // Create session combat message
  await prisma.sessionMessage.create({
    data: {
      sessionId: map.sessionId,
      userId,
      type: "COMBAT",
      content: attackResult.logMessage,
    },
  });

  return {
    attack: attackResult,
    targetToken: updatedTarget,
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
      activeTokenId: null,
      turnIndex: 0,
      round: 1,
    },
  });

  return {
    ...combat,
    turnOrder: [] as string[],
  };
}
