import { describe, expect, it } from "vitest";
import {
  SHADOWDARK_COMBAT_ROLES,
  SHADOWDARK_MONSTERS,
  SHADOWDARK_PROCEDURAL_TABLES,
  computeMonsterStatsFromRole,
  generateProceduralMonster,
  getShadowdarkMonster,
  searchShadowdarkMonsters,
} from "../../src/rules/shadowdarkMonsters.js";

describe("Shadowdark Monster Compendium & Rules (pgs. 187-266)", () => {
  it("includes all official Shadowdark monsters with core attributes (pg. 189)", () => {
    expect(SHADOWDARK_MONSTERS.length).toBeGreaterThanOrEqual(150);

    const requiredMonsters = [
      "Aboleth",
      "Acolyte",
      "Archangel",
      "Animated Armor",
      "Ankheg",
      "Ape",
      "Apprentice",
      "Archmage",
      "Assassin",
      "Azer",
      "Badger",
      "Bandit",
      "Basilisk",
      "Giant Bat",
      "Bat Swarm",
      "Brown Bear",
      "Polar Bear",
      "Berserker",
      "Black Pudding",
      "Boar",
      "Brain Eater",
      "Bugbear",
      "Bulette",
      "Camel",
      "Cave Brute",
      "Centaur",
      "Giant Centipede",
      "Chimera",
      "Chuul",
      "Cloaker",
      "Cockatrice",
      "Couatl",
      "Giant Crab",
      "Crocodile",
      "Cultist",
      "Cyclops",
      "Darkmantle",
      "Deep One",
      "Balor",
      "Dretch",
      "Glabrezu",
      "Marilith",
      "Vrock",
      "Archdevil",
      "Barbed Devil",
      "Erinyes",
      "Horned Devil",
      "Imp",
      "Tyrannosaurus",
      "Velociraptor",
      "Djinni",
      "Doppelganger",
      "Fire Dragon",
      "Frost Dragon",
      "Sea Dragon",
      "Drow",
      "Drider",
      "Dryad",
      "Duergar",
      "Giant Dung Beetle",
      "Efreeti",
      "Lesser Air Elemental",
      "Greater Fire Elemental",
      "Elephant",
      "Ettercap",
      "Gelatinous Cube",
      "Ghast",
      "Ghost",
      "Ghoul",
      "Hill Giant",
      "Frost Giant",
      "Storm Giant",
      "Gibbering Mouther",
      "Gladiator",
      "Gnoll",
      "Deep Gnome",
      "Goblin",
      "Goblin Boss",
      "Goblin Shaman",
      "Clay Golem",
      "Flesh Golem",
      "Iron Golem",
      "Stone Golem",
      "Gorgon",
      "Gray Ooze",
      "Grick",
      "Griffon",
      "Guard",
      "Night Hag",
      "Harpy",
      "Hell Hound",
      "Hippogriff",
      "Hobgoblin",
      "Hydra",
      "Invisible Stalker",
      "Knight",
      "Kobold",
      "Kobold Sorcerer",
      "Kraken",
      "Giant Leech",
      "Lich",
      "Lion",
      "Lizardfolk",
      "Mage",
      "Mammoth",
      "Manticore",
      "Medusa",
      "Mimic",
      "Minotaur",
      "Mummy",
      "Mushroomfolk",
      "Naga",
      "Bone Naga",
      "Nightmare",
      "Ochre Jelly",
      "Giant Octopus",
      "Ogre",
      "Oni",
      "Orc",
      "Orc Chieftain",
      "Otyugh",
      "Owlbear",
      "Panther",
      "Peasant",
      "Pegasus",
      "Phoenix",
      "Piranha Swarm",
      "Pirate",
      "Priest",
      "Purple Worm",
      "Rakshasa",
      "Giant Rat",
      "Rat Swarm",
      "Reaver",
      "Remorhaz",
      "Roc",
      "Roper",
      "Rust Monster",
      "Sahuagin",
      "Salamander",
      "Giant Scorpion",
      "Shadow",
      "Shambling Mound",
      "Shark",
      "Siren",
      "Skeleton",
      "Smilodon",
      "Giant Snake",
      "Snake Swarm",
      "Soldier",
      "Sphinx",
      "Giant Spider",
      "Spider Swarm",
      "Stingbat",
      "Thief",
      "Thug",
      "Treant",
      "Troll",
      "Frost Troll",
      "Unicorn",
      "Vampire",
      "Vampire Spawn",
      "Violet Fungus",
      "Viperian",
      "Wandering Merchant",
      "Giant Wasp",
      "Wererat",
      "Werewolf",
      "Wight",
      "Will-o'-Wisp",
      "Wolf",
      "Dire Wolf",
      "Winter Wolf",
      "Worg",
      "Wraith",
      "Wyvern",
      "Zombie",
    ];

    for (const name of requiredMonsters) {
      const monster = SHADOWDARK_MONSTERS.find(
        (m) => m.name.toLowerCase() === name.toLowerCase(),
      );
      expect(monster, `Monster ${name} should exist in compendium`).toBeDefined();
      expect(monster!.ac).toBeGreaterThanOrEqual(5);
      expect(monster!.hp).toBeGreaterThanOrEqual(1);
      expect(monster!.level).toBeGreaterThanOrEqual(0);
      expect(["Lawful", "Neutral", "Chaotic"]).toContain(monster!.alignment);
      expect(monster!.movement).toBeTruthy();
      expect(monster!.attacks.length).toBeGreaterThanOrEqual(1);
      expect(monster!.modifiers).toBeDefined();
      expect(typeof monster!.modifiers.dex).toBe("number");
      expect(typeof monster!.darkAdapted).toBe("boolean");
    }
  });

  it("getShadowdarkMonster finds monster by exact, case-insensitive, or slug name", () => {
    const goblin = getShadowdarkMonster("goblin");
    expect(goblin).toBeDefined();
    expect(goblin?.name).toBe("Goblin");
    expect(goblin?.ac).toBe(13);
    expect(goblin?.level).toBe(1);

    const aboleth = getShadowdarkMonster("aboleth");
    expect(aboleth).toBeDefined();
    expect(aboleth?.level).toBe(8);

    const none = getShadowdarkMonster("nonexistent-creature");
    expect(none).toBeUndefined();
  });

  it("searchShadowdarkMonsters filters by name search, level, and alignment", () => {
    const goblins = searchShadowdarkMonsters({ search: "goblin" });
    expect(goblins.length).toBeGreaterThanOrEqual(3); // Goblin, Goblin Boss, Goblin Shaman
    expect(goblins.every((g) => g.name.toLowerCase().includes("goblin"))).toBe(true);

    const levelTwo = searchShadowdarkMonsters({ level: 2 });
    expect(levelTwo.length).toBeGreaterThan(0);
    expect(levelTwo.every((m) => m.level === 2)).toBe(true);

    const lawful = searchShadowdarkMonsters({ alignment: "Lawful" });
    expect(lawful.length).toBeGreaterThan(0);
    expect(lawful.every((m) => m.alignment === "Lawful")).toBe(true);
  });

  it("supports Designing Monsters Combat Roles presets (pg. 192)", () => {
    const roles = Object.keys(SHADOWDARK_COMBAT_ROLES);
    expect(roles).toEqual(
      expect.arrayContaining([
        "Mook",
        "Soldier",
        "Striker",
        "Tank",
        "Controller",
        "Legendary",
      ]),
    );

    const soldierLv3 = computeMonsterStatsFromRole("Soldier", 3);
    expect(soldierLv3.ac).toBe(13);
    expect(soldierLv3.hp).toBe(14);
    expect(soldierLv3.attackBonus).toBe(3);
    expect(soldierLv3.damageFormula).toBe("1d8");

    const tankLv3 = computeMonsterStatsFromRole("Tank", 3);
    expect(tankLv3.hp).toBeGreaterThan(soldierLv3.hp);
    expect(tankLv3.ac).toBeGreaterThan(soldierLv3.ac);

    const strikerLv3 = computeMonsterStatsFromRole("Striker", 3);
    expect(strikerLv3.damageFormula).toBe("1d10");
    expect(strikerLv3.hp).toBeLessThan(soldierLv3.hp);

    const legendaryLv5 = computeMonsterStatsFromRole("Legendary", 5);
    expect(legendaryLv5.hp).toBeGreaterThan(40);
    expect(legendaryLv5.attacksCount).toBeGreaterThanOrEqual(2);
  });

  it("implements Procedural Monster Generator table based on Party Level PL (pg. 190)", () => {
    // Test deterministic procedural generation with PL = 3
    const generated = generateProceduralMonster({
      partyLevel: 3,
      rollCombat: 8, // PL + 0 => Level 3, attack bonus +3
      rollQuality: 1, // Beastlike
      rollStrength: 1, // +1 attack
      rollWeakness: 1, // Cold
    });

    expect(generated.ac).toBe(13); // AC = PL + 10 = 3 + 10 = 13
    expect(generated.level).toBe(3);
    expect(generated.attackBonus).toBe(3);
    expect(generated.quality).toBe("Beastlike");
    expect(generated.strength).toBe("+1 attack");
    expect(generated.weakness).toBe("Cold");
    expect(generated.hp).toBeGreaterThanOrEqual(1);

    // Test extreme combat roll PL - 3 and PL + 4
    const weakGen = generateProceduralMonster({
      partyLevel: 2,
      rollCombat: 1, // PL - 3 => 0 (clamped min 0)
      rollQuality: 2,
      rollStrength: 2,
      rollWeakness: 2,
    });
    expect(weakGen.level).toBe(0);
    expect(weakGen.attackBonus).toBe(0);

    const bossGen = generateProceduralMonster({
      partyLevel: 4,
      rollCombat: 20, // PL + 4 => Level 8
      rollQuality: 8, // Draconic
      rollStrength: 4,
      rollWeakness: 5,
    });
    expect(bossGen.level).toBe(8);
    expect(bossGen.attackBonus).toBe(8);
    expect(bossGen.ac).toBe(14); // 4 + 10
  });

  it("implements 'Make It Weird' Monster Mutations table (pg. 191)", () => {
    const mutated = generateProceduralMonster({
      partyLevel: 3,
      rollCombat: 10,
      rollQuality: 5, // Arachnid
      rollStrength: 5, // Poison sting
      rollWeakness: 3, // Light
      mutationRolls: [
        { table: 1, roll: 12 }, // Wings (fly speed)
        { table: 2, roll: 4 }, // +1 attack
        { table: 3, roll: 1 }, // Speaks Common
      ],
    });

    expect(mutated.mutations.length).toBe(3);
    expect(mutated.mutations[0]).toBe("Wings");
    expect(mutated.mutations[1]).toBe("+1 attack");
    expect(mutated.mutations[2]).toBe("Speaks Common");
    expect(mutated.movement).toContain("Fly");
    expect(mutated.attacksCount).toBeGreaterThanOrEqual(2);
    // +2 level adjustment for treasure
    expect(mutated.treasureLevelAdjustment).toBe(2);
  });
});
