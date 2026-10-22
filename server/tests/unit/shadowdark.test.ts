import { describe, expect, it } from "vitest";
import {
  SHADOWDARK_ANCESTRIES,
  SHADOWDARK_CLASSES,
  SHADOWDARK_BACKGROUNDS,
  SHADOWDARK_ALIGNMENTS,
  SHADOWDARK_DEITIES,
  SHADOWDARK_TITLES,
  SHADOWDARK_LANGUAGES,
  SHADOWDARK_NAMES,
  SHADOWDARK_STARTING_GEAR_D12,
  SHADOWDARK_BASIC_GEAR,
  SHADOWDARK_CRAWLING_KIT,
  SHADOWDARK_ARMOR,
  SHADOWDARK_WEAPONS,
  SHADOWDARK_SPELLS,
  PRIEST_SPELLS_KNOWN_BY_TIER,
  WIZARD_SPELLS_KNOWN_BY_TIER,
  PRIEST_PENANCE_SACRIFICE_GP,
  WIZARD_MISHAP_TABLES,
  SHADOWDARK_DCS,
  CAROUSING_EVENTS,
  CAROUSING_OUTCOMES,
  LIGHT_MISHAPS,
  shadowdarkStatModifier,
  rollShadowdarkStats,
  computeShadowdarkStartingHp,
  rollShadowdarkLevelUpHp,
  rollLevelZeroGear,
  rollLevelOneGold,
  getCharacterTitle,
  isTalentRollLevel,
  rollClassTalent,
  canClassUseWeapon,
  canClassUseArmor,
  calculateShadowdarkGearSlots,
  computeWeaponAttackAndDamage,
  resolveSpellcastingCheck,
  resolveFocusCheck,
  resolveScrollOrWandCast,
  resolveLearnSpellFromScroll,
  rollWizardMishap,
  manageLightSource,
  rollLightMishap,
  rollMoraleCheck,
  rollDeathTimer,
  rollDyingTurn,
  resolveStabilizeCheck,
  resolveRest,
  resolveCarousing,
  playWizardsAndThievesTurn,
  awardTreasureQualityXp,
  computeHunterModeMonsterXp,
  generateRandomShadowdarkCharacter,
  exportToShadowdarklings,
  importFromShadowdarklings,
} from "../../src/rules/shadowdark.js";

