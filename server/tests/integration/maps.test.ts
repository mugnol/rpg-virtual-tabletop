import { describe, expect, it } from "vitest";
import { prisma } from "../../src/db.js";
import {
  createPc,
  createSystemCampaign,
  joinPlayer,
  registerAgent,
} from "../helpers.js";

let seq = 0;

describe("Tactical Maps & Combat Integration (BR-35..BR-50)", () => {
  it("GM creates map, updates theme and allowPlayerMovement; players cannot modify map", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`map-gm-${seq}@test.dev`, "GM", "Map GM");
    const playerAgent = await registerAgent(`map-p-${seq}@test.dev`, "PLAYER", "Map Player");
    const campaignId = (await createSystemCampaign(gmAgent, `Map Camp ${seq}`)).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);

    const sessionRes = await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({
      name: "Tactical Session",
    });
    const sessionId = sessionRes.body.session.id;

    // GM creates a map
    const createRes = await gmAgent.post(`/api/sessions/${sessionId}/maps`).send({
      name: "Catacombs",
      theme: "stone-dungeon",
      width: 16,
      height: 12,
      allowPlayerMovement: false,
    });
    expect(createRes.status).toBe(201);
    const mapId = createRes.body.map.id;
    expect(createRes.body.map.width).toBe(16);
    expect(createRes.body.map.theme).toBe("stone-dungeon");
    expect(createRes.body.map.allowPlayerMovement).toBe(false);

    // Player cannot create map
    const pCreate = await playerAgent.post(`/api/sessions/${sessionId}/maps`).send({
      name: "Player Map",
    });
    expect(pCreate.status).toBe(403);

    // Player can view maps
    const listRes = await playerAgent.get(`/api/sessions/${sessionId}/maps`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.maps.length).toBe(1);

    // GM toggles allowPlayerMovement and updates theme
    const patchRes = await gmAgent.patch(`/api/maps/${mapId}`).send({
      theme: "forest-clearing",
      allowPlayerMovement: true,
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.map.theme).toBe("forest-clearing");
    expect(patchRes.body.map.allowPlayerMovement).toBe(true);

    // Player cannot patch map
    const pPatch = await playerAgent.patch(`/api/maps/${mapId}`).send({
      theme: "tavern-cellar",
    });
    expect(pPatch.status).toBe(403);
  });

  it("GM places CHARACTER (linked to sheet), MONSTER, and ITEM tokens", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`tok-gm-${seq}@test.dev`, "GM", "Tok GM");
    const playerAgent = await registerAgent(`tok-p-${seq}@test.dev`, "PLAYER", "Tok Player");
    const campaignId = (await createSystemCampaign(gmAgent, `Tok Camp ${seq}`, "shadowdark")).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);

    // Player creates character sheet
    const sheet = await createPc(playerAgent, campaignId, "Sir Roland");
    const sheetId = sheet.id as string;

    const sessionRes = await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({
      name: "Token Session",
    });
    const sessionId = sessionRes.body.session.id;
    const mapRes = await gmAgent.post(`/api/sessions/${sessionId}/maps`).send({
      name: "Arena",
      width: 10,
      height: 10,
    });
    const mapId = mapRes.body.map.id;

    // GM places CHARACTER token linked to Sir Roland
    const charTokRes = await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
      type: "CHARACTER",
      characterSheetId: sheetId,
      x: 2,
      y: 3,
    });
    expect(charTokRes.status).toBe(201);
    expect(charTokRes.body.token.name).toBe("Sir Roland");
    expect(charTokRes.body.token.characterSheetId).toBe(sheetId);
    expect(charTokRes.body.token.x).toBe(2);
    expect(charTokRes.body.token.y).toBe(3);

    // GM places MONSTER token
    const monTokRes = await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
      type: "MONSTER",
      name: "Goblin Archer",
      x: 7,
      y: 8,
      hpMax: 12,
      hpCurrent: 12,
      ac: 13,
      attackBonus: 3,
      damageFormula: "1d6+1",
    });
    expect(monTokRes.status).toBe(201);
    expect(monTokRes.body.token.name).toBe("Goblin Archer");
    expect(monTokRes.body.token.hpMax).toBe(12);

    // GM places ITEM token
    const itemTokRes = await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
      type: "ITEM",
      name: "Treasure Chest",
      x: 5,
      y: 5,
    });
    expect(itemTokRes.status).toBe(201);
    expect(itemTokRes.body.token.type).toBe("ITEM");

    // Player cannot place tokens
    const pTok = await playerAgent.post(`/api/maps/${mapId}/tokens`).send({
      type: "CHARACTER",
      name: "Illegal Token",
      x: 1,
      y: 1,
    });
    expect(pTok.status).toBe(403);
  });

  it("enforces movement authorization: GM free moves, player restricted by ownership and allowPlayerMovement", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`mv-gm-${seq}@test.dev`, "GM", "Move GM");
    const playerAgent = await registerAgent(`mv-p-${seq}@test.dev`, "PLAYER", "Move Player");
    const campaignId = (await createSystemCampaign(gmAgent, `Move Camp ${seq}`)).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);

    const sheet = await createPc(playerAgent, campaignId, "Aria");
    const sheetId = sheet.id as string;

    const sessionId = (
      await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Move Session" })
    ).body.session.id;

    // Create map with allowPlayerMovement = false initially
    const mapId = (
      await gmAgent.post(`/api/sessions/${sessionId}/maps`).send({
        name: "Restricted Map",
        width: 10,
        height: 10,
        allowPlayerMovement: false,
      })
    ).body.map.id;

    const charTokenId = (
      await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
        type: "CHARACTER",
        characterSheetId: sheetId,
        x: 1,
        y: 1,
      })
    ).body.token.id;

    const monsterTokenId = (
      await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
        type: "MONSTER",
        name: "Skeleton",
        x: 5,
        y: 5,
      })
    ).body.token.id;

    // Player cannot move their token when allowPlayerMovement = false
    const pMoveBlocked = await playerAgent.patch(`/api/tokens/${charTokenId}`).send({ x: 2, y: 1 });
    expect(pMoveBlocked.status).toBe(403);

    // GM moves the monster token
    const gmMonsterMove = await gmAgent.patch(`/api/tokens/${monsterTokenId}`).send({ x: 6, y: 5 });
    expect(gmMonsterMove.status).toBe(200);
    expect(gmMonsterMove.body.token.x).toBe(6);

    // Out of bounds movement rejected
    const oobMove = await gmAgent.patch(`/api/tokens/${monsterTokenId}`).send({ x: 12, y: 5 });
    expect(oobMove.status).toBe(400);

    // GM enables player movement
    await gmAgent.patch(`/api/maps/${mapId}`).send({ allowPlayerMovement: true });

    // Player can now move their owned character token
    const pMoveAllowed = await playerAgent.patch(`/api/tokens/${charTokenId}`).send({ x: 2, y: 2 });
    expect(pMoveAllowed.status).toBe(200);
    expect(pMoveAllowed.body.token.x).toBe(2);
    expect(pMoveAllowed.body.token.y).toBe(2);

    // Player still cannot move the monster token
    const pMoveMonster = await playerAgent.patch(`/api/tokens/${monsterTokenId}`).send({ x: 7, y: 5 });
    expect(pMoveMonster.status).toBe(403);
  });

  it("handles turn-based combat lifecycle: initiative, turn advancing, and attack HP deduction", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`cbt-gm-${seq}@test.dev`, "GM", "Combat GM");
    const playerAgent = await registerAgent(`cbt-p-${seq}@test.dev`, "PLAYER", "Combat Player");
    const campaignId = (await createSystemCampaign(gmAgent, `Combat Camp ${seq}`)).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);

    const sheet = await createPc(playerAgent, campaignId, "Valeros");
    const sheetId = sheet.id as string;

    const sessionId = (
      await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Combat Session" })
    ).body.session.id;

    const mapId = (
      await gmAgent.post(`/api/sessions/${sessionId}/maps`).send({
        name: "Battle Arena",
        width: 12,
        height: 12,
      })
    ).body.map.id;

    const playerTokenId = (
      await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
        type: "CHARACTER",
        characterSheetId: sheetId,
        x: 2,
        y: 2,
        attackBonus: 4,
        damageFormula: "1d8+3",
      })
    ).body.token.id;

    const monsterTokenId = (
      await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
        type: "MONSTER",
        name: "Bugbear",
        x: 4,
        y: 2,
        hpMax: 20,
        hpCurrent: 20,
        ac: 12,
        attackBonus: 3,
        damageFormula: "1d8+2",
      })
    ).body.token.id;

    // GM starts combat
    const startRes = await gmAgent.post(`/api/maps/${mapId}/combat/start`).send({});
    expect(startRes.status).toBe(200);
    expect(startRes.body.combat.active).toBe(true);
    expect(startRes.body.combat.round).toBe(1);
    expect(startRes.body.combat.turnOrder.length).toBe(2);
    expect(startRes.body.combat.activeTokenId).toBeDefined();

    // GM executes attack
    const attackRes = await gmAgent.post(`/api/maps/${mapId}/combat/attack`).send({
      attackerId: playerTokenId,
      targetId: monsterTokenId,
      forcedD20: 16, // total 16 + 4 = 20 >= AC 12 -> Hit
    });
    expect(attackRes.status).toBe(200);
    expect(attackRes.body.attack.hit).toBe(true);
    expect(attackRes.body.attack.damage).toBeGreaterThan(0);
    expect(attackRes.body.targetToken.hpCurrent).toBeLessThan(20);

    // Check message logged to session chat
    const msgsRes = await gmAgent.get(`/api/sessions/${sessionId}/messages`);
    expect(msgsRes.status).toBe(200);
    expect(msgsRes.body.messages.some((m: { type: string; content: string }) => m.content.includes("Bugbear"))).toBe(true);

    // GM advances turn
    const nextRes = await gmAgent.post(`/api/maps/${mapId}/combat/next`).send({});
    expect(nextRes.status).toBe(200);
    expect(nextRes.body.combat.turnIndex).toBe(1);

    // GM ends combat
    const endRes = await gmAgent.post(`/api/maps/${mapId}/combat/end`).send({});
    expect(endRes.status).toBe(200);
    expect(endRes.body.combat.active).toBe(false);
  });

  it("synchronizes campaign turn queue, activeTurnEntityId, roundNumber, player End Turn, GM Previous Turn, round timer countdowns, and turn validation", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`tq-gm-${seq}@test.dev`, "GM", "TurnQueue GM");
    const playerAgent = await registerAgent(`tq-p-${seq}@test.dev`, "PLAYER", "TurnQueue Player");
    const campaignId = (await createSystemCampaign(gmAgent, `TurnQueue Camp ${seq}`, "shadowdark")).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);

    const sheet = await createPc(playerAgent, campaignId, "Kaelen");
    const sheetId = sheet.id as string;

    const sessionId = (
      await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "TurnQueue Session" })
    ).body.session.id;

    const mapId = (
      await gmAgent.post(`/api/sessions/${sessionId}/maps`).send({
        name: "TurnQueue Map",
        width: 12,
        height: 12,
        allowPlayerMovement: true,
      })
    ).body.map.id;

    const playerTokenId = (
      await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
        type: "CHARACTER",
        characterSheetId: sheetId,
        x: 2,
        y: 2,
        attackBonus: 4,
        damageFormula: "1d8+2",
      })
    ).body.token.id;

    const monsterTokenId = (
      await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
        type: "MONSTER",
        name: "Hobgoblin",
        x: 6,
        y: 2,
        hpMax: 18,
        hpCurrent: 18,
        ac: 13,
        attackBonus: 3,
        damageFormula: "1d8+1",
      })
    ).body.token.id;

    // 1. GM starts combat -> turnQueue has character and monster, roundNumber = 1, activeTurnEntityId = playerTokenId
    const startRes = await gmAgent.post(`/api/maps/${mapId}/combat/start`).send({});
    expect(startRes.status).toBe(200);
    expect(startRes.body.combat.active).toBe(true);
    expect(startRes.body.combat.roundNumber).toBe(1);
    expect(startRes.body.combat.activeTurnEntityId).toBe(playerTokenId);
    expect(Array.isArray(startRes.body.combat.turnQueue)).toBe(true);
    expect(startRes.body.combat.turnQueue).toHaveLength(2);
    expect(startRes.body.combat.turnQueue[0]).toMatchObject({
      entityId: playerTokenId,
      entityType: "character",
      name: "Kaelen",
      isActive: true,
    });
    expect(startRes.body.combat.turnQueue[1]).toMatchObject({
      entityId: monsterTokenId,
      entityType: "monster",
      name: "Hobgoblin",
      isActive: false,
    });

    // 2. Add personal and GM round timers (light timer & spell duration)
    const lightTimerRes = await playerAgent.post(`/api/maps/${mapId}/combat/timers`).send({
      name: "Torch Light",
      category: "light",
      scope: "personal",
      entityId: playerTokenId,
      durationRounds: 3,
    });
    expect(lightTimerRes.status).toBe(201);
    expect(lightTimerRes.body.combat.timers).toHaveLength(1);
    expect(lightTimerRes.body.combat.timers[0]).toMatchObject({
      name: "Torch Light",
      category: "light",
      scope: "personal",
      remainingRounds: 3,
      expired: false,
    });

    const spellTimerRes = await gmAgent.post(`/api/maps/${mapId}/combat/timers`).send({
      name: "Protection from Evil",
      category: "spell",
      scope: "gm",
      durationRounds: 1,
    });
    expect(spellTimerRes.status).toBe(201);
    expect(spellTimerRes.body.combat.timers).toHaveLength(2);

    // 3. Active player moves on their own turn and then clicks End Turn
    const validMoveRes = await playerAgent.patch(`/api/tokens/${playerTokenId}`).send({ x: 3, y: 2 });
    expect(validMoveRes.status).toBe(200);

    const endTurnRes = await playerAgent.post(`/api/maps/${mapId}/combat/end-turn`).send({});
    expect(endTurnRes.status).toBe(200);
    expect(endTurnRes.body.combat.turnIndex).toBe(1);
    expect(endTurnRes.body.combat.activeTurnEntityId).toBe(monsterTokenId);
    expect(endTurnRes.body.combat.roundNumber).toBe(1);

    // 4. Turn validation: Player cannot move, attack, end turn, or revert turn on the Monster's turn
    const outOfTurnMove = await playerAgent.patch(`/api/tokens/${playerTokenId}`).send({ x: 4, y: 2 });
    expect(outOfTurnMove.status).toBe(403);
    expect(outOfTurnMove.body.error.code).toBe("NOT_YOUR_TURN");

    const outOfTurnAttack = await playerAgent.post(`/api/maps/${mapId}/combat/attack`).send({
      attackerId: playerTokenId,
      targetId: monsterTokenId,
    });
    expect(outOfTurnAttack.status).toBe(403);
    expect(outOfTurnAttack.body.error.code).toBe("NOT_YOUR_TURN");

    const outOfTurnEnd = await playerAgent.post(`/api/maps/${mapId}/combat/end-turn`).send({});
    expect(outOfTurnEnd.status).toBe(403);
    expect(outOfTurnEnd.body.error.code).toBe("NOT_YOUR_TURN");

    const playerPrevAttempt = await playerAgent.post(`/api/maps/${mapId}/combat/prev`).send({});
    expect(playerPrevAttempt.status).toBe(403);

    // 5. GM advances turn from last participant -> completes full queue cycle -> roundNumber increments to 2 & timers tick down
    const wrapNextRes = await gmAgent.post(`/api/maps/${mapId}/combat/next`).send({});
    expect(wrapNextRes.status).toBe(200);
    expect(wrapNextRes.body.combat.turnIndex).toBe(0);
    expect(wrapNextRes.body.combat.roundNumber).toBe(2);
    expect(wrapNextRes.body.combat.activeTurnEntityId).toBe(playerTokenId);
    expect(wrapNextRes.body.combat.timers[0].remainingRounds).toBe(2);
    expect(wrapNextRes.body.combat.timers[0].expired).toBe(false);
    expect(wrapNextRes.body.combat.timers[1].remainingRounds).toBe(0);
    expect(wrapNextRes.body.combat.timers[1].expired).toBe(true);

    // 6. GM reverts to previous turn -> wraps back to Round 1, last participant, and restores timer countdowns
    const prevRes = await gmAgent.post(`/api/maps/${mapId}/combat/prev`).send({});
    expect(prevRes.status).toBe(200);
    expect(prevRes.body.combat.turnIndex).toBe(1);
    expect(prevRes.body.combat.roundNumber).toBe(1);
    expect(prevRes.body.combat.activeTurnEntityId).toBe(monsterTokenId);
    expect(prevRes.body.combat.timers[0].remainingRounds).toBe(3);
    expect(prevRes.body.combat.timers[1].remainingRounds).toBe(1);
    expect(prevRes.body.combat.timers[1].expired).toBe(false);
  });

  it("supports Shadowdark initiative rolls, Thief 2d20kh1 advantage, Surprise turns, Grouped Monster Initiative, Chaos Mode re-rolls, manual overrides, and chat broadcasts", async () => {
    seq += 1;
    const gmAgent = await registerAgent(`init-gm-${seq}@test.dev`, "GM", "Init GM");
    const playerAgent = await registerAgent(`init-p-${seq}@test.dev`, "PLAYER", "Init Player");
    const campaignId = (await createSystemCampaign(gmAgent, `Init Camp ${seq}`, "shadowdark")).id;
    await joinPlayer(gmAgent, playerAgent, campaignId);

    // Thief with DEX 16 (+3) and "Gain advantage on initiative rolls" talent
    const thiefSheet = await createPc(playerAgent, campaignId, "Vex the Thief", {
      classId: "thief",
      abilities: { str: 10, int: 10, dex: 16, wis: 10, con: 12, cha: 10 },
      extras: { talents: ["Gain advantage on initiative rolls"] },
    });
    const thiefSheetId = thiefSheet.id as string;

    const sessionId = (
      await gmAgent.post(`/api/campaigns/${campaignId}/sessions`).send({ name: "Initiative Session" })
    ).body.session.id;

    const mapId = (
      await gmAgent.post(`/api/sessions/${sessionId}/maps`).send({
        name: "Ambush Cavern",
        width: 12,
        height: 12,
      })
    ).body.map.id;

    // Place Thief character token
    const thiefTokenRes = await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
      type: "CHARACTER",
      characterSheetId: thiefSheetId,
      x: 2,
      y: 2,
    });
    expect(thiefTokenRes.status).toBe(201);
    const thiefTokenId = thiefTokenRes.body.token.id as string;
    expect(thiefTokenRes.body.token.dexModifier).toBe(3);

    // Place 2 Monster tokens with different DEX modifiers
    const scoutTokenId = (
      await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
        type: "MONSTER",
        name: "Goblin Scout",
        dexModifier: 2,
        x: 5,
        y: 2,
      })
    ).body.token.id as string;

    const bruteTokenId = (
      await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
        type: "MONSTER",
        name: "Goblin Brute",
        dexModifier: -1,
        x: 6,
        y: 2,
      })
    ).body.token.id as string;

    // 1. Flag Goblin Scout with hasSurprise: true before combat starts
    const surpriseRes = await gmAgent.post(`/api/maps/${mapId}/combat/surprise`).send({
      tokenId: scoutTokenId,
      hasSurprise: true,
    });
    expect(surpriseRes.status).toBe(200);
    expect(surpriseRes.body.token.hasSurprise).toBe(true);

    // 2. Start combat with groupMonsterInitiative: true
    // Thief rolls [4, 17] -> 2d20kh1 + 3 = 20
    // Grouped monsters share forcedGroupMonsterRoll: 8 + max(2, -1) = 10
    // Goblin Scout has hasSurprise: true -> goes first in Surprise Round!
    const startRes = await gmAgent.post(`/api/maps/${mapId}/combat/start`).send({
      groupMonsterInitiative: true,
      chaosMode: false,
      forcedRollsById: {
        [thiefTokenId]: [4, 17],
      },
      forcedGroupMonsterRoll: 8,
    });
    expect(startRes.status).toBe(200);
    expect(startRes.body.combat.active).toBe(true);
    expect(startRes.body.combat.groupMonsterInitiative).toBe(true);
    expect(startRes.body.combat.isSurpriseRound).toBe(true);
    expect(startRes.body.combat.turnQueue).toHaveLength(3);

    // Order during surprise round: Goblin Scout (surprise, init 10) -> Vex the Thief (init 20, 2d20kh1) -> Goblin Brute (init 10)
    expect(startRes.body.combat.turnQueue[0]).toMatchObject({
      entityId: scoutTokenId,
      name: "Goblin Scout",
      initiative: 10,
      hasSurprise: true,
    });
    expect(startRes.body.combat.turnQueue[1]).toMatchObject({
      entityId: thiefTokenId,
      name: "Vex the Thief",
      initiative: 20,
      dexModifier: 3,
      hasInitiativeAdvantage: true,
    });
    expect(startRes.body.combat.turnQueue[1].initiativeMeta.dice).toEqual([4, 17]);
    expect(startRes.body.combat.turnQueue[1].initiativeMeta.keptDie).toBe(17);
    expect(startRes.body.combat.turnQueue[2]).toMatchObject({
      entityId: bruteTokenId,
      name: "Goblin Brute",
      initiative: 10,
      hasSurprise: false,
    });

    // 3. Player rolls initiative for their own Thief character into the queue & logs to session chat
    const playerRollRes = await playerAgent.post(`/api/maps/${mapId}/combat/initiative/roll`).send({
      tokenId: thiefTokenId,
      forcedRolls: [9, 19], // 19 + 3 = 22
    });
    expect(playerRollRes.status).toBe(200);
    const updatedThiefEntry = playerRollRes.body.combat.turnQueue.find(
      (e: { entityId: string }) => e.entityId === thiefTokenId,
    );
    expect(updatedThiefEntry.initiative).toBe(22);
    expect(updatedThiefEntry.initiativeMeta.dice).toEqual([9, 19]);

    const chatRes = await gmAgent.get(`/api/sessions/${sessionId}/messages`);
    expect(chatRes.status).toBe(200);
    expect(
      chatRes.body.messages.some(
        (m: { content: string }) => m.content.includes("Vex the Thief") && m.content.includes("Initiative"),
      ),
    ).toBe(true);

    // 4. GM manually overrides Goblin Brute's initiative to 25
    const overrideRes = await gmAgent.patch(`/api/maps/${mapId}/combat/initiative`).send({
      tokenId: bruteTokenId,
      initiative: 25,
    });
    expect(overrideRes.status).toBe(200);
    const bruteEntry = overrideRes.body.combat.turnQueue.find(
      (e: { entityId: string }) => e.entityId === bruteTokenId,
    );
    expect(bruteEntry.initiative).toBe(25);

    // 5. Late-joining monster spawned during active combat automatically joins turnQueue
    const lateMonsterRes = await gmAgent.post(`/api/maps/${mapId}/tokens`).send({
      type: "MONSTER",
      name: "Cave Spider",
      dexModifier: 3,
      initiative: 18,
      x: 8,
      y: 8,
    });
    expect(lateMonsterRes.status).toBe(201);
    const mapAfterSpawn = await gmAgent.get(`/api/maps/${mapId}`);
    expect(mapAfterSpawn.body.map.combat.turnQueue).toHaveLength(4);

    // 6. Enable Chaos Mode and complete the round wrap -> clears surprise round & automatically re-rolls and re-sorts queue
    const settingsRes = await gmAgent.patch(`/api/maps/${mapId}/combat/settings`).send({
      chaosMode: true,
      groupMonsterInitiative: false,
    });
    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.combat.chaosMode).toBe(true);
    expect(settingsRes.body.combat.groupMonsterInitiative).toBe(false);

    // Advance 4 times to complete the 4-participant round
    await gmAgent.post(`/api/maps/${mapId}/combat/next`).send({});
    await gmAgent.post(`/api/maps/${mapId}/combat/next`).send({});
    await gmAgent.post(`/api/maps/${mapId}/combat/next`).send({});
    const round2Res = await gmAgent.post(`/api/maps/${mapId}/combat/next`).send({
      forcedRollsById: {
        [thiefTokenId]: [2, 5], // 5 + 3 = 8
        [scoutTokenId]: [19], // 19 + 2 = 21
        [bruteTokenId]: [15], // 15 - 1 = 14
      },
    });
    expect(round2Res.status).toBe(200);
    expect(round2Res.body.combat.roundNumber).toBe(2);
    expect(round2Res.body.combat.isSurpriseRound).toBe(false);
    // Verify queue is sorted descending by the new Round 2 initiative scores
    const r2Queue = round2Res.body.combat.turnQueue;
    for (let i = 0; i < r2Queue.length - 1; i++) {
      expect(r2Queue[i].initiative).toBeGreaterThanOrEqual(r2Queue[i + 1].initiative);
    }
  });
});