describe("1. Core Stats, Level 0 (The Gauntlet) & Shadowdarklings JSON Parity", () => {
  it("maps all 6 stat scores to exact Shadowdark modifiers (pg. 15)", () => {
    const cases: Array<[number, number]> = [
      [1, -4],
      [2, -4],
      [3, -4],
      [4, -3],
      [5, -3],
      [6, -2],
      [7, -2],
      [8, -1],
      [9, -1],
      [10, 0],
      [11, 0],
      [12, 1],
      [13, 1],
      [14, 2],
      [15, 2],
      [16, 3],
      [17, 3],
      [18, 4],
      [19, 4],
      [20, 4],
    ];
    for (const [score, expectedMod] of cases) {
      expect(shadowdarkStatModifier(score)).toBe(expectedMod);
    }
  });

  it("rolls 3d6 in order with optional mulligan if no stat is 14+ (pg. 15)", () => {
    const lowSet = { str: 10, dex: 11, con: 9, int: 12, wis: 13, cha: 8 };
    const validSet = { str: 14, dex: 10, con: 12, int: 9, wis: 11, cha: 10 };
    const rolled = rollShadowdarkStats({
      mulliganIfAllBelow14: true,
      candidateSets: [lowSet, validSet],
    });
    expect(rolled.scores).toEqual(validSet);
    expect(rolled.attempts).toBe(2);
  });

  it("computes 0-Level character HP = max(1, CON mod) (+2 for Dwarf Stout) and 1d4 d12 starting gear (pgs. 14, 33, 116)", () => {
    expect(SHADOWDARK_STARTING_GEAR_D12).toHaveLength(12);
    expect(computeShadowdarkStartingHp({ level: 0, conScore: 8, ancestryKey: "human" })).toBe(1); // max(1, -1) = 1
    expect(computeShadowdarkStartingHp({ level: 0, conScore: 16, ancestryKey: "human" })).toBe(3); // +3
    expect(computeShadowdarkStartingHp({ level: 0, conScore: 14, ancestryKey: "dwarf" })).toBe(4); // +2 CON + 2 Stout

    const gear = rollLevelZeroGear({ countRoll: 3, itemRolls: [1, 4, 8] });
    expect(gear).toEqual(["Torch", "Shortbow and 5 arrows", "Iron spikes (10)"]);

    // 0-level PCs can wield all weapons and wear all armor until 1st level
    expect(canClassUseWeapon(null, 0, "greatsword")).toBe(true);
    expect(canClassUseArmor(null, 0, "plate", true)).toBe(true);
  });

  it("computes 1st-Level character HP = max(1, Class Hit Die + CON mod) (+2 for Dwarf Stout) and starting gold 2d6*5 (pgs. 14, 33)", () => {
    expect(
      computeShadowdarkStartingHp({
        level: 1,
        classKey: "fighter",
        conScore: 14,
        ancestryKey: "human",
        hitDieRoll: 8,
      }),
    ).toBe(10); // 8 + 2
    expect(
      computeShadowdarkStartingHp({
        level: 1,
        classKey: "fighter",
        conScore: 14,
        ancestryKey: "dwarf",
        hitDieRoll: 8,
      }),
    ).toBe(12); // 8 + 2 + 2 Stout
    expect(
      computeShadowdarkStartingHp({
        level: 1,
        classKey: "wizard",
        conScore: 3,
        ancestryKey: "human",
        hitDieRoll: 1,
      }),
    ).toBe(1); // max(1, 1 - 4) = 1

    expect(rollLevelOneGold([4, 5])).toBe(45); // (4 + 5) * 5 = 45 gp
  });

  it("supports full bidirectional Shadowdarklings JSON import and export", () => {
    const generated = generateRandomShadowdarkCharacter({
      level: 1,
      forcedAncestryRoll: 7, // Dwarf
      forcedClassRoll: 1, // Fighter
      forcedBackgroundRoll: 11, // Mercenary
      forcedAlignmentRoll: 1, // Lawful
      forcedDeityRoll: 1, // Saint Terragnis
      forcedNameRoll: 2, // Torbin
    });
    const exported = exportToShadowdarklings(generated);
    expect(exported.name).toBe("Torbin");
    expect(exported.ancestry).toBe("Dwarf");
    expect(exported.class).toBe("Fighter");
    expect(exported.level).toBe(1);
    expect(exported.alignment).toBe("Lawful");
    expect(exported.background).toBe("Mercenary");
    expect(exported.deity).toBe("Saint Terragnis");
    expect(exported.title).toBe("Squire");
    expect(exported.stats).toHaveProperty("STR");
    expect(exported.stats).toHaveProperty("DEX");
    expect(exported.stats).toHaveProperty("CON");
    expect(exported.stats).toHaveProperty("INT");
    expect(exported.stats).toHaveProperty("WIS");
    expect(exported.stats).toHaveProperty("CHA");
    expect(exported.gearSlotsTotal).toBeGreaterThanOrEqual(10);

    const reimported = importFromShadowdarklings(exported);
    expect(reimported.name).toBe("Torbin");
    expect(reimported.ancestryId).toBe("dwarf");
    expect(reimported.classId).toBe("fighter");
    expect(reimported.backgroundId).toBe("mercenary");
    expect(reimported.level).toBe(1);
    expect(reimported.extras.alignment).toBe("Lawful");
    expect(reimported.extras.deity).toBe("Saint Terragnis");
    expect(reimported.extras.title).toBe("Squire");
    expect(reimported.abilities.str).toBe(exported.stats.STR);
  });
});

describe("2. All 6 Core Ancestries (pgs. 16-17)", () => {
  it("defines Dwarf, Elf, Goblin, Half-Orc, Halfling, and Human with exact languages and traits", () => {
    expect(Object.keys(SHADOWDARK_ANCESTRIES)).toEqual([
      "dwarf",
      "elf",
      "goblin",
      "half-orc",
      "halfling",
      "human",
    ]);

    expect(SHADOWDARK_ANCESTRIES["dwarf"]).toMatchObject({
      name: "Dwarf",
      languages: ["Common", "Dwarvish"],
      traitName: "Stout",
      stoutHpBonus: 2,
      hpRollAdvantage: true,
    });

    // Dwarf rolls HP gains per level with advantage
    const dwarfLvlUp = rollShadowdarkLevelUpHp({
      classKey: "fighter",
      ancestryKey: "dwarf",
      forcedRolls: [2, 7],
    });
    expect(dwarfLvlUp.hpGained).toBe(7);
    expect(dwarfLvlUp.hasAdvantage).toBe(true);

    expect(SHADOWDARK_ANCESTRIES["elf"]).toMatchObject({
      name: "Elf",
      languages: ["Common", "Elvish", "Sylvan"],
      traitName: "Farsight",
    });

    expect(SHADOWDARK_ANCESTRIES["goblin"]).toMatchObject({
      name: "Goblin",
      languages: ["Common", "Goblin"],
      traitName: "Keen Senses",
      immuneToSurprise: true,
    });

    expect(SHADOWDARK_ANCESTRIES["half-orc"]).toMatchObject({
      name: "Half-Orc",
      languages: ["Common", "Orcish"],
      traitName: "Mighty",
      meleeAttackBonus: 1,
      meleeDamageBonus: 1,
    });

    expect(SHADOWDARK_ANCESTRIES["halfling"]).toMatchObject({
      name: "Halfling",
      languages: ["Common"],
      traitName: "Stealthy",
      invisibilityRoundsPerDay: 3,
    });

    expect(SHADOWDARK_ANCESTRIES["human"]).toMatchObject({
      name: "Human",
      languages: ["Common"],
      extraCommonLanguages: 1,
      traitName: "Ambitious",
      extraTalentRollsAtLevel1: 1,
    });
  });
});

describe("3. All 4 Classes, Talents, Titles, Deities, Backgrounds & Progression (pgs. 18-32, 38-39)", () => {
  it("defines Fighter, Priest, Thief, and Wizard with exact hit dice, weapon/armor restrictions, and class talents", () => {
    expect(SHADOWDARK_CLASSES.fighter.hitDie).toBe(8);
    expect(SHADOWDARK_CLASSES.priest.hitDie).toBe(6);
    expect(SHADOWDARK_CLASSES.thief.hitDie).toBe(4);
    expect(SHADOWDARK_CLASSES.wizard.hitDie).toBe(4);

    // Weapon restrictions
    expect(canClassUseWeapon("fighter", 1, "greatsword")).toBe(true);
    expect(canClassUseWeapon("priest", 1, "warhammer")).toBe(true);
    expect(canClassUseWeapon("priest", 1, "greatsword")).toBe(false);
    expect(canClassUseWeapon("thief", 1, "shortsword")).toBe(true);
    expect(canClassUseWeapon("thief", 1, "longsword")).toBe(false);
    expect(canClassUseWeapon("wizard", 1, "dagger")).toBe(true);
    expect(canClassUseWeapon("wizard", 1, "staff")).toBe(true);
    expect(canClassUseWeapon("wizard", 1, "mace")).toBe(false);

    // Armor restrictions
    expect(canClassUseArmor("fighter", 1, "plate", true)).toBe(true);
    expect(canClassUseArmor("priest", 1, "plate", true)).toBe(true);
    expect(canClassUseArmor("thief", 1, "leather", false)).toBe(true);
    expect(canClassUseArmor("thief", 1, "mithral-chain", false)).toBe(true);
    expect(canClassUseArmor("thief", 1, "chainmail", false)).toBe(false);
    expect(canClassUseArmor("thief", 1, "leather", true)).toBe(false);
    expect(canClassUseArmor("wizard", 1, "leather", false)).toBe(false);
    expect(canClassUseArmor("wizard", 1, null, false)).toBe(true);

    // 2d6 Class Talents tables
    expect(rollClassTalent("fighter", 2).effect).toContain("Weapon Mastery");
    expect(rollClassTalent("fighter", 5).effect).toContain("+1 to melee and ranged attacks");
    expect(rollClassTalent("priest", 8).effect).toContain("+1 to priest spellcasting checks");
    expect(rollClassTalent("thief", 2).effect).toContain("advantage on initiative");
    expect(rollClassTalent("thief", 4).effect).toContain("Backstab deals +1 dice");
    expect(rollClassTalent("wizard", 5).effect).toContain("+2 to Intelligence");
  });

  it("defines Priest and Wizard Spells Known by Level and Tier (pgs. 21, 25)", () => {
    expect(PRIEST_SPELLS_KNOWN_BY_TIER[1]).toEqual([2, 0, 0, 0, 0]);
    expect(PRIEST_SPELLS_KNOWN_BY_TIER[5]).toEqual([3, 2, 1, 0, 0]);
    expect(PRIEST_SPELLS_KNOWN_BY_TIER[10]).toEqual([3, 3, 3, 2, 2]);

    expect(WIZARD_SPELLS_KNOWN_BY_TIER[1]).toEqual([3, 0, 0, 0, 0]);
    expect(WIZARD_SPELLS_KNOWN_BY_TIER[5]).toEqual([4, 2, 1, 0, 0]);
    expect(WIZARD_SPELLS_KNOWN_BY_TIER[10]).toEqual([4, 4, 4, 2, 2]);
  });

  it("includes all 20 backgrounds, 3 alignments, 9 deities, 10 common + 4 rare languages, and d20 ancestry names", () => {
    expect(SHADOWDARK_BACKGROUNDS).toHaveLength(20);
    expect(SHADOWDARK_BACKGROUNDS[0].name).toBe("Urchin");
    expect(SHADOWDARK_BACKGROUNDS[19].name).toBe("Chirurgeon");

    expect(SHADOWDARK_ALIGNMENTS).toEqual(["Lawful", "Neutral", "Chaotic"]);
    expect(SHADOWDARK_DEITIES).toHaveLength(9);

    expect(SHADOWDARK_LANGUAGES.common).toHaveLength(10);
    expect(SHADOWDARK_LANGUAGES.rare).toEqual([
      "Celestial",
      "Diabolic",
      "Draconic",
      "Primordial",
    ]);

    expect(SHADOWDARK_NAMES.dwarf).toHaveLength(20);
    expect(SHADOWDARK_NAMES.elf).toHaveLength(20);
    expect(SHADOWDARK_NAMES.goblin).toHaveLength(20);
    expect(SHADOWDARK_NAMES.halfling).toHaveLength(20);
    expect(SHADOWDARK_NAMES["half-orc"]).toHaveLength(20);
    expect(SHADOWDARK_NAMES.human).toHaveLength(20);
  });

  it("looks up exact Titles by Class, Level bracket, and Alignment (pgs. 30-31) and checks talent roll levels (pg. 39)", () => {
    expect(getCharacterTitle("fighter", 1, "Lawful")).toBe("Squire");
    expect(getCharacterTitle("fighter", 4, "Chaotic")).toBe("Bandit");
    expect(getCharacterTitle("fighter", 10, "Neutral")).toBe("Chieftain");

    expect(getCharacterTitle("priest", 1, "Neutral")).toBe("Seeker");
    expect(getCharacterTitle("priest", 9, "Lawful")).toBe("Paladin");
    expect(getCharacterTitle("priest", 10, "Chaotic")).toBe("Chaos Knight");

    expect(getCharacterTitle("thief", 2, "Chaotic")).toBe("Thug");
    expect(getCharacterTitle("thief", 6, "Lawful")).toBe("Rook");
    expect(getCharacterTitle("thief", 9, "Neutral")).toBe("Bandit King/Queen");

    expect(getCharacterTitle("wizard", 1, "Lawful")).toBe("Apprentice");
    expect(getCharacterTitle("wizard", 5, "Chaotic")).toBe("Witch/Warlock");
    expect(getCharacterTitle("wizard", 10, "Neutral")).toBe("Druid");

    // Talent rolls at levels 1, 3, 5, 7, 9
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(isTalentRollLevel)).toEqual([
      1, 3, 5, 7, 9,
    ]);
  });
});

describe("4. Gear Slots, Basic Gear, Crawling Kit, Armor & Weapons (pgs. 34-37)", () => {
  it("calculates max and used gear slots including Fighter Hauler, free backpack, 100 free coins, and stackables", () => {
    // Fighter with STR 12, CON 14 (+2) -> max(10, 12) + 2 = 14 slots
    const slots = calculateShadowdarkGearSlots({
      strScore: 12,
      conScore: 14,
      classKey: "fighter",
      coins: { gp: 80, sp: 50, cp: 20 }, // 150 coins -> first 100 free, remaining 50 = 1 slot
      items: [
        { name: "Backpack", quantity: 1 }, // 1st free -> 0 slots
        { name: "Arrows", quantity: 25 }, // 20/slot -> 2 slots
        { name: "Rations", quantity: 6 }, // 3/slot -> 2 slots
        { name: "Iron spikes", quantity: 10 }, // 10/slot -> 1 slot
        { name: "Greatsword", quantity: 1 }, // 2 slots
        { name: "Holy symbol", quantity: 1 }, // 0 slots
        { name: "Thieves' tools", quantity: 1 }, // 0 slots
      ],
    });
    expect(slots.maxSlots).toBe(14);
    expect(slots.coinSlots).toBe(1);
    expect(slots.itemSlots).toBe(7); // 0 + 2 + 2 + 1 + 2 + 0 + 0
    expect(slots.usedSlots).toBe(8);

    // Crawling Kit is 7 gp and 7 gear slots
    expect(SHADOWDARK_CRAWLING_KIT.costGp).toBe(7);
    expect(SHADOWDARK_CRAWLING_KIT.totalSlots).toBe(7);
    expect(SHADOWDARK_BASIC_GEAR.length).toBeGreaterThanOrEqual(18);
  });

  it("includes all Armor and all 15 Weapons with exact slots, properties, and attack/damage math", () => {
    expect(SHADOWDARK_WEAPONS).toHaveLength(15);
    expect(SHADOWDARK_ARMOR.find((a) => a.key === "mithral-plate")?.slots).toBe(2);

    const bastardSword = SHADOWDARK_WEAPONS.find((w) => w.key === "bastard-sword")!;
    expect(bastardSword).toMatchObject({
      cost: "10 gp",
      type: "M",
      range: "C",
      damage: "1d8",
      versatileDamage: "1d10",
      slots: 2,
      properties: ["V"],
    });

    // Half-Orc Fighter Lv 4 with Weapon Mastery in greatsword (STR 16 -> +3)
    // Attack bonus = STR (+3) + Half-Orc Mighty (+1) + Weapon Mastery (+1 + floor(4/2) = +3) = +7
    // Damage = 1d12 + Mighty (+1) + Weapon Mastery (+3) = 1d12+4
    const fighterAtk = computeWeaponAttackAndDamage({
      weaponKey: "greatsword",
      strScore: 16,
      dexScore: 10,
      level: 4,
      classKey: "fighter",
      ancestryKey: "half-orc",
      weaponMasteryKeys: ["greatsword"],
    });
    expect(fighterAtk.attackBonus).toBe(7);
    expect(fighterAtk.damageFormula).toBe("1d12+4");

    // Thief Lv 5 backstabbing unaware target with dagger (DEX 16 -> +3, Finesse uses max(STR, DEX))
    // Backstab adds 1 + floor(5/2) = 3 extra d4s -> 4d4 total damage dice
    const thiefBackstab = computeWeaponAttackAndDamage({
      weaponKey: "dagger",
      strScore: 8,
      dexScore: 16,
      level: 5,
      classKey: "thief",
      ancestryKey: "halfling",
      targetUnaware: true,
    });
    expect(thiefBackstab.attackBonus).toBe(3);
    expect(thiefBackstab.damageFormula).toBe("4d4");
  });
});

describe("5. Magic, Focus, Criticals, Penance & Wizard Mishap Tables (pgs. 44-73)", () => {
  it("resolves Spellcasting Checks (DC = 10 + Tier), Critical Success, Priest Penance, and Wizard Mishaps", () => {
    expect(SHADOWDARK_SPELLS.length).toBeGreaterThanOrEqual(85);
    expect(PRIEST_PENANCE_SACRIFICE_GP).toEqual({
      1: 5,
      2: 20,
      3: 40,
      4: 90,
      5: 150,
    });

    // Wizard casts Fireball (Tier 3, DC 13) with INT 16 (+3) and roll 12 -> total 15 >= 13 (Success)
    const success = resolveSpellcastingCheck({
      spellKey: "fireball",
      casterClass: "wizard",
      abilityScore: 16,
      forcedD20: 12,
    });
    expect(success.dc).toBe(13);
    expect(success.success).toBe(true);
    expect(success.spellLost).toBe(false);

    // Critical Success (Nat 20) doubles numerical effect
    const critSuccess = resolveSpellcastingCheck({
      spellKey: "burning-hands",
      casterClass: "wizard",
      abilityScore: 14,
      forcedD20: 20,
    });
    expect(critSuccess.isCriticalSuccess).toBe(true);
    expect(critSuccess.doubleNumericalEffect).toBe(true);

    // Priest Critical Failure (Nat 1) on Cure Wounds (Tier 1) triggers Penance (5 gp)
    const priestCritFail = resolveSpellcastingCheck({
      spellKey: "cure-wounds",
      casterClass: "priest",
      abilityScore: 16,
      forcedD20: 1,
    });
    expect(priestCritFail.isCriticalFailure).toBe(true);
    expect(priestCritFail.spellLost).toBe(true);
    expect(priestCritFail.penanceRequired).toEqual({
      spellKey: "cure-wounds",
      tier: 1,
      sacrificeGp: 5,
    });

    // Wizard Critical Failure (Nat 1) rolls on Mishap table; rolling 1 triggers Devastation! (2 combined rolls)
    const devastation = rollWizardMishap(1, [1, 2, 9]);
    expect(devastation.isDevastation).toBe(true);
    expect(devastation.effects).toHaveLength(2);
    expect(WIZARD_MISHAP_TABLES.tier1_2).toHaveLength(12);
    expect(WIZARD_MISHAP_TABLES.tier3_4).toHaveLength(12);
    expect(WIZARD_MISHAP_TABLES.tier5).toHaveLength(12);
  });

  it("resolves Focus Maintenance checks, Scrolls/Wands, and Wizard Learning Spells from Scroll (DC 15 INT)", () => {
    // Normal failure on focus maintenance ends focus without losing the spell
    const focusFail = resolveFocusCheck({
      spellKey: "acid-arrow",
      casterClass: "wizard",
      abilityScore: 12,
      forcedD20: 5, // 5 + 1 = 6 < DC 12
    });
    expect(focusFail.maintained).toBe(false);
    expect(focusFail.focusEnded).toBe(true);
    expect(focusFail.spellLost).toBe(false);

    // Scroll cast: expended on attempt; failure does not lose known spell
    const scrollCast = resolveScrollOrWandCast({
      itemType: "scroll",
      spellKey: "fireball",
      casterClass: "wizard",
      abilityScore: 12,
      forcedD20: 5,
    });
    expect(scrollCast.success).toBe(false);
    expect(scrollCast.itemExpendedOrBroken).toBe(true);
    expect(scrollCast.knownSpellLost).toBe(false);

    // Learn spell from scroll: DC 15 INT check, always expends scroll
    const learnSuccess = resolveLearnSpellFromScroll({
      spellKey: "web",
      intScore: 16, // +3
      forcedD20: 13, // 13 + 3 = 16 >= 15
    });
    expect(learnSuccess.learned).toBe(true);
    expect(learnSuccess.scrollExpended).toBe(true);
  });
});

describe("6. Gameplay, Light Timers, Combat, Dying, Resting & Carousing (pgs. 78-95, 110-117)", () => {
  it("supports Light Sources (ride-along, extinguish-and-reset, Campfire 3 torches = 8 hrs, Blitz Mode, Light Mishaps)", () => {
    expect(SHADOWDARK_DCS).toEqual({ easy: 9, normal: 12, hard: 15, extreme: 18 });
    expect(LIGHT_MISHAPS).toHaveLength(6);
    expect(rollLightMishap(1).name).toBe("Dud");

    // Ride-along preserves current remaining minutes
    const rideAlong = manageLightSource({
      mode: "ride-along",
      currentRemainingMinutes: 22,
    });
    expect(rideAlong.remainingMinutes).toBe(22);

    // Extinguish-and-reset starts fresh 60m timer (30m in Blitz Mode)
    expect(
      manageLightSource({ mode: "extinguish-and-reset", currentRemainingMinutes: 22 })
        .remainingMinutes,
    ).toBe(60);
    expect(
      manageLightSource({
        mode: "extinguish-and-reset",
        currentRemainingMinutes: 10,
        blitzMode: true,
      }).remainingMinutes,
    ).toBe(30);

    // Campfire uses 3 torches for 8 hours (480 minutes)
    const campfire = manageLightSource({ mode: "campfire", torchesAvailable: 3 });
    expect(campfire.torchesConsumed).toBe(3);
    expect(campfire.remainingMinutes).toBe(480);
  });

  it("resolves Morale (DC 15 WIS), Death Timer (1d4 + CON mod min 1), Nat 20 rise with 1 HP, and Stabilize (DC 15 INT)", () => {
    expect(rollMoraleCheck({ wisModifier: 1, forcedD20: 12 }).flee).toBe(true); // 13 < 15
    expect(rollMoraleCheck({ wisModifier: 2, forcedD20: 14 }).flee).toBe(false); // 16 >= 15

    expect(rollDeathTimer({ conScore: 6, forcedD4: 1 }).rounds).toBe(1); // max(1, 1 - 2) = 1
    expect(rollDeathTimer({ conScore: 14, forcedD4: 3 }).rounds).toBe(5); // 3 + 2 = 5
    expect(rollDeathTimer({ conScore: 14, forcedD4: 3, deadlyMode: true }).rounds).toBe(1);
    expect(rollDeathTimer({ conScore: 14, forcedD4: 3, fatalityMode: true }).instantDeath).toBe(
      true,
    );

    const rise = rollDyingTurn({ remainingRounds: 2, forcedD20: 20 });
    expect(rise.risesWithOneHp).toBe(true);
    expect(rise.dying).toBe(false);

    const stabilize = resolveStabilizeCheck({ intScore: 14, forcedD20: 13 }); // 13 + 2 = 15 >= 15
    expect(stabilize.stabilized).toBe(true);
  });

  it("resolves Resting (DC 12 CON on interruption, Grinder Mode), Carousing, Wizards & Thieves, and Treasure XP", () => {
    // Interrupted rest failing DC 12 CON consumes ration and grants no benefit
    const failedRest = resolveRest({
      hpCurrent: 2,
      hpMax: 10,
      rations: 2,
      interrupted: true,
      conScore: 10,
      forcedInterruptionD20: 8,
    });
    expect(failedRest.success).toBe(false);
    expect(failedRest.rationsRemaining).toBe(1);
    expect(failedRest.hpCurrent).toBe(2);

    // Successful rest restores full HP and lost spells
    const goodRest = resolveRest({
      hpCurrent: 2,
      hpMax: 10,
      rations: 2,
      lostSpells: ["light", "burning-hands"],
    });
    expect(goodRest.success).toBe(true);
    expect(goodRest.hpCurrent).toBe(10);
    expect(goodRest.lostSpells).toEqual([]);

    // Carousing: 300 gp (+2 bonus) + roll 8 = 10 -> 5 XP + luck token
    expect(CAROUSING_EVENTS).toHaveLength(7);
    expect(CAROUSING_OUTCOMES.length).toBeGreaterThanOrEqual(14);
    const carouse = resolveCarousing({ eventCostGp: 300, forcedD8: 8 });
    expect(carouse.totalRoll).toBe(10);
    expect(carouse.xpGained).toBe(5);
    expect(carouse.luckTokenGained).toBe(true);

    // Wizards and Thieves dice game
    const threeThieves = playWizardsAndThievesTurn({
      declared: "thief",
      pot: 11,
      otherPlayersCount: 3,
      forcedDice: [1, 1, 1],
    });
    expect(threeThieves.gameEnded).toBe(true);
    expect(threeThieves.eachOtherPlayerGets).toBe(3); // 11 / 3 = 3
    expect(threeThieves.activePlayerRemainder).toBe(2); // honor among thieves!

    // Treasure Quality XP & Hunter Mode XP
    expect(awardTreasureQualityXp("poor")).toBe(0);
    expect(awardTreasureQualityXp("normal")).toBe(1);
    expect(awardTreasureQualityXp("fabulous")).toBe(3);
    expect(awardTreasureQualityXp("legendary")).toBe(10);
    expect(computeHunterModeMonsterXp(5)).toBe(2);
  });
});
