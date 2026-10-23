/**
 * Shadowdark RPG Monster Compendium, Procedural Generator & Combat Roles (pgs. 187-266).
 * Kelsey Dionne / The Arcane Library.
 */

export interface ShadowdarkMonsterAttack {
  name: string;
  count?: number;
  bonus: number;
  damage: string;
  range?: "Close" | "Near" | "Far";
  notes?: string;
}

export interface ShadowdarkMonsterModifiers {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface ShadowdarkMonsterDef {
  id: string;
  name: string;
  level: number;
  alignment: "Lawful" | "Neutral" | "Chaotic";
  ac: number;
  hp: number;
  movement: string;
  speed?: number;
  attacks: ShadowdarkMonsterAttack[];
  modifiers: ShadowdarkMonsterModifiers;
  darkAdapted: boolean;
  spells?: string[];
  features: string[];
  description?: string;
}

export type ShadowdarkCombatRole =
  | "Mook"
  | "Soldier"
  | "Striker"
  | "Tank"
  | "Controller"
  | "Legendary";

export interface CombatRolePreset {
  name: ShadowdarkCombatRole;
  description: string;
  acFormula: (lvl: number) => number;
  hpFormula: (lvl: number) => number;
  attackBonusFormula: (lvl: number) => number;
  damageFormula: (lvl: number) => string;
  attacksCount: (lvl: number) => number;
}

export const SHADOWDARK_COMBAT_ROLES: Record<
  ShadowdarkCombatRole,
  CombatRolePreset
> = {
  Mook: {
    name: "Mook",
    description: "Weak, numerous minions with low HP and damage",
    acFormula: (lvl) => Math.max(10, 10 + Math.floor(lvl / 3)),
    hpFormula: (lvl) => Math.max(1, Math.round(lvl * 3)),
    attackBonusFormula: (lvl) => Math.max(0, lvl - 1),
    damageFormula: (lvl) => (lvl >= 4 ? "1d6" : "1d4"),
    attacksCount: () => 1,
  },
  Soldier: {
    name: "Soldier",
    description: "Balanced frontline combatants with steady offense and defense",
    acFormula: (lvl) => (lvl === 0 ? 11 : 11 + Math.ceil(lvl / 2)),
    hpFormula: (lvl) => Math.max(4, Math.round(lvl * 4.5)),
    attackBonusFormula: (lvl) => lvl,
    damageFormula: () => "1d8",
    attacksCount: (lvl) => (lvl >= 7 ? 2 : 1),
  },
  Striker: {
    name: "Striker",
    description: "High damage offensive threats with lighter defenses",
    acFormula: (lvl) => Math.max(10, 10 + Math.floor(lvl / 2) - 1),
    hpFormula: (lvl) => Math.max(3, Math.round(lvl * 3.5)),
    attackBonusFormula: (lvl) => lvl + 1,
    damageFormula: () => "1d10",
    attacksCount: (lvl) => (lvl >= 5 ? 2 : 1),
  },
  Tank: {
    name: "Tank",
    description: "Durable defensive juggernauts with high HP and Armor Class",
    acFormula: (lvl) => Math.max(13, 13 + Math.floor(lvl / 2)),
    hpFormula: (lvl) => Math.max(6, Math.round(lvl * 6)),
    attackBonusFormula: (lvl) => lvl,
    damageFormula: () => "1d8",
    attacksCount: () => 1,
  },
  Controller: {
    name: "Controller",
    description: "Tactical manipulators with status-inflicting attacks and utility",
    acFormula: (lvl) => Math.max(11, 11 + Math.floor(lvl / 3)),
    hpFormula: (lvl) => Math.max(4, Math.round(lvl * 4)),
    attackBonusFormula: (lvl) => lvl,
    damageFormula: () => "1d6",
    attacksCount: () => 1,
  },
  Legendary: {
    name: "Legendary",
    description: "Apex boss-level threats with immense health pools and multi-attacks",
    acFormula: (lvl) => Math.max(14, 14 + Math.floor(lvl / 2)),
    hpFormula: (lvl) => Math.max(10, Math.round(lvl * 9)),
    attackBonusFormula: (lvl) => lvl + 2,
    damageFormula: () => "2d8",
    attacksCount: (lvl) => (lvl >= 8 ? 3 : 2),
  },
};

export function computeMonsterStatsFromRole(
  role: ShadowdarkCombatRole,
  level: number,
) {
  const preset = SHADOWDARK_COMBAT_ROLES[role] ?? SHADOWDARK_COMBAT_ROLES.Soldier;
  const lvl = Math.max(0, Math.floor(level));
  return {
    role: preset.name,
    level: lvl,
    ac: preset.acFormula(lvl),
    hp: preset.hpFormula(lvl),
    attackBonus: preset.attackBonusFormula(lvl),
    damageFormula: preset.damageFormula(lvl),
    attacksCount: preset.attacksCount(lvl),
  };
}

export const SHADOWDARK_PROCEDURAL_TABLES = {
  combat: [
    { min: 1, max: 2, modifier: -3, label: "PL - 3" },
    { min: 3, max: 4, modifier: -2, label: "PL - 2" },
    { min: 5, max: 6, modifier: -1, label: "PL - 1" },
    { min: 7, max: 10, modifier: 0, label: "PL + 0" },
    { min: 11, max: 14, modifier: 1, label: "PL + 1" },
    { min: 15, max: 16, modifier: 2, label: "PL + 2" },
    { min: 17, max: 18, modifier: 3, label: "PL + 3" },
    { min: 19, max: 20, modifier: 4, label: "PL + 4" },
  ],
  quality: [
    "Beastlike",
    "Avian",
    "Amphibious",
    "Demonic",
    "Arachnid",
    "Ooze",
    "Insectoid",
    "Draconic",
    "Plantlike",
    "Elephantine",
    "Undead",
    "Crystalline",
    "Humanoid",
    "Reptilian",
    "Aquatic",
    "Ethereal",
    "Aberrant",
    "Giant",
    "Construct",
    "Fey",
  ],
  strength: [
    "+1 attack",
    "Absorbs magic",
    "Swarm",
    "1d10 damage",
    "Poison sting",
    "Confusing gaze",
    "Eats metal",
    "Ranged attacks",
    "Highly intelligent",
    "Crushing grasp",
    "Psychic blast",
    "Stealthy",
    "Petrifying gaze",
    "Regeneration",
    "Breathes element",
    "Paralyzing aura",
    "Spellcaster",
    "Camouflaged",
    "Life drain",
    "Invisibility",
  ],
  weakness: [
    "Cold",
    "Greed",
    "Light",
    "Salt",
    "Fire",
    "Music",
    "Silver",
    "Holy water",
    "Iron",
    "Alcohol",
    "Mirrors",
    "Loud noise",
    "Sunlight",
    "Fragile shell",
    "Cowardly (morale -2)",
    "Acid",
    "Electricity",
    "Specific food",
    "Running water",
    "True name",
  ],
  mutations: {
    table1: [
      "Shapechanger",
      "Fins and gills",
      "Insulating fur",
      "Ironlike scales",
      "Extra limbs",
      "Tentacles",
      "Boneless",
      "Gigantic",
      "Flings spikes",
      "Two heads",
      "Burrows",
      "Wings",
    ],
    table2: [
      "Double damage",
      "Breathes fire",
      "Fast healing",
      "+1 attack",
      "+2 AC",
      "+2 levels",
      "+1d6 damage",
      "Life-draining touch",
      "Very fast",
      "Reflects spells",
      "Electrified weapon",
      "Acidic saliva",
    ],
    table3: [
      "Speaks Common",
      "Knows 1d4 spells",
      "Telepathic",
      "Toxic spores",
      "Sonic blasts",
      "Can teleport in bursts",
      "Paralytic touch",
      "Genius intellect",
      "Antimagic field",
      "Blood-draining bite",
      "Has swamp fever",
      "Blessed by a chaos deity",
    ],
  },
};

export interface ProceduralMonsterInput {
  partyLevel: number;
  rollCombat?: number;
  rollQuality?: number;
  rollStrength?: number;
  rollWeakness?: number;
  attacksCountRoll?: number;
  mutationRolls?: Array<{ table: 1 | 2 | 3; roll: number }>;
}

export function generateProceduralMonster(input: ProceduralMonsterInput) {
  const pl = Math.max(1, Math.floor(input.partyLevel));

  const combatRoll =
    input.rollCombat ?? Math.floor(Math.random() * 20) + 1;
  const combatEntry =
    SHADOWDARK_PROCEDURAL_TABLES.combat.find(
      (c) => combatRoll >= c.min && combatRoll <= c.max,
    ) ?? SHADOWDARK_PROCEDURAL_TABLES.combat[3];

  const qualityRoll =
    input.rollQuality ?? Math.floor(Math.random() * 20) + 1;
  const quality =
    SHADOWDARK_PROCEDURAL_TABLES.quality[
      Math.max(0, Math.min(19, qualityRoll - 1))
    ];

  const strengthRoll =
    input.rollStrength ?? Math.floor(Math.random() * 20) + 1;
  const strength =
    SHADOWDARK_PROCEDURAL_TABLES.strength[
      Math.max(0, Math.min(19, strengthRoll - 1))
    ];

  const weaknessRoll =
    input.rollWeakness ?? Math.floor(Math.random() * 20) + 1;
  const weakness =
    SHADOWDARK_PROCEDURAL_TABLES.weakness[
      Math.max(0, Math.min(19, weaknessRoll - 1))
    ];

  let level = Math.max(0, pl + combatEntry.modifier);
  let attackBonus = Math.max(0, pl + combatEntry.modifier);
  let ac = pl + 10;
  let hp = Math.max(1, Math.round((level <= 0 ? 1 : level) * 4.5));
  let attacksCount =
    input.attacksCountRoll ?? Math.floor(Math.random() * 4) + 1;
  let damageFormula = "1d8";
  let movement = "Near";
  const mutations: string[] = [];
  let treasureLevelAdjustment = 0;

  if (strength === "+1 attack") {
    attacksCount += 1;
  } else if (strength === "1d10 damage") {
    damageFormula = "1d10";
  }

  if (input.mutationRolls && input.mutationRolls.length > 0) {
    treasureLevelAdjustment = 2; // +2 level adjustment for treasure (pg. 191)
    for (const m of input.mutationRolls.slice(0, 3)) {
      const rollIdx = Math.max(0, Math.min(11, m.roll - 1));
      if (m.table === 1) {
        const text = SHADOWDARK_PROCEDURAL_TABLES.mutations.table1[rollIdx];
        mutations.push(text);
        if (text === "Wings") movement = "Near (Fly)";
        if (text === "Fins and gills") movement = "Near (Swim)";
        if (text === "Burrows") movement = "Near (Burrow)";
        if (text === "Ironlike scales") ac += 1;
      } else if (m.table === 2) {
        const text = SHADOWDARK_PROCEDURAL_TABLES.mutations.table2[rollIdx];
        mutations.push(text);
        if (text === "+1 attack") attacksCount += 1;
        if (text === "+2 AC") ac += 2;
        if (text === "+2 levels") {
          level += 2;
          attackBonus += 2;
          hp += 9;
        }
        if (text === "Very fast") movement = "Double near";
        if (text === "Double damage") damageFormula = "2d8";
        if (text === "+1d6 damage") damageFormula = `${damageFormula}+1d6`;
      } else if (m.table === 3) {
        const text = SHADOWDARK_PROCEDURAL_TABLES.mutations.table3[rollIdx];
        mutations.push(text);
      }
    }
  }

  const name = `${quality} Aberration`;

  return {
    name,
    level,
    ac,
    hp,
    attackBonus,
    damageFormula,
    attacksCount,
    movement,
    quality,
    strength,
    weakness,
    mutations,
    treasureLevelAdjustment,
    alignment: "Chaotic" as const,
    dexModifier: 0,
    darkAdapted: true,
  };
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// -------------------------------------------------------------
// Official Shadowdark RPG Monster Statistics Catalog (pgs. 194-266)
// -------------------------------------------------------------

function m(
  name: string,
  level: number,
  alignment: "Lawful" | "Neutral" | "Chaotic",
  ac: number,
  hp: number,
  movement: string,
  attacks: ShadowdarkMonsterAttack[],
  modifiers: ShadowdarkMonsterModifiers,
  features: string[] = [],
  opts: Partial<ShadowdarkMonsterDef> = {},
): ShadowdarkMonsterDef {
  return {
    id: slugify(name),
    name,
    level,
    alignment,
    ac,
    hp,
    movement,
    speed: movement.toLowerCase().includes("double") ? 12 : 6,
    attacks,
    modifiers,
    darkAdapted: opts.darkAdapted ?? true,
    spells: opts.spells,
    features,
    description: opts.description,
  };
}

export const SHADOWDARK_MONSTERS: ShadowdarkMonsterDef[] = [
  // A
  m("Aboleth", 8, "Chaotic", 16, 39, "Near (Swim)", [
    { name: "Tentacle", count: 2, bonus: 5, damage: "1d8", notes: "Slime" },
    { name: "Tail", count: 1, bonus: 5, damage: "2d6" },
  ], { str: 4, dex: 1, con: 3, int: 4, wis: 3, cha: 3 }, ["Telepathy", "Enslave", "Mucous Cloud"]),
  m("Acolyte", 1, "Lawful", 12, 4, "Near", [
    { name: "Mace", count: 1, bonus: 1, damage: "1d6" },
  ], { str: 1, dex: 0, con: 0, int: 0, wis: 2, cha: 1 }, ["Spellcasting"], { spells: ["Healing Touch", "Shield of Faith"], darkAdapted: false }),
  m("Archangel", 12, "Lawful", 18, 58, "Near (Fly)", [
    { name: "Greatsword", count: 2, bonus: 8, damage: "2d12+3", notes: "Radiant" },
  ], { str: 4, dex: 2, con: 4, int: 3, wis: 4, cha: 4 }, ["Immunity (Poison)", "Truesight", "Aura of Radiance"]),
  m("Domini", 8, "Lawful", 16, 38, "Near (Fly)", [
    { name: "Longsword", count: 2, bonus: 5, damage: "1d8+2" },
  ], { str: 3, dex: 2, con: 3, int: 2, wis: 3, cha: 3 }, ["Aura of Truth"]),
  m("Principi", 6, "Lawful", 15, 28, "Near (Fly)", [
    { name: "Mace", count: 2, bonus: 4, damage: "1d6+2" },
  ], { str: 2, dex: 2, con: 2, int: 2, wis: 2, cha: 2 }, ["Inspiring Aura"]),
  m("Seraph", 10, "Lawful", 17, 48, "Near (Fly)", [
    { name: "Spear", count: 2, bonus: 6, damage: "1d8+3" },
  ], { str: 3, dex: 3, con: 3, int: 3, wis: 4, cha: 4 }, ["Healing Light"]),
  m("Animated Armor", 3, "Neutral", 15, 14, "Near", [
    { name: "Slam", count: 2, bonus: 3, damage: "1d6" },
  ], { str: 2, dex: 0, con: 2, int: -4, wis: 0, cha: -4 }, ["Construct", "Blindvision"]),
  m("Ankheg", 3, "Neutral", 14, 15, "Near (Burrow)", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d8", notes: "Acid" },
  ], { str: 3, dex: 0, con: 2, int: -3, wis: 1, cha: -3 }, ["Acid Spray"]),
  m("Ape", 3, "Neutral", 12, 14, "Near (Climb)", [
    { name: "Fist", count: 2, bonus: 3, damage: "1d6+1" },
    { name: "Rock", count: 1, bonus: 3, damage: "1d6", range: "Far" },
  ], { str: 3, dex: 2, con: 2, int: -2, wis: 1, cha: -1 }, ["Dark-adapted"]),
  m("Snow Ape", 4, "Neutral", 13, 19, "Near (Climb)", [
    { name: "Fist", count: 2, bonus: 4, damage: "1d8+1" },
  ], { str: 3, dex: 2, con: 3, int: -2, wis: 1, cha: -1 }, ["Cold Immunity", "Snow Camouflage"]),
  m("Apprentice", 1, "Neutral", 10, 3, "Near", [
    { name: "Dagger", count: 1, bonus: 1, damage: "1d4" },
  ], { str: -1, dex: 1, con: 0, int: 2, wis: 1, cha: 0 }, ["Spellcasting"], { spells: ["Magic Missile", "Light"], darkAdapted: false }),
  m("Archmage", 9, "Neutral", 12, 40, "Near", [
    { name: "Staff", count: 1, bonus: 4, damage: "1d6" },
  ], { str: 0, dex: 2, con: 1, int: 5, wis: 3, cha: 2 }, ["Spellcasting Master"], { spells: ["Fireball", "Lightning Bolt", "Teleport", "Shield"], darkAdapted: false }),
  m("Assassin", 8, "Chaotic", 15, 36, "Near", [
    { name: "Poisoned Shortsword", count: 2, bonus: 5, damage: "1d6+2", notes: "Poison" },
    { name: "Light Crossbow", count: 1, bonus: 5, damage: "1d6+2", range: "Far" },
  ], { str: 1, dex: 4, con: 2, int: 2, wis: 1, cha: 1 }, ["Assassinate", "Sneak Attack", "Evasion"], { darkAdapted: false }),
  m("Azer", 2, "Lawful", 14, 10, "Near", [
    { name: "Warhammer", count: 1, bonus: 2, damage: "1d8", notes: "Fire" },
  ], { str: 2, dex: 1, con: 2, int: 1, wis: 1, cha: 0 }, ["Fire Immunity", "Heated Body"]),

  // B
  m("Badger", 0, "Neutral", 10, 2, "Near (Burrow)", [
    { name: "Bite", count: 1, bonus: 0, damage: "1d3" },
  ], { str: -1, dex: 1, con: 1, int: -4, wis: 1, cha: -3 }, ["Keen Smell"]),
  m("Bandit", 1, "Chaotic", 12, 4, "Near", [
    { name: "Shortsword", count: 1, bonus: 1, damage: "1d6" },
    { name: "Shortbow", count: 1, bonus: 1, damage: "1d4", range: "Far" },
  ], { str: 1, dex: 1, con: 1, int: 0, wis: 0, cha: 0 }, ["Pack Tactics"], { darkAdapted: false }),
  m("Basilisk", 5, "Neutral", 15, 23, "Near", [
    { name: "Bite", count: 1, bonus: 4, damage: "2d6" },
  ], { str: 3, dex: -1, con: 3, int: -4, wis: 1, cha: -2 }, ["Petrifying Gaze"]),
  m("Giant Bat", 2, "Neutral", 12, 9, "Near (Fly)", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 1, dex: 2, con: 1, int: -4, wis: 2, cha: -3 }, ["Echolocation"]),
  m("Bat Swarm", 2, "Neutral", 12, 8, "Near (Fly)", [
    { name: "Bites", count: 1, bonus: 2, damage: "2d4" },
  ], { str: -4, dex: 3, con: 0, int: -4, wis: 1, cha: -4 }, ["Swarm Resistance", "Blindsight"]),
  m("Brown Bear", 4, "Neutral", 12, 20, "Near", [
    { name: "Bite", count: 1, bonus: 4, damage: "1d8+1" },
    { name: "Claw", count: 1, bonus: 4, damage: "1d6+1" },
  ], { str: 4, dex: 1, con: 3, int: -4, wis: 1, cha: -2 }, ["Keen Smell"]),
  m("Polar Bear", 5, "Neutral", 12, 25, "Near (Swim)", [
    { name: "Bite", count: 1, bonus: 4, damage: "1d8+2" },
    { name: "Claw", count: 1, bonus: 4, damage: "1d6+2" },
  ], { str: 4, dex: 1, con: 3, int: -4, wis: 1, cha: -2 }, ["Cold Immunity"]),
  m("Beastman", 2, "Chaotic", 12, 9, "Near", [
    { name: "Spear", count: 1, bonus: 2, damage: "1d6+1" },
  ], { str: 2, dex: 1, con: 1, int: -1, wis: 1, cha: -1 }, ["Reckless Attack"]),
  m("Berserker", 3, "Chaotic", 13, 16, "Near", [
    { name: "Greataxe", count: 1, bonus: 3, damage: "1d10+2" },
  ], { str: 3, dex: 1, con: 3, int: -1, wis: 0, cha: 0 }, ["Berserk Rage"], { darkAdapted: false }),
  m("Black Pudding", 7, "Neutral", 8, 38, "Near (Climb)", [
    { name: "Pseudopod", count: 1, bonus: 5, damage: "2d8", notes: "Acid" },
  ], { str: 3, dex: -3, con: 4, int: -5, wis: -2, cha: -5 }, ["Corrosive Form", "Split", "Amorphous"]),
  m("Boar", 2, "Neutral", 11, 10, "Near", [
    { name: "Tusk", count: 1, bonus: 2, damage: "1d6+1" },
  ], { str: 2, dex: 0, con: 2, int: -4, wis: 0, cha: -3 }, ["Relentless (Survives 1 HP)"]),
  m("Brain Eater", 7, "Chaotic", 15, 33, "Near", [
    { name: "Tentacles", count: 1, bonus: 5, damage: "1d10", notes: "Grapple" },
    { name: "Extract Brain", count: 1, bonus: 5, damage: "3d10", notes: "Lethal" },
  ], { str: 1, dex: 2, con: 2, int: 4, wis: 3, cha: 3 }, ["Mind Blast", "Magic Resistance", "Telepathy"]),
  m("Bugbear", 3, "Chaotic", 13, 14, "Near", [
    { name: "Morningstar", count: 1, bonus: 3, damage: "1d8+1" },
    { name: "Javelin", count: 1, bonus: 3, damage: "1d6+1", range: "Far" },
  ], { str: 3, dex: 2, con: 2, int: -1, wis: 0, cha: -1 }, ["Surprise Attack", "Brute"]),
  m("Bulette", 6, "Neutral", 16, 32, "Near (Burrow)", [
    { name: "Bite", count: 1, bonus: 5, damage: "3d8" },
  ], { str: 4, dex: 0, con: 3, int: -4, wis: 1, cha: -3 }, ["Deadly Leap", "Tremorsense"]),

  // C
  m("Camel", 2, "Neutral", 10, 10, "Double near", [
    { name: "Bite", count: 1, bonus: 1, damage: "1d4" },
  ], { str: 3, dex: -1, con: 2, int: -4, wis: 0, cha: -3 }, ["Desert Adapted"], { darkAdapted: false }),
  m("Cave Brute", 4, "Chaotic", 13, 20, "Near", [
    { name: "Club", count: 2, bonus: 4, damage: "1d8+1" },
  ], { str: 3, dex: 1, con: 2, int: -2, wis: 0, cha: -2 }, ["Smash"]),
  m("Cave Creeper", 3, "Neutral", 13, 14, "Near (Climb)", [
    { name: "Tentacles", count: 1, bonus: 3, damage: "1d6", notes: "Paralysis" },
  ], { str: 2, dex: 2, con: 2, int: -4, wis: 1, cha: -3 }, ["Spider Climb", "Paralyzing Touch"]),
  m("Centaur", 4, "Neutral", 12, 19, "Double near", [
    { name: "Pike", count: 1, bonus: 3, damage: "1d10+1" },
    { name: "Hooves", count: 1, bonus: 3, damage: "1d6+1" },
  ], { str: 3, dex: 2, con: 2, int: 0, wis: 2, cha: 1 }, ["Trample"], { darkAdapted: false }),
  m("Giant Centipede", 1, "Neutral", 13, 4, "Near (Climb)", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d4", notes: "Poison" },
  ], { str: -2, dex: 2, con: 0, int: -5, wis: 0, cha: -4 }, ["Poison", "Blindvision"]),
  m("Centipede Swarm", 2, "Neutral", 12, 9, "Near (Climb)", [
    { name: "Bites", count: 1, bonus: 2, damage: "2d4", notes: "Poison" },
  ], { str: -4, dex: 2, con: 0, int: -5, wis: 0, cha: -4 }, ["Swarm Resistance"]),
  m("Chimera", 7, "Chaotic", 14, 35, "Near (Fly)", [
    { name: "Bite", count: 1, bonus: 5, damage: "1d8" },
    { name: "Horns", count: 1, bonus: 5, damage: "1d6" },
    { name: "Claws", count: 1, bonus: 5, damage: "1d6" },
  ], { str: 4, dex: 1, con: 3, int: -3, wis: 1, cha: 0 }, ["Fire Breath (Far, 3d6)"]),
  m("Chuul", 5, "Chaotic", 16, 26, "Near (Swim)", [
    { name: "Pincer", count: 2, bonus: 4, damage: "1d8+2", notes: "Grapple" },
    { name: "Tentacles", count: 1, bonus: 4, damage: "Paralysis" },
  ], { str: 4, dex: 0, con: 3, int: 0, wis: 2, cha: -2 }, ["Amphibious", "Sense Magic"]),
  m("Cloaker", 6, "Chaotic", 14, 30, "Near (Fly)", [
    { name: "Bite", count: 1, bonus: 4, damage: "1d8+1" },
    { name: "Tail", count: 1, bonus: 4, damage: "1d6+1" },
  ], { str: 3, dex: 2, con: 2, int: 1, wis: 1, cha: 1 }, ["Moan (Frighten)", "Phantasms", "Engulf"]),
  m("Cockatrice", 3, "Neutral", 12, 13, "Near (Fly)", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d4", notes: "Petrify" },
  ], { str: -2, dex: 2, con: 1, int: -4, wis: 1, cha: -2 }, ["Petrifying Touch"]),
  m("Couatl", 9, "Lawful", 17, 44, "Near (Fly)", [
    { name: "Bite", count: 1, bonus: 6, damage: "1d8", notes: "Poison" },
    { name: "Constrict", count: 1, bonus: 6, damage: "2d6+2" },
  ], { str: 3, dex: 3, con: 3, int: 3, wis: 4, cha: 3 }, ["Change Shape", "Telepathy", "Innate Spells"]),
  m("Giant Crab", 2, "Neutral", 15, 10, "Near (Swim)", [
    { name: "Claw", count: 2, bonus: 2, damage: "1d6", notes: "Grapple" },
  ], { str: 2, dex: 1, con: 2, int: -5, wis: 0, cha: -4 }, ["Amphibious"]),
  m("Crocodile", 3, "Neutral", 13, 15, "Near (Swim)", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d8+1", notes: "Hold" },
  ], { str: 3, dex: 0, con: 2, int: -4, wis: 0, cha: -3 }, ["Hold Breath", "Amphibious"]),
  m("Cultist", 1, "Chaotic", 11, 4, "Near", [
    { name: "Dagger", count: 1, bonus: 1, damage: "1d4" },
  ], { str: 0, dex: 1, con: 0, int: 0, wis: 1, cha: 1 }, ["Dark Devotion"], { darkAdapted: false }),
  m("Cyclops", 8, "Chaotic", 14, 42, "Near", [
    { name: "Greatclub", count: 2, bonus: 6, damage: "2d8+3" },
    { name: "Rock", count: 1, bonus: 6, damage: "2d6+3", range: "Far" },
  ], { str: 5, dex: 0, con: 4, int: -2, wis: -1, cha: 0 }, ["Poor Depth Perception"]),

  // D
  m("Darkmantle", 2, "Neutral", 12, 9, "Near (Fly)", [
    { name: "Crush", count: 1, bonus: 2, damage: "1d6", notes: "Attach" },
  ], { str: 2, dex: 1, con: 1, int: -4, wis: 0, cha: -3 }, ["Darkness Aura", "Echolocation"]),
  m("Deep One", 3, "Chaotic", 13, 14, "Near (Swim)", [
    { name: "Claws", count: 2, bonus: 3, damage: "1d6+1" },
  ], { str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: 0 }, ["Amphibious", "Ocean Senses"]),
  // Demons
  m("Balor", 13, "Chaotic", 17, 72, "Near (Fly)", [
    { name: "Longsword", count: 1, bonus: 8, damage: "2d10+3", notes: "Lightning" },
    { name: "Whip", count: 1, bonus: 8, damage: "1d8+3", notes: "Fire / Pull" },
  ], { str: 5, dex: 2, con: 5, int: 3, wis: 3, cha: 4 }, ["Fire Aura", "Death Throes (5d6 Fire explosion)", "Teleport"]),
  m("Dretch", 1, "Chaotic", 11, 4, "Near", [
    { name: "Claws", count: 2, bonus: 1, damage: "1d4" },
  ], { str: 1, dex: 0, con: 1, int: -3, wis: -1, cha: -3 }, ["Fetid Cloud"]),
  m("Glabrezu", 10, "Chaotic", 16, 52, "Near", [
    { name: "Pincer", count: 2, bonus: 6, damage: "2d8+2" },
    { name: "Fist", count: 2, bonus: 6, damage: "1d6+2" },
  ], { str: 4, dex: 1, con: 4, int: 3, wis: 2, cha: 2 }, ["Innate Spellcasting", "Deceptive"]),
  m("Marilith", 12, "Chaotic", 17, 65, "Double near", [
    { name: "Longsword", count: 6, bonus: 7, damage: "1d8+2" },
    { name: "Tail", count: 1, bonus: 7, damage: "2d6+2", notes: "Constrict" },
  ], { str: 4, dex: 4, con: 4, int: 3, wis: 3, cha: 3 }, ["Reactive (Parry every turn)", "Magic Resistance"]),
  m("Vrock", 7, "Chaotic", 14, 36, "Near (Fly)", [
    { name: "Beak", count: 1, bonus: 5, damage: "1d8+1" },
    { name: "Talons", count: 1, bonus: 5, damage: "2d6+1" },
  ], { str: 3, dex: 2, con: 3, int: -1, wis: 1, cha: -1 }, ["Spores", "Stunning Screech"]),
  // Devils
  m("Archdevil", 15, "Lawful", 19, 85, "Near (Fly)", [
    { name: "Hellfire Blade", count: 3, bonus: 9, damage: "2d10+4", notes: "Hellfire" },
  ], { str: 5, dex: 3, con: 5, int: 5, wis: 4, cha: 5 }, ["Hellfire Mastery", "Devil's Sight", "Immunity (Fire/Poison)"]),
  m("Barbed Devil", 6, "Lawful", 14, 29, "Near", [
    { name: "Claws", count: 2, bonus: 4, damage: "1d6+1" },
    { name: "Tail", count: 1, bonus: 4, damage: "1d8+1" },
  ], { str: 3, dex: 3, con: 3, int: 1, wis: 2, cha: 1 }, ["Barbed Body", "Hurl Flame (Far)"]),
  m("Cubi", 5, "Lawful", 14, 24, "Near (Fly)", [
    { name: "Claws", count: 1, bonus: 4, damage: "1d6" },
  ], { str: 0, dex: 3, con: 1, int: 2, wis: 2, cha: 4 }, ["Charm", "Draining Kiss", "Shapechanger"]),
  m("Erinyes", 9, "Lawful", 17, 46, "Near (Fly)", [
    { name: "Longsword", count: 2, bonus: 6, damage: "1d8+2", notes: "Poison" },
    { name: "Longbow", count: 2, bonus: 6, damage: "1d8+2", range: "Far", notes: "Poison" },
  ], { str: 3, dex: 3, con: 3, int: 2, wis: 2, cha: 3 }, ["Rope of Entanglement", "Magic Resistance"]),
  m("Horned Devil", 11, "Lawful", 17, 57, "Near (Fly)", [
    { name: "Fork", count: 2, bonus: 7, damage: "2d8+3" },
    { name: "Tail", count: 1, bonus: 7, damage: "1d8+3", notes: "Bleed" },
  ], { str: 4, dex: 3, con: 4, int: 2, wis: 3, cha: 3 }, ["Hurl Flame", "Infernal Wound"]),
  m("Imp", 2, "Lawful", 13, 8, "Near (Fly)", [
    { name: "Sting", count: 1, bonus: 2, damage: "1d4", notes: "Poison" },
  ], { str: -2, dex: 3, con: 1, int: 1, wis: 1, cha: 2 }, ["Invisibility", "Shapechanger", "Magic Resistance"]),
  // Dinosaurs
  m("Brachiosaurus", 10, "Neutral", 15, 60, "Near", [
    { name: "Stomp", count: 1, bonus: 7, damage: "3d10" },
    { name: "Tail", count: 1, bonus: 7, damage: "2d10" },
  ], { str: 5, dex: -1, con: 4, int: -4, wis: 0, cha: -3 }, ["Trample"]),
  m("Plesiosaurus", 5, "Neutral", 13, 26, "Near (Swim)", [
    { name: "Bite", count: 1, bonus: 4, damage: "2d6+1" },
  ], { str: 3, dex: 2, con: 2, int: -4, wis: 1, cha: -3 }, ["Hold Breath"]),
  m("Pterodactyl", 2, "Neutral", 12, 10, "Near (Fly)", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 1, dex: 2, con: 1, int: -4, wis: 0, cha: -3 }, ["Flyby Attack"]),
  m("Triceratops", 6, "Neutral", 14, 33, "Near", [
    { name: "Gore", count: 1, bonus: 5, damage: "2d8+2" },
    { name: "Stomp", count: 1, bonus: 5, damage: "1d10+2" },
  ], { str: 4, dex: -1, con: 3, int: -4, wis: 0, cha: -3 }, ["Trampling Charge"]),
  m("Tyrannosaurus", 9, "Neutral", 14, 50, "Double near", [
    { name: "Bite", count: 1, bonus: 6, damage: "3d10" },
    { name: "Tail", count: 1, bonus: 6, damage: "2d8" },
  ], { str: 5, dex: 1, con: 4, int: -4, wis: 1, cha: -2 }, ["Terrifying Roar", "Grapple"]),
  m("Velociraptor", 1, "Neutral", 12, 5, "Double near", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d4" },
    { name: "Claws", count: 1, bonus: 2, damage: "1d4" },
  ], { str: -1, dex: 2, con: 1, int: -3, wis: 1, cha: -2 }, ["Pack Tactics", "Pounce"]),

  m("Djinni", 9, "Chaotic", 16, 44, "Near (Fly)", [
    { name: "Scimitar", count: 2, bonus: 6, damage: "2d6+2" },
  ], { str: 4, dex: 3, con: 3, int: 2, wis: 3, cha: 3 }, ["Whirlwind", "Innate Magic"]),
  m("Doppelganger", 4, "Neutral", 13, 18, "Near", [
    { name: "Slam", count: 2, bonus: 3, damage: "1d6+1" },
  ], { str: 2, dex: 3, con: 2, int: 1, wis: 1, cha: 2 }, ["Shapechanger", "Read Thoughts", "Ambusher"]),

  // Dragons
  m("Desert Dragon", 12, "Chaotic", 17, 60, "Near (Fly/Burrow)", [
    { name: "Bite", count: 1, bonus: 7, damage: "2d10" },
    { name: "Claw", count: 2, bonus: 7, damage: "1d8" },
  ], { str: 5, dex: 1, con: 4, int: 2, wis: 2, cha: 3 }, ["Lightning Breath (Far, 4d8)"]),
  m("Fire Dragon", 14, "Chaotic", 18, 72, "Near (Fly)", [
    { name: "Bite", count: 1, bonus: 8, damage: "2d12+3" },
    { name: "Claw", count: 2, bonus: 8, damage: "1d10+3" },
  ], { str: 5, dex: 1, con: 5, int: 3, wis: 2, cha: 4 }, ["Fire Breath (Far, 5d8)", "Immunity (Fire)"]),
  m("Forest Dragon", 11, "Chaotic", 16, 55, "Near (Fly/Swim)", [
    { name: "Bite", count: 1, bonus: 6, damage: "2d8" },
    { name: "Claw", count: 2, bonus: 6, damage: "1d8" },
  ], { str: 4, dex: 2, con: 4, int: 3, wis: 2, cha: 3 }, ["Poison Breath (Far, 3d8)", "Immunity (Poison)"]),
  m("Frost Dragon", 13, "Chaotic", 17, 66, "Near (Fly/Burrow)", [
    { name: "Bite", count: 1, bonus: 7, damage: "2d10+2" },
    { name: "Claw", count: 2, bonus: 7, damage: "1d10+2" },
  ], { str: 5, dex: 1, con: 5, int: 1, wis: 1, cha: 2 }, ["Cold Breath (Far, 4d8)", "Immunity (Cold)"]),
  m("Sea Dragon", 12, "Chaotic", 17, 62, "Near (Fly/Swim)", [
    { name: "Bite", count: 1, bonus: 7, damage: "2d10" },
    { name: "Tail", count: 1, bonus: 7, damage: "2d8" },
  ], { str: 5, dex: 2, con: 4, int: 2, wis: 2, cha: 3 }, ["Steam Breath (Far, 4d8)", "Amphibious"]),
  m("Swamp Dragon", 10, "Chaotic", 16, 50, "Near (Fly/Swim)", [
    { name: "Bite", count: 1, bonus: 6, damage: "2d8" },
    { name: "Claw", count: 2, bonus: 6, damage: "1d6" },
  ], { str: 4, dex: 2, con: 4, int: 2, wis: 2, cha: 2 }, ["Acid Breath (Far, 3d8)", "Immunity (Acid)"]),

  // Drow
  m("Drow", 2, "Chaotic", 13, 9, "Near", [
    { name: "Shortsword", count: 1, bonus: 2, damage: "1d6", notes: "Poison" },
    { name: "Hand Crossbow", count: 1, bonus: 2, damage: "1d4", range: "Far", notes: "Sleep Poison" },
  ], { str: 0, dex: 2, con: 0, int: 1, wis: 1, cha: 1 }, ["Sunlight Sensitivity", "Darkvision"]),
  m("Drider", 7, "Chaotic", 15, 36, "Near (Climb)", [
    { name: "Longsword", count: 2, bonus: 5, damage: "1d8+1" },
    { name: "Bite", count: 1, bonus: 5, damage: "1d6", notes: "Poison" },
  ], { str: 3, dex: 3, con: 3, int: 2, wis: 2, cha: 1 }, ["Spider Climb", "Webs", "Innate Spells"]),
  m("Drow Priestess", 6, "Chaotic", 14, 28, "Near", [
    { name: "Scourge", count: 1, bonus: 4, damage: "1d6+1", notes: "Poison" },
  ], { str: 1, dex: 2, con: 1, int: 2, wis: 4, cha: 3 }, ["Priest Spells", "Summon Spiders"]),

  m("Druid", 4, "Neutral", 12, 18, "Near", [
    { name: "Staff", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 1, dex: 1, con: 1, int: 1, wis: 3, cha: 1 }, ["Spellcasting", "Wild Shape"], { darkAdapted: false }),
  m("Dryad", 3, "Neutral", 12, 13, "Near", [
    { name: "Vine Lash", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 0, dex: 2, con: 1, int: 2, wis: 2, cha: 3 }, ["Tree Stride", "Fey Charm"], { darkAdapted: false }),
  m("Duergar", 2, "Chaotic", 14, 11, "Near", [
    { name: "Warhammer", count: 1, bonus: 2, damage: "1d8+1" },
  ], { str: 2, dex: 0, con: 2, int: 1, wis: 1, cha: -1 }, ["Enlarge", "Invisibility", "Sunlight Sensitivity"]),
  m("Giant Dung Beetle", 2, "Neutral", 14, 10, "Near", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 2, dex: -1, con: 2, int: -5, wis: 0, cha: -4 }, ["Trampling Ball"]),

  // E
  m("Efreeti", 9, "Chaotic", 16, 45, "Near (Fly)", [
    { name: "Scimitar", count: 2, bonus: 6, damage: "2d6+2", notes: "Fire" },
  ], { str: 4, dex: 2, con: 3, int: 3, wis: 2, cha: 3 }, ["Hurl Flame", "Immunity (Fire)"]),
  // Elementals
  m("Lesser Air Elemental", 6, "Neutral", 14, 27, "Double near (Fly)", [
    { name: "Slam", count: 2, bonus: 4, damage: "1d8" },
  ], { str: 2, dex: 4, con: 2, int: -2, wis: 0, cha: -2 }, ["Whirlwind", "Elemental Resistance"]),
  m("Greater Air Elemental", 9, "Neutral", 16, 43, "Double near (Fly)", [
    { name: "Slam", count: 2, bonus: 6, damage: "2d8" },
  ], { str: 3, dex: 5, con: 3, int: -1, wis: 1, cha: -1 }, ["Whirlwind", "Elemental Resistance"]),
  m("Lesser Earth Elemental", 6, "Neutral", 16, 30, "Near (Burrow)", [
    { name: "Slam", count: 2, bonus: 4, damage: "1d10" },
  ], { str: 4, dex: -1, con: 4, int: -3, wis: 0, cha: -3 }, ["Earth Glide", "Siege Monster"]),
  m("Greater Earth Elemental", 9, "Neutral", 18, 48, "Near (Burrow)", [
    { name: "Slam", count: 2, bonus: 6, damage: "2d10" },
  ], { str: 5, dex: -1, con: 5, int: -2, wis: 1, cha: -2 }, ["Earth Glide", "Siege Monster"]),
  m("Lesser Fire Elemental", 6, "Neutral", 13, 26, "Near", [
    { name: "Touch", count: 2, bonus: 4, damage: "1d8", notes: "Fire" },
  ], { str: 2, dex: 3, con: 2, int: -2, wis: 0, cha: -2 }, ["Fire Form", "Ignite"]),
  m("Greater Fire Elemental", 9, "Neutral", 15, 42, "Near", [
    { name: "Touch", count: 2, bonus: 6, damage: "2d8", notes: "Fire" },
  ], { str: 3, dex: 4, con: 3, int: -1, wis: 1, cha: -1 }, ["Fire Form", "Ignite"]),
  m("Lesser Water Elemental", 6, "Neutral", 14, 29, "Near (Swim)", [
    { name: "Slam", count: 2, bonus: 4, damage: "1d8+1" },
  ], { str: 3, dex: 2, con: 3, int: -2, wis: 0, cha: -2 }, ["Whelm", "Amphibious"]),
  m("Greater Water Elemental", 9, "Neutral", 16, 45, "Near (Swim)", [
    { name: "Slam", count: 2, bonus: 6, damage: "2d8+2" },
  ], { str: 4, dex: 3, con: 4, int: -1, wis: 1, cha: -1 }, ["Whelm", "Amphibious"]),

  m("Elephant", 6, "Neutral", 12, 35, "Near", [
    { name: "Gore", count: 1, bonus: 5, damage: "2d8+2" },
    { name: "Stomp", count: 1, bonus: 5, damage: "1d10+2" },
  ], { str: 5, dex: -1, con: 3, int: -3, wis: 1, cha: -2 }, ["Trample"], { darkAdapted: false }),
  m("Elf", 1, "Neutral", 12, 5, "Near", [
    { name: "Longsword", count: 1, bonus: 1, damage: "1d8" },
    { name: "Longbow", count: 1, bonus: 2, damage: "1d8", range: "Far" },
  ], { str: 0, dex: 2, con: 0, int: 1, wis: 1, cha: 1 }, ["Farsight"], { darkAdapted: false }),
  m("Ettercap", 4, "Chaotic", 13, 19, "Near (Climb)", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d8", notes: "Poison" },
    { name: "Claws", count: 1, bonus: 3, damage: "1d6" },
  ], { str: 2, dex: 2, con: 2, int: -1, wis: 1, cha: -2 }, ["Web Garrote", "Spider Climb"]),

  // F
  m("Fairy", 1, "Chaotic", 13, 3, "Near (Fly)", [
    { name: "Tiny Dart", count: 1, bonus: 2, damage: "1", notes: "Sleep" },
  ], { str: -4, dex: 3, con: 0, int: 1, wis: 2, cha: 3 }, ["Invisibility", "Fey Magic"], { darkAdapted: false }),
  m("Giant Frog", 2, "Neutral", 11, 10, "Near (Swim)", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d6", notes: "Swallow" },
  ], { str: 1, dex: 2, con: 1, int: -5, wis: 0, cha: -4 }, ["Standing Leap", "Tongue Pull"]),

  // G
  m("Gargoyle", 4, "Chaotic", 15, 20, "Near (Fly)", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d6" },
    { name: "Claws", count: 1, bonus: 3, damage: "1d6" },
  ], { str: 3, dex: 1, con: 3, int: -2, wis: 0, cha: -2 }, ["False Appearance", "Damage Resistance"]),
  m("Gelatinous Cube", 4, "Neutral", 8, 24, "Near", [
    { name: "Pseudopod", count: 1, bonus: 3, damage: "2d6", notes: "Acid" },
  ], { str: 3, dex: -3, con: 4, int: -5, wis: -2, cha: -5 }, ["Transparent", "Engulf", "Paralysis"]),
  m("Ghast", 4, "Chaotic", 13, 18, "Near", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d8", notes: "Paralysis" },
    { name: "Claws", count: 1, bonus: 3, damage: "1d6", notes: "Paralysis" },
  ], { str: 2, dex: 2, con: 1, int: 0, wis: 1, cha: -1 }, ["Stench (DC 12 CON)", "Undead"]),
  m("Ghost", 6, "Chaotic", 12, 28, "Near (Fly)", [
    { name: "Withering Touch", count: 1, bonus: 4, damage: "2d8" },
  ], { str: -3, dex: 2, con: 1, int: 1, wis: 2, cha: 3 }, ["Incorporeal", "Possession", "Horrifying Visage", "Undead"]),
  m("Ghoul", 2, "Chaotic", 12, 9, "Near", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d6", notes: "Paralysis" },
    { name: "Claws", count: 1, bonus: 2, damage: "1d4", notes: "Paralysis" },
  ], { str: 1, dex: 2, con: 1, int: -2, wis: 0, cha: -2 }, ["Paralyzing Touch", "Undead"]),
  // Giants
  m("Cloud Giant", 11, "Neutral", 15, 58, "Near", [
    { name: "Morningstar", count: 2, bonus: 7, damage: "2d10+3" },
    { name: "Rock", count: 1, bonus: 7, damage: "2d12+3", range: "Far" },
  ], { str: 5, dex: 1, con: 4, int: 2, wis: 3, cha: 3 }, ["Keen Smell", "Fog Magic"]),
  m("Fire Giant", 10, "Chaotic", 17, 52, "Near", [
    { name: "Greatsword", count: 2, bonus: 7, damage: "2d10+3" },
    { name: "Rock", count: 1, bonus: 7, damage: "2d10+3", range: "Far", notes: "Fire" },
  ], { str: 5, dex: -1, con: 4, int: 1, wis: 2, cha: 1 }, ["Immunity (Fire)"]),
  m("Frost Giant", 9, "Chaotic", 15, 48, "Near", [
    { name: "Greataxe", count: 2, bonus: 6, damage: "2d10+3" },
    { name: "Rock", count: 1, bonus: 6, damage: "2d10+3", range: "Far" },
  ], { str: 5, dex: -1, con: 4, int: 0, wis: 2, cha: 1 }, ["Immunity (Cold)"]),
  m("Goat Giant", 7, "Chaotic", 14, 37, "Near", [
    { name: "Greatclub", count: 2, bonus: 5, damage: "1d12+2" },
    { name: "Horns", count: 1, bonus: 5, damage: "1d8+2" },
  ], { str: 4, dex: 0, con: 3, int: -2, wis: 1, cha: -1 }, ["Sure-Footed", "Charge"]),
  m("Hill Giant", 7, "Chaotic", 13, 36, "Near", [
    { name: "Greatclub", count: 2, bonus: 5, damage: "1d12+2" },
    { name: "Rock", count: 1, bonus: 5, damage: "2d8+2", range: "Far" },
  ], { str: 4, dex: -1, con: 3, int: -3, wis: -1, cha: -2 }, ["Brute"]),
  m("Stone Giant", 8, "Neutral", 16, 44, "Near", [
    { name: "Greatclub", count: 2, bonus: 6, damage: "2d8+3" },
    { name: "Rock", count: 1, bonus: 6, damage: "2d10+3", range: "Far" },
  ], { str: 5, dex: 2, con: 4, int: 0, wis: 2, cha: 0 }, ["Stone Camouflage", "Rock Catching"]),
  m("Storm Giant", 13, "Lawful", 16, 70, "Near (Swim)", [
    { name: "Greatsword", count: 2, bonus: 8, damage: "3d10+4" },
    { name: "Lightning Bolt", count: 1, bonus: 8, damage: "4d8", range: "Far" },
  ], { str: 5, dex: 2, con: 4, int: 3, wis: 3, cha: 4 }, ["Amphibious", "Immunity (Lightning/Thunder)"]),

  m("Gibbering Mouther", 4, "Chaotic", 9, 22, "Near", [
    { name: "Bites", count: 2, bonus: 3, damage: "1d6" },
  ], { str: 1, dex: -2, con: 3, int: -4, wis: 0, cha: -3 }, ["Gibbering (Confusion Aura)", "Aberrant"]),
  m("Gladiator", 5, "Neutral", 15, 26, "Near", [
    { name: "Spear", count: 2, bonus: 4, damage: "1d8+2" },
    { name: "Shield Bash", count: 1, bonus: 4, damage: "1d4+2" },
  ], { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 1 }, ["Brave", "Parry"], { darkAdapted: false }),
  m("Gnoll", 2, "Chaotic", 13, 10, "Near", [
    { name: "Spear", count: 1, bonus: 2, damage: "1d6+1" },
    { name: "Longbow", count: 1, bonus: 1, damage: "1d8", range: "Far" },
  ], { str: 2, dex: 1, con: 1, int: -2, wis: 0, cha: -1 }, ["Rampage (bonus attack on kill)"]),
  m("Deep Gnome", 2, "Neutral", 14, 9, "Near", [
    { name: "War Pick", count: 1, bonus: 2, damage: "1d8" },
  ], { str: 1, dex: 2, con: 1, int: 2, wis: 1, cha: -1 }, ["Stone Camouflage", "Gnome Magic"]),
  // Goblins
  m("Goblin", 1, "Chaotic", 13, 4, "Near", [
    { name: "Shortbow", count: 1, bonus: 2, damage: "1d4", range: "Far" },
    { name: "Dagger", count: 1, bonus: 2, damage: "1d4" },
  ], { str: -1, dex: 2, con: 0, int: -1, wis: 0, cha: -1 }, ["Nimble Escape"]),
  m("Goblin Boss", 2, "Chaotic", 14, 11, "Near", [
    { name: "Scimitar", count: 2, bonus: 3, damage: "1d6+1" },
  ], { str: 1, dex: 2, con: 1, int: 0, wis: 0, cha: 1 }, ["Redirect Attack"]),
  m("Goblin Shaman", 2, "Chaotic", 12, 8, "Near", [
    { name: "Staff", count: 1, bonus: 1, damage: "1d4" },
  ], { str: -1, dex: 1, con: 0, int: 1, wis: 2, cha: 0 }, ["Spellcasting"], { spells: ["Magic Missile", "Goblin Hex"] }),
  // Golems
  m("Clay Golem", 9, "Neutral", 14, 48, "Near", [
    { name: "Slam", count: 2, bonus: 6, damage: "2d10+1", notes: "Cursed Wound" },
  ], { str: 4, dex: -1, con: 4, int: -4, wis: 0, cha: -5 }, ["Haste", "Acid Absorption", "Construct"]),
  m("Flesh Golem", 5, "Neutral", 11, 28, "Near", [
    { name: "Slam", count: 2, bonus: 4, damage: "1d8+2" },
  ], { str: 4, dex: -1, con: 3, int: -3, wis: 0, cha: -3 }, ["Lightning Absorption", "Berserk", "Construct"]),
  m("Iron Golem", 13, "Neutral", 18, 70, "Near", [
    { name: "Slam", count: 2, bonus: 8, damage: "2d10+3" },
    { name: "Sword", count: 1, bonus: 8, damage: "3d10+3" },
  ], { str: 5, dex: -1, con: 5, int: -4, wis: 0, cha: -5 }, ["Poison Breath", "Fire Absorption", "Construct"]),
  m("Stone Golem", 10, "Neutral", 17, 54, "Near", [
    { name: "Slam", count: 2, bonus: 7, damage: "2d10+2" },
  ], { str: 5, dex: -1, con: 4, int: -4, wis: 0, cha: -5 }, ["Slow", "Construct"]),

  m("Gorgon", 5, "Neutral", 16, 28, "Near", [
    { name: "Gore", count: 1, bonus: 4, damage: "2d6+2" },
    { name: "Hooves", count: 1, bonus: 4, damage: "1d8+2" },
  ], { str: 4, dex: 0, con: 4, int: -4, wis: 1, cha: -2 }, ["Petrifying Breath", "Trampling Charge"]),
  m("Gorilla", 3, "Neutral", 12, 16, "Near (Climb)", [
    { name: "Fist", count: 2, bonus: 3, damage: "1d6+2" },
  ], { str: 3, dex: 2, con: 2, int: -2, wis: 1, cha: -1 }, ["Dark-adapted"]),
  m("Gray Ooze", 2, "Neutral", 8, 12, "Near", [
    { name: "Pseudopod", count: 1, bonus: 2, damage: "1d6", notes: "Acid" },
  ], { str: 2, dex: -2, con: 2, int: -5, wis: -2, cha: -5 }, ["Corrosive Form", "False Appearance", "Amorphous"]),
  m("Grick", 2, "Neutral", 13, 11, "Near (Climb)", [
    { name: "Tentacles", count: 1, bonus: 3, damage: "1d6" },
    { name: "Beak", count: 1, bonus: 3, damage: "1d6" },
  ], { str: 2, dex: 2, con: 2, int: -4, wis: 1, cha: -3 }, ["Stone Camouflage", "Damage Resistance"]),
  m("Griffon", 4, "Neutral", 12, 22, "Near (Fly)", [
    { name: "Beak", count: 1, bonus: 4, damage: "1d8+1" },
    { name: "Claws", count: 1, bonus: 4, damage: "2d6+1" },
  ], { str: 4, dex: 2, con: 2, int: -4, wis: 1, cha: -1 }, ["Keen Sight"]),
  m("Grimlow", 3, "Chaotic", 13, 15, "Near", [
    { name: "Claws", count: 2, bonus: 3, damage: "1d6+1" },
  ], { str: 2, dex: 2, con: 2, int: -1, wis: 1, cha: -1 }, ["Shadow Melder"]),
  m("Guard", 1, "Lawful", 14, 5, "Near", [
    { name: "Spear", count: 1, bonus: 1, damage: "1d6" },
  ], { str: 1, dex: 1, con: 1, int: 0, wis: 0, cha: 0 }, ["Phalanx"], { darkAdapted: false }),

  // H
  m("Night Hag", 7, "Chaotic", 15, 34, "Near", [
    { name: "Claws", count: 2, bonus: 5, damage: "1d8+2" },
  ], { str: 3, dex: 2, con: 3, int: 3, wis: 2, cha: 3 }, ["Nightmare Haunting", "Innate Magic", "Etherealness"]),
  m("Sea Hag", 4, "Chaotic", 13, 20, "Near (Swim)", [
    { name: "Claws", count: 2, bonus: 3, damage: "1d6+1" },
  ], { str: 3, dex: 1, con: 2, int: 1, wis: 1, cha: 1 }, ["Death Glare", "Amphibious"]),
  m("Weald Hag", 5, "Chaotic", 14, 25, "Near", [
    { name: "Claws", count: 2, bonus: 4, damage: "1d6+2" },
  ], { str: 3, dex: 2, con: 2, int: 2, wis: 2, cha: 2 }, ["Bramble Warp", "Illusion"]),

  m("Harpy", 3, "Chaotic", 11, 14, "Near (Fly)", [
    { name: "Claws", count: 2, bonus: 2, damage: "1d4" },
  ], { str: 1, dex: 2, con: 1, int: -2, wis: 0, cha: 2 }, ["Luring Song"]),
  m("Hell Hound", 3, "Chaotic", 13, 16, "Near", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d8", notes: "Fire" },
  ], { str: 3, dex: 1, con: 2, int: -2, wis: 1, cha: -2 }, ["Fire Breath (Near, 2d6)", "Immunity (Fire)"]),
  m("Hippogriff", 3, "Neutral", 11, 15, "Near (Fly)", [
    { name: "Beak", count: 1, bonus: 3, damage: "1d6" },
    { name: "Claws", count: 1, bonus: 3, damage: "1d6" },
  ], { str: 3, dex: 1, con: 2, int: -4, wis: 1, cha: -1 }, ["Keen Sight"]),
  m("Hippopotamus", 5, "Neutral", 12, 28, "Near (Swim)", [
    { name: "Bite", count: 1, bonus: 4, damage: "2d8+2" },
  ], { str: 4, dex: -1, con: 3, int: -4, wis: 0, cha: -3 }, ["Hold Breath"], { darkAdapted: false }),
  m("Hobgoblin", 2, "Lawful", 15, 11, "Near", [
    { name: "Longsword", count: 1, bonus: 2, damage: "1d8+1" },
    { name: "Longbow", count: 1, bonus: 2, damage: "1d8", range: "Far" },
  ], { str: 2, dex: 1, con: 1, int: 1, wis: 0, cha: 0 }, ["Martial Advantage (+1d6 damage)"]),
  m("Horse", 2, "Neutral", 10, 11, "Double near", [
    { name: "Hooves", count: 1, bonus: 2, damage: "1d6+1" },
  ], { str: 3, dex: 0, con: 2, int: -4, wis: 0, cha: -2 }, ["Fast Mount"], { darkAdapted: false }),
  m("Hydra", 8, "Neutral", 15, 45, "Near (Swim)", [
    { name: "Bite", count: 5, bonus: 5, damage: "1d8" },
  ], { str: 4, dex: 1, con: 4, int: -4, wis: 0, cha: -2 }, ["Multiple Heads", "Regrow Heads", "Reactive"]),

  // I & J
  m("Invisible Stalker", 6, "Neutral", 14, 28, "Double near (Fly)", [
    { name: "Slam", count: 2, bonus: 5, damage: "1d8+2" },
  ], { str: 3, dex: 4, con: 2, int: 0, wis: 2, cha: 0 }, ["Invisibility (Permanent)", "Tracker"]),
  m("Jellyfish", 1, "Neutral", 10, 4, "Near (Swim)", [
    { name: "Tentacles", count: 1, bonus: 1, damage: "1d4", notes: "Poison" },
  ], { str: -4, dex: 0, con: 0, int: -5, wis: -2, cha: -5 }, ["Amorphous", "Sting"]),

  // K
  m("Knight", 4, "Lawful", 16, 20, "Near", [
    { name: "Greatsword", count: 2, bonus: 4, damage: "1d10+1" },
    { name: "Lance", count: 1, bonus: 4, damage: "1d12+1" },
  ], { str: 3, dex: 0, con: 2, int: 1, wis: 1, cha: 2 }, ["Brave", "Parry"], { darkAdapted: false }),
  m("Kobold", 1, "Chaotic", 12, 3, "Near", [
    { name: "Dagger", count: 1, bonus: 1, damage: "1d4" },
    { name: "Sling", count: 1, bonus: 2, damage: "1d4", range: "Far" },
  ], { str: -2, dex: 2, con: -1, int: -1, wis: -1, cha: -1 }, ["Pack Tactics", "Sunlight Sensitivity"]),
  m("Kobold Sorcerer", 2, "Chaotic", 12, 6, "Near", [
    { name: "Dagger", count: 1, bonus: 1, damage: "1d4" },
  ], { str: -2, dex: 2, con: 0, int: 0, wis: 0, cha: 2 }, ["Draconic Magic"], { spells: ["Burning Hands", "Magic Missile"] }),
  m("Kraken", 16, "Chaotic", 18, 95, "Near (Swim)", [
    { name: "Tentacle", count: 4, bonus: 9, damage: "3d8+4", notes: "Grapple" },
    { name: "Bite", count: 1, bonus: 9, damage: "4d10+4" },
  ], { str: 6, dex: 1, con: 5, int: 4, wis: 3, cha: 4 }, ["Ink Cloud", "Lightning Storm", "Freedom of Movement"]),

  // L
  m("Giant Leech", 2, "Neutral", 11, 9, "Near (Swim)", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d4", notes: "Attach & Drain" },
  ], { str: 1, dex: 0, con: 1, int: -5, wis: -2, cha: -5 }, ["Blood Drain"]),
  m("Leprechaun", 2, "Neutral", 13, 7, "Near", [
    { name: "Shillelagh", count: 1, bonus: 2, damage: "1d6" },
  ], { str: -1, dex: 3, con: 0, int: 2, wis: 1, cha: 2 }, ["Invisibility", "Luck", "Gold Sense"], { darkAdapted: false }),
  m("Lich", 11, "Chaotic", 16, 52, "Near", [
    { name: "Paralyzing Touch", count: 1, bonus: 6, damage: "2d6", notes: "Paralysis" },
  ], { str: 0, dex: 2, con: 3, int: 5, wis: 3, cha: 3 }, ["Paralyzing Aura", "Rejuvenation (Phylactery)", "Undead", "Spells"], { spells: ["Power Word Kill", "Finger of Death", "Disintegrate", "Chain Lightning", "Shield"] }),
  m("Lion", 3, "Neutral", 12, 15, "Double near", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d8+1" },
    { name: "Claw", count: 1, bonus: 3, damage: "1d6+1" },
  ], { str: 3, dex: 2, con: 2, int: -4, wis: 1, cha: -1 }, ["Pack Tactics", "Pounce"]),
  m("Lizardfolk", 2, "Neutral", 13, 11, "Near (Swim)", [
    { name: "Heavy Club", count: 1, bonus: 2, damage: "1d6+1" },
    { name: "Spiked Shield", count: 1, bonus: 2, damage: "1d4+1" },
  ], { str: 2, dex: 1, con: 2, int: -1, wis: 1, cha: -2 }, ["Hold Breath"]),

  // M
  m("Mage", 6, "Neutral", 12, 24, "Near", [
    { name: "Staff", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 0, dex: 2, con: 1, int: 4, wis: 2, cha: 1 }, ["Spellcasting"], { spells: ["Fireball", "Lightning Bolt", "Invisibility", "Mage Armor"], darkAdapted: false }),
  m("Mammoth", 8, "Neutral", 13, 48, "Near", [
    { name: "Gore", count: 1, bonus: 6, damage: "3d8+3" },
    { name: "Stomp", count: 1, bonus: 6, damage: "2d10+3" },
  ], { str: 5, dex: -1, con: 4, int: -4, wis: 1, cha: -3 }, ["Trampling Charge", "Cold Resistance"]),
  m("Giant Manta Ray", 4, "Neutral", 13, 22, "Near (Swim)", [
    { name: "Tail Spine", count: 1, bonus: 3, damage: "1d8+1", notes: "Poison" },
  ], { str: 3, dex: 2, con: 2, int: -4, wis: 0, cha: -4 }, ["Underwater Camouflage"]),
  m("Manticore", 5, "Chaotic", 14, 27, "Near (Fly)", [
    { name: "Bite", count: 1, bonus: 4, damage: "1d8+1" },
    { name: "Claws", count: 2, bonus: 4, damage: "1d6+1" },
    { name: "Tail Spikes", count: 3, bonus: 4, damage: "1d6", range: "Far" },
  ], { str: 3, dex: 2, con: 3, int: -2, wis: 1, cha: -1 }, ["Spike Volley"]),
  m("Mastiff", 1, "Neutral", 12, 5, "Double near", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d6", notes: "Knockdown" },
  ], { str: 1, dex: 2, con: 1, int: -4, wis: 1, cha: -2 }, ["Keen Smell"]),
  m("Medusa", 6, "Chaotic", 14, 30, "Near", [
    { name: "Shortsword", count: 1, bonus: 4, damage: "1d6+1" },
    { name: "Snake Hair", count: 1, bonus: 4, damage: "1d4", notes: "Poison" },
    { name: "Shortbow", count: 1, bonus: 4, damage: "1d6+1", range: "Far", notes: "Poison" },
  ], { str: 1, dex: 3, con: 2, int: 1, wis: 1, cha: 2 }, ["Petrifying Gaze"]),
  m("Merfolk", 1, "Neutral", 11, 5, "Near (Swim)", [
    { name: "Spear", count: 1, bonus: 1, damage: "1d6" },
  ], { str: 1, dex: 1, con: 1, int: 0, wis: 1, cha: 1 }, ["Amphibious"]),
  m("Mimic", 4, "Neutral", 12, 22, "Near", [
    { name: "Pseudopod", count: 1, bonus: 3, damage: "1d8+1", notes: "Adhesive" },
    { name: "Bite", count: 1, bonus: 3, damage: "2d6+1" },
  ], { str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: -1 }, ["False Appearance", "Adhesive"]),
  m("Minotaur", 4, "Chaotic", 13, 24, "Near", [
    { name: "Greataxe", count: 1, bonus: 4, damage: "1d12+2" },
    { name: "Gore", count: 1, bonus: 4, damage: "1d8+2" },
  ], { str: 4, dex: 0, con: 3, int: -2, wis: 2, cha: -1 }, ["Charge", "Labyrinthine Recall"]),
  m("Moose", 3, "Neutral", 11, 16, "Double near", [
    { name: "Antlers", count: 1, bonus: 3, damage: "1d8+2" },
    { name: "Hooves", count: 1, bonus: 3, damage: "1d6+2" },
  ], { str: 4, dex: 0, con: 2, int: -4, wis: 1, cha: -3 }, ["Charge"], { darkAdapted: false }),
  m("Mordanticus the Flayed", 12, "Chaotic", 17, 62, "Near", [
    { name: "Flayed Touch", count: 2, bonus: 7, damage: "2d8+3", notes: "Necrotic" },
  ], { str: 2, dex: 3, con: 4, int: 5, wis: 3, cha: 4 }, ["Legendary", "Spellcasting Master", "Skin Thief"]),
  m("Mummy", 6, "Chaotic", 13, 33, "Near", [
    { name: "Rotting Fist", count: 1, bonus: 4, damage: "2d6+2", notes: "Mummy Rot" },
  ], { str: 3, dex: -1, con: 3, int: -2, wis: 1, cha: 0 }, ["Dreadful Glare", "Mummy Rot", "Vulnerable to Fire", "Undead"]),
  m("Mushroomfolk", 2, "Neutral", 12, 10, "Near", [
    { name: "Fist", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 1, dex: 0, con: 2, int: 0, wis: 2, cha: -1 }, ["Spore Cloud", "Telepathy"]),

  // N & O
  m("Naga", 8, "Neutral", 15, 42, "Near", [
    { name: "Bite", count: 1, bonus: 5, damage: "1d8", notes: "Poison" },
    { name: "Constrict", count: 1, bonus: 5, damage: "2d6+2" },
  ], { str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 }, ["Rejuvenation", "Spellcasting"]),
  m("Bone Naga", 6, "Chaotic", 14, 32, "Near", [
    { name: "Bite", count: 1, bonus: 4, damage: "1d8", notes: "Cold" },
  ], { str: 2, dex: 3, con: 2, int: 2, wis: 2, cha: 1 }, ["Spellcasting", "Undead"]),
  m("Nightmare", 6, "Chaotic", 13, 30, "Double near (Fly)", [
    { name: "Hooves", count: 2, bonus: 4, damage: "1d8+2", notes: "Fire" },
  ], { str: 4, dex: 2, con: 3, int: 0, wis: 1, cha: 2 }, ["Confer Fire Resistance", "Ethereal Stride"]),
  m("Obe-Ixx of Azarumme", 14, "Chaotic", 18, 75, "Near (Fly)", [
    { name: "Void Claw", count: 2, bonus: 8, damage: "2d10+4" },
    { name: "Gaze", count: 1, bonus: 8, damage: "3d8", range: "Far" },
  ], { str: 5, dex: 3, con: 4, int: 4, wis: 4, cha: 4 }, ["Legendary", "Chaos Aura", "Reality Warp"]),
  m("Ochre Jelly", 4, "Neutral", 8, 26, "Near (Climb)", [
    { name: "Pseudopod", count: 1, bonus: 3, damage: "2d6", notes: "Acid" },
  ], { str: 2, dex: -2, con: 3, int: -5, wis: -2, cha: -5 }, ["Amorphous", "Corrosive", "Split"]),
  m("Giant Octopus", 5, "Neutral", 12, 28, "Near (Swim)", [
    { name: "Tentacles", count: 1, bonus: 4, damage: "2d6+1", notes: "Grapple" },
  ], { str: 3, dex: 2, con: 2, int: -4, wis: 0, cha: -4 }, ["Ink Cloud", "Water Breathing"]),
  m("Ogre", 4, "Chaotic", 11, 25, "Near", [
    { name: "Greatclub", count: 1, bonus: 4, damage: "1d10+3" },
    { name: "Javelin", count: 1, bonus: 4, damage: "1d8+3", range: "Far" },
  ], { str: 4, dex: -1, con: 3, int: -3, wis: -2, cha: -2 }, ["Brute"]),
  m("Oni", 8, "Chaotic", 15, 42, "Near (Fly)", [
    { name: "Glaive", count: 2, bonus: 6, damage: "1d10+3" },
  ], { str: 4, dex: 1, con: 3, int: 2, wis: 2, cha: 3 }, ["Change Shape", "Innate Magic", "Regeneration"]),
  m("Orc", 2, "Chaotic", 13, 9, "Near", [
    { name: "Greataxe", count: 1, bonus: 2, damage: "1d8+1" },
    { name: "Javelin", count: 1, bonus: 2, damage: "1d6+1", range: "Far" },
  ], { str: 3, dex: 0, con: 2, int: -1, wis: 0, cha: -1 }, ["Aggressive (Bonus move toward enemy)"]),
  m("Orc Chieftain", 4, "Chaotic", 15, 22, "Near", [
    { name: "Greataxe", count: 2, bonus: 4, damage: "1d8+2" },
  ], { str: 4, dex: 1, con: 3, int: 0, wis: 1, cha: 1 }, ["Battle Cry", "Aggressive"]),
  m("Otyugh", 5, "Neutral", 14, 30, "Near", [
    { name: "Bite", count: 1, bonus: 4, damage: "1d8", notes: "Filth Fever" },
    { name: "Tentacle", count: 2, bonus: 4, damage: "1d6+2", notes: "Grapple" },
  ], { str: 3, dex: 0, con: 3, int: -2, wis: 1, cha: -3 }, ["Limited Telepathy", "Filth Fever"]),

  // Outsiders
  m("Primordial Slime", 6, "Chaotic", 10, 34, "Near (Climb)", [
    { name: "Slime Touch", count: 2, bonus: 4, damage: "2d6", notes: "Dissolve" },
  ], { str: 3, dex: -2, con: 4, int: -4, wis: -1, cha: -4 }, ["Amorphous", "Acidic Skin"]),
  m("Rime Walker", 8, "Chaotic", 15, 42, "Near", [
    { name: "Ice Spear", count: 2, bonus: 5, damage: "1d10+2", notes: "Cold" },
  ], { str: 4, dex: 1, con: 3, int: 0, wis: 2, cha: 1 }, ["Freezing Aura", "Immunity (Cold)"]),
  m("Void Spawn", 5, "Chaotic", 13, 24, "Near (Fly)", [
    { name: "Void Claw", count: 2, bonus: 4, damage: "1d8" },
  ], { str: 2, dex: 3, con: 2, int: 1, wis: 1, cha: 0 }, ["Phase Shift", "Alien Mind"]),
  m("Void Spider", 6, "Chaotic", 14, 28, "Near (Climb)", [
    { name: "Bite", count: 1, bonus: 4, damage: "2d6", notes: "Void Venom" },
  ], { str: 3, dex: 3, con: 2, int: -1, wis: 1, cha: -2 }, ["Dimension Door", "Webs"]),

  m("Owlbear", 5, "Neutral", 13, 29, "Near", [
    { name: "Beak", count: 1, bonus: 4, damage: "1d10+2" },
    { name: "Claws", count: 1, bonus: 4, damage: "1d8+2" },
  ], { str: 4, dex: 1, con: 3, int: -4, wis: 1, cha: -2 }, ["Keen Sight and Smell", "Bear Hug"]),

  // P & Q
  m("Panther", 2, "Neutral", 12, 10, "Double near (Climb)", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d6+1" },
    { name: "Claw", count: 1, bonus: 2, damage: "1d4+1" },
  ], { str: 2, dex: 3, con: 1, int: -4, wis: 2, cha: -2 }, ["Pounce", "Stealthy"]),
  m("Peasant", 0, "Neutral", 10, 1, "Near", [
    { name: "Club", count: 1, bonus: 0, damage: "1d4" },
  ], { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, [], { darkAdapted: false }),
  m("Pegasus", 6, "Lawful", 12, 30, "Double near (Fly)", [
    { name: "Hooves", count: 2, bonus: 4, damage: "1d8+2" },
  ], { str: 4, dex: 2, con: 3, int: 0, wis: 2, cha: 2 }, ["Celestial Steed"], { darkAdapted: false }),
  m("Phoenix", 12, "Neutral", 17, 65, "Double near (Fly)", [
    { name: "Beak", count: 1, bonus: 7, damage: "2d8+3", notes: "Fire" },
    { name: "Talons", count: 2, bonus: 7, damage: "1d10+3", notes: "Fire" },
  ], { str: 4, dex: 4, con: 4, int: 2, wis: 3, cha: 3 }, ["Rebirth (Explodes and rises)", "Fire Aura", "Immunity (Fire)"]),
  m("Piranha Swarm", 2, "Neutral", 12, 9, "Near (Swim)", [
    { name: "Bites", count: 1, bonus: 2, damage: "2d4" },
  ], { str: -4, dex: 2, con: 0, int: -5, wis: 0, cha: -4 }, ["Blood Frenzy", "Swarm"]),
  m("Pirate", 1, "Chaotic", 12, 5, "Near", [
    { name: "Cutlass", count: 1, bonus: 1, damage: "1d6" },
  ], { str: 1, dex: 1, con: 1, int: 0, wis: 0, cha: 0 }, ["Sea Legs"], { darkAdapted: false }),
  m("Priest", 4, "Lawful", 14, 18, "Near", [
    { name: "Mace", count: 1, bonus: 2, damage: "1d6+1" },
  ], { str: 1, dex: 0, con: 1, int: 1, wis: 3, cha: 2 }, ["Spellcasting", "Turn Undead"], { spells: ["Cure Wounds", "Bless", "Hold Person"], darkAdapted: false }),
  m("Purple Worm", 15, "Neutral", 18, 85, "Near (Burrow)", [
    { name: "Bite", count: 1, bonus: 9, damage: "3d10+4", notes: "Swallow" },
    { name: "Tail Stinger", count: 1, bonus: 9, damage: "2d8+4", notes: "Poison" },
  ], { str: 6, dex: -1, con: 5, int: -5, wis: 0, cha: -4 }, ["Tunneler", "Tremorsense", "Swallow Whole"]),

  // R
  m("Rakshasa", 8, "Chaotic", 16, 40, "Near", [
    { name: "Claw", count: 2, bonus: 5, damage: "1d6+1", notes: "Curse" },
  ], { str: 2, dex: 3, con: 3, int: 3, wis: 3, cha: 4 }, ["Limited Magic Immunity", "Shapechanger", "Innate Magic"]),
  m("Rat", 0, "Neutral", 10, 1, "Near", [
    { name: "Bite", count: 1, bonus: 0, damage: "1" },
  ], { str: -4, dex: 2, con: 0, int: -4, wis: 0, cha: -4 }, ["Keen Smell"]),
  m("Dire Rat", 1, "Neutral", 11, 4, "Near", [
    { name: "Bite", count: 1, bonus: 1, damage: "1d4", notes: "Disease" },
  ], { str: -1, dex: 2, con: 1, int: -4, wis: 0, cha: -4 }, ["Filth Fever", "Pack Tactics"]),
  m("Giant Rat", 1, "Neutral", 12, 3, "Near", [
    { name: "Bite", count: 1, bonus: 1, damage: "1d4" },
  ], { str: -2, dex: 2, con: 0, int: -4, wis: 0, cha: -4 }, ["Pack Tactics"]),
  m("Rat Swarm", 2, "Neutral", 10, 8, "Near", [
    { name: "Bites", count: 1, bonus: 2, damage: "2d4" },
  ], { str: -4, dex: 2, con: 0, int: -4, wis: 0, cha: -4 }, ["Swarm Resistance"]),
  m("Rathgamnon", 10, "Chaotic", 16, 50, "Near", [
    { name: "Blight Staff", count: 2, bonus: 6, damage: "1d8+2" },
  ], { str: 2, dex: 2, con: 3, int: 4, wis: 4, cha: 3 }, ["Warlock Master", "Undead Minions", "Death Magic"]),
  m("Reaver", 3, "Chaotic", 13, 15, "Near", [
    { name: "Greataxe", count: 1, bonus: 3, damage: "1d10+1" },
  ], { str: 3, dex: 1, con: 2, int: -1, wis: 0, cha: 0 }, ["Bloodlust", "Raid"]),
  m("Remorhaz", 11, "Neutral", 17, 56, "Near (Burrow)", [
    { name: "Bite", count: 1, bonus: 7, damage: "3d10", notes: "Swallow" },
  ], { str: 5, dex: 1, con: 4, int: -4, wis: 0, cha: -3 }, ["Heated Body", "Swallow Whole", "Immunity (Cold/Fire)"]),
  m("Rhino", 4, "Neutral", 11, 22, "Near", [
    { name: "Gore", count: 1, bonus: 4, damage: "2d8+2" },
  ], { str: 4, dex: -1, con: 3, int: -4, wis: 1, cha: -3 }, ["Charge"], { darkAdapted: false }),
  m("Roc", 11, "Neutral", 15, 60, "Double near (Fly)", [
    { name: "Beak", count: 1, bonus: 7, damage: "2d10+3" },
    { name: "Talons", count: 2, bonus: 7, damage: "2d6+3", notes: "Grapple" },
  ], { str: 5, dex: 2, con: 4, int: -4, wis: 2, cha: 0 }, ["Keen Sight"]),
  m("Roper", 5, "Chaotic", 17, 27, "Near (Climb)", [
    { name: "Bite", count: 1, bonus: 4, damage: "2d8" },
    { name: "Tendril", count: 4, bonus: 4, damage: "Pull", range: "Far" },
  ], { str: 4, dex: -1, con: 3, int: -2, wis: 3, cha: -2 }, ["False Appearance", "Grasping Tendrils"]),
  m("Rust Monster", 3, "Neutral", 14, 15, "Near (Climb)", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d6" },
    { name: "Antennae", count: 1, bonus: 3, damage: "Rust", notes: "Destroys metal" },
  ], { str: 1, dex: 2, con: 1, int: -4, wis: 1, cha: -2 }, ["Rust Metal", "Iron Scent"]),

  // S
  m("Sahuagin", 2, "Chaotic", 12, 10, "Near (Swim)", [
    { name: "Spear", count: 1, bonus: 2, damage: "1d6+1" },
    { name: "Bite", count: 1, bonus: 2, damage: "1d4+1" },
  ], { str: 2, dex: 1, con: 1, int: 1, wis: 1, cha: -1 }, ["Blood Frenzy", "Shark Telepathy", "Amphibious"]),
  m("Salamander", 5, "Chaotic", 15, 26, "Near", [
    { name: "Spear", count: 1, bonus: 4, damage: "1d8+1", notes: "Fire" },
    { name: "Tail", count: 1, bonus: 4, damage: "1d8+1", notes: "Constrict" },
  ], { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 1 }, ["Heated Body", "Immunity (Fire)"]),
  m("Scarab Swarm", 2, "Neutral", 13, 8, "Near (Burrow)", [
    { name: "Bites", count: 1, bonus: 2, damage: "2d4" },
  ], { str: -4, dex: 2, con: 0, int: -5, wis: 0, cha: -4 }, ["Swarm Resistance", "Armor Strip"]),
  m("Giant Scorpion", 3, "Neutral", 14, 16, "Near", [
    { name: "Claw", count: 2, bonus: 3, damage: "1d6+1", notes: "Grapple" },
    { name: "Sting", count: 1, bonus: 3, damage: "1d8+1", notes: "Poison" },
  ], { str: 3, dex: 1, con: 2, int: -5, wis: -1, cha: -4 }, ["Venomous Sting"]),
  m("Shadow", 3, "Chaotic", 12, 12, "Near", [
    { name: "Strength Drain", count: 1, bonus: 3, damage: "1d6", notes: "Drain 1d4 STR" },
  ], { str: -2, dex: 3, con: 1, int: -2, wis: 0, cha: -1 }, ["Amorphous", "Shadow Stealth", "Strength Drain", "Undead"]),
  m("Shambling Mound", 6, "Neutral", 15, 34, "Near (Swim)", [
    { name: "Slam", count: 2, bonus: 5, damage: "2d6+2", notes: "Engulf" },
  ], { str: 4, dex: -1, con: 3, int: -3, wis: 0, cha: -3 }, ["Lightning Absorption", "Engulf", "Plant"]),
  m("Shark", 4, "Neutral", 12, 22, "Double near (Swim)", [
    { name: "Bite", count: 1, bonus: 4, damage: "2d6+2" },
  ], { str: 4, dex: 1, con: 2, int: -4, wis: 1, cha: -3 }, ["Blood Frenzy", "Water Breathing"]),
  m("Siren", 4, "Chaotic", 13, 18, "Near (Swim)", [
    { name: "Claws", count: 2, bonus: 3, damage: "1d6" },
  ], { str: 0, dex: 3, con: 1, int: 1, wis: 2, cha: 4 }, ["Alluring Song", "Amphibious"]),
  m("Skeleton", 2, "Chaotic", 13, 9, "Near", [
    { name: "Shortsword", count: 1, bonus: 1, damage: "1d6" },
  ], { str: 1, dex: 0, con: 0, int: -2, wis: 0, cha: -2 }, ["Undead", "Piercing Resistance"]),
  m("Smilodon", 4, "Neutral", 12, 20, "Double near", [
    { name: "Bite", count: 1, bonus: 4, damage: "1d10+2" },
    { name: "Claw", count: 1, bonus: 4, damage: "1d6+2" },
  ], { str: 4, dex: 2, con: 2, int: -4, wis: 1, cha: -2 }, ["Pounce"]),
  m("Giant Snake", 2, "Neutral", 12, 11, "Near (Swim)", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d6", notes: "Poison" },
    { name: "Constrict", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 2, dex: 2, con: 1, int: -4, wis: 0, cha: -3 }, ["Constrict"]),
  m("Snake Swarm", 2, "Neutral", 12, 9, "Near (Swim)", [
    { name: "Bites", count: 1, bonus: 2, damage: "2d4", notes: "Poison" },
  ], { str: -4, dex: 2, con: 0, int: -4, wis: 0, cha: -4 }, ["Swarm Resistance"]),
  m("Soldier", 2, "Lawful", 14, 10, "Near", [
    { name: "Longsword", count: 1, bonus: 2, damage: "1d8+1" },
    { name: "Crossbow", count: 1, bonus: 1, damage: "1d6", range: "Far" },
  ], { str: 2, dex: 1, con: 1, int: 0, wis: 0, cha: 0 }, ["Formation Fighting"], { darkAdapted: false }),
  m("Sphinx", 10, "Neutral", 17, 52, "Near (Fly)", [
    { name: "Claw", count: 2, bonus: 6, damage: "2d8+2" },
  ], { str: 4, dex: 1, con: 3, int: 4, wis: 4, cha: 4 }, ["Roar", "Riddles", "Innate Magic"]),
  m("Spider", 0, "Neutral", 11, 1, "Near (Climb)", [
    { name: "Bite", count: 1, bonus: 1, damage: "1", notes: "Poison" },
  ], { str: -4, dex: 2, con: -1, int: -5, wis: 0, cha: -4 }, ["Spider Climb", "Web Walker"]),
  m("Giant Spider", 3, "Neutral", 13, 14, "Near (Climb)", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d8", notes: "Poison" },
  ], { str: 2, dex: 3, con: 1, int: -4, wis: 1, cha: -3 }, ["Spider Climb", "Web Walker", "Web Shooter (Near)"]),
  m("Spider Swarm", 2, "Neutral", 12, 9, "Near (Climb)", [
    { name: "Bites", count: 1, bonus: 2, damage: "2d4", notes: "Poison" },
  ], { str: -4, dex: 2, con: 0, int: -5, wis: 0, cha: -4 }, ["Swarm Resistance"]),
  m("Stingbat", 1, "Neutral", 12, 4, "Near (Fly)", [
    { name: "Sting", count: 1, bonus: 2, damage: "1d4", notes: "Blood Drain" },
  ], { str: -2, dex: 2, con: 0, int: -4, wis: 0, cha: -4 }, ["Blood Drain"]),
  m("Strangler", 3, "Chaotic", 13, 14, "Near (Climb)", [
    { name: "Tentacle Garrote", count: 1, bonus: 3, damage: "1d8+1", notes: "Choke" },
  ], { str: 3, dex: 2, con: 2, int: -1, wis: 1, cha: -1 }, ["Ambusher", "Silence Aura"]),

  // T
  m("Ten-Eyed Oracle", 9, "Neutral", 15, 45, "Near (Hover)", [
    { name: "Eye Ray", count: 2, bonus: 6, damage: "2d8", range: "Far", notes: "Random Effect" },
  ], { str: 0, dex: 2, con: 3, int: 4, wis: 4, cha: 3 }, ["All-Around Vision", "Telepathy", "Precognition"]),
  m("Thief", 2, "Chaotic", 13, 8, "Near", [
    { name: "Shortsword", count: 1, bonus: 2, damage: "1d6+1" },
    { name: "Dagger", count: 1, bonus: 2, damage: "1d4+1", range: "Near" },
  ], { str: 0, dex: 3, con: 0, int: 1, wis: 0, cha: 1 }, ["Backstab (+2d6)", "Sneaky"], { darkAdapted: false }),
  m("Thug", 2, "Chaotic", 12, 11, "Near", [
    { name: "Mace", count: 2, bonus: 2, damage: "1d6+1" },
  ], { str: 2, dex: 0, con: 2, int: -1, wis: 0, cha: 0 }, ["Pack Tactics"], { darkAdapted: false }),
  m("Treant", 9, "Neutral", 16, 50, "Near", [
    { name: "Slam", count: 2, bonus: 6, damage: "2d10+3" },
    { name: "Rock", count: 1, bonus: 6, damage: "2d8+3", range: "Far" },
  ], { str: 5, dex: -1, con: 4, int: 1, wis: 3, cha: 1 }, ["Animate Trees", "Vulnerable to Fire", "Plant"], { darkAdapted: false }),
  m("Troll", 6, "Chaotic", 13, 30, "Near", [
    { name: "Bite", count: 1, bonus: 4, damage: "1d8+2" },
    { name: "Claws", count: 2, bonus: 4, damage: "1d6+2" },
  ], { str: 4, dex: 1, con: 3, int: -2, wis: 0, cha: -2 }, ["Regeneration (5 HP/rd, stopped by acid/fire)", "Keen Smell"]),
  m("Frost Troll", 7, "Chaotic", 14, 35, "Near", [
    { name: "Bite", count: 1, bonus: 5, damage: "1d8+2", notes: "Cold" },
    { name: "Claws", count: 2, bonus: 5, damage: "1d6+2" },
  ], { str: 4, dex: 1, con: 4, int: -2, wis: 0, cha: -2 }, ["Regeneration (Stopped by fire)", "Cold Immunity"]),

  // U & V
  m("Unicorn", 5, "Lawful", 13, 25, "Double near", [
    { name: "Hooves", count: 2, bonus: 4, damage: "1d8+2" },
    { name: "Horn", count: 1, bonus: 4, damage: "1d10+2" },
  ], { str: 4, dex: 2, con: 2, int: 1, wis: 3, cha: 3 }, ["Healing Horn", "Teleport", "Magic Resistance"], { darkAdapted: false }),
  m("Vampire", 10, "Chaotic", 16, 50, "Near (Fly)", [
    { name: "Unarmed", count: 2, bonus: 6, damage: "1d8+2" },
    { name: "Bite", count: 1, bonus: 6, damage: "1d6+2", notes: "Life Drain 2d6" },
  ], { str: 4, dex: 3, con: 3, int: 3, wis: 2, cha: 4 }, ["Regeneration", "Shapechanger", "Charm", "Misty Escape", "Vampire Weaknesses", "Undead"]),
  m("Vampire Spawn", 5, "Chaotic", 14, 25, "Near (Climb)", [
    { name: "Claws", count: 2, bonus: 4, damage: "1d6+1" },
    { name: "Bite", count: 1, bonus: 4, damage: "1d6+1", notes: "Life Drain 1d6" },
  ], { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 1 }, ["Spider Climb", "Regeneration", "Undead"]),
  m("Violet Fungus", 1, "Neutral", 9, 7, "Near", [
    { name: "Rotting Touch", count: 1, bonus: 1, damage: "1d6", notes: "Rotting" },
  ], { str: -3, dex: -4, con: 1, int: -5, wis: -4, cha: -5 }, ["Blindvision", "False Appearance"]),
  m("Viperian", 3, "Chaotic", 13, 15, "Near", [
    { name: "Scimitar", count: 1, bonus: 3, damage: "1d6+1" },
    { name: "Bite", count: 1, bonus: 3, damage: "1d4", notes: "Poison" },
  ], { str: 1, dex: 2, con: 1, int: 1, wis: 1, cha: 0 }, ["Poison Immunity", "Serpent Tongue"]),
  m("Viperian Ophid", 4, "Chaotic", 14, 20, "Near", [
    { name: "Spear", count: 1, bonus: 4, damage: "1d8+1" },
    { name: "Constrict", count: 1, bonus: 4, damage: "1d6+1" },
  ], { str: 3, dex: 2, con: 2, int: 1, wis: 1, cha: 0 }, ["Constrict", "Poison Spittle"]),
  m("Viperian Wizard", 5, "Chaotic", 13, 22, "Near", [
    { name: "Staff", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 0, dex: 2, con: 1, int: 4, wis: 2, cha: 1 }, ["Spellcasting"], { spells: ["Poison Spray", "Acid Arrow", "Hold Person"] }),
  m("Vulture", 0, "Neutral", 10, 1, "Near (Fly)", [
    { name: "Beak", count: 1, bonus: 0, damage: "1d3" },
  ], { str: -2, dex: 1, con: 0, int: -4, wis: 1, cha: -3 }, ["Pack Tactics", "Keen Sight and Smell"], { darkAdapted: false }),

  // W
  m("Wandering Merchant", 1, "Neutral", 10, 4, "Near", [
    { name: "Dagger", count: 1, bonus: 0, damage: "1d4" },
  ], { str: 0, dex: 0, con: 0, int: 1, wis: 1, cha: 2 }, ["Bargain", "Connections"], { darkAdapted: false }),
  m("Giant Wasp", 2, "Neutral", 13, 9, "Double near (Fly)", [
    { name: "Sting", count: 1, bonus: 2, damage: "1d6", notes: "Poison" },
  ], { str: 1, dex: 2, con: 1, int: -5, wis: 0, cha: -4 }, ["Paralyzing Poison"]),
  m("Wererat", 3, "Chaotic", 13, 14, "Near", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d6", notes: "Lycanthropy" },
    { name: "Shortsword", count: 1, bonus: 3, damage: "1d6" },
  ], { str: 1, dex: 3, con: 1, int: 0, wis: 1, cha: -1 }, ["Shapechanger", "Silver Weakness", "Keen Smell"]),
  m("Werewolf", 4, "Chaotic", 13, 22, "Double near", [
    { name: "Bite", count: 1, bonus: 4, damage: "1d8+1", notes: "Lycanthropy" },
    { name: "Claws", count: 1, bonus: 4, damage: "1d6+1" },
  ], { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 0 }, ["Shapechanger", "Silver Weakness", "Keen Hearing and Smell"]),
  m("Wight", 3, "Chaotic", 14, 16, "Near", [
    { name: "Longsword", count: 1, bonus: 3, damage: "1d8+1" },
    { name: "Life Drain", count: 1, bonus: 3, damage: "1d6", notes: "Drains 1 LV / Max HP" },
  ], { str: 2, dex: 2, con: 2, int: 0, wis: 1, cha: 1 }, ["Life Drain", "Sunlight Sensitivity", "Undead"]),
  m("Will-o'-Wisp", 4, "Chaotic", 16, 12, "Double near (Fly/Hover)", [
    { name: "Shock", count: 1, bonus: 4, damage: "2d6", notes: "Lightning" },
  ], { str: -5, dex: 4, con: 0, int: 1, wis: 2, cha: 1 }, ["Invisibility", "Consume Life", "Ephemeral"]),
  m("Wolf", 1, "Neutral", 12, 6, "Double near", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d6", notes: "Knockdown" },
  ], { str: 1, dex: 2, con: 1, int: -4, wis: 1, cha: -2 }, ["Pack Tactics", "Keen Hearing and Smell"]),
  m("Dire Wolf", 3, "Neutral", 13, 16, "Double near", [
    { name: "Bite", count: 1, bonus: 3, damage: "1d8+2", notes: "Knockdown" },
  ], { str: 3, dex: 2, con: 2, int: -4, wis: 1, cha: -2 }, ["Pack Tactics", "Keen Hearing and Smell"]),
  m("Winter Wolf", 5, "Chaotic", 14, 28, "Double near", [
    { name: "Bite", count: 1, bonus: 4, damage: "2d6+2" },
  ], { str: 4, dex: 1, con: 3, int: 0, wis: 1, cha: -1 }, ["Cold Breath (Far, 3d6)", "Immunity (Cold)", "Snow Camouflage"]),
  m("Worg", 2, "Chaotic", 12, 12, "Double near", [
    { name: "Bite", count: 1, bonus: 2, damage: "1d8+1", notes: "Knockdown" },
  ], { str: 2, dex: 1, con: 1, int: -2, wis: 0, cha: -1 }, ["Dark-adapted", "Goblin Mount"]),
  m("Wraith", 5, "Chaotic", 13, 25, "Near (Fly)", [
    { name: "Life Drain", count: 1, bonus: 4, damage: "2d6", notes: "Drains Max HP" },
  ], { str: -2, dex: 3, con: 2, int: 1, wis: 2, cha: 2 }, ["Incorporeal", "Create Specter", "Sunlight Sensitivity", "Undead"]),
  m("Wyvern", 6, "Neutral", 14, 32, "Double near (Fly)", [
    { name: "Bite", count: 1, bonus: 5, damage: "1d8+2" },
    { name: "Claws", count: 1, bonus: 5, damage: "1d6+2" },
    { name: "Stinger", count: 1, bonus: 5, damage: "1d8+2", notes: "Poison (2d6)" },
  ], { str: 4, dex: 1, con: 3, int: -3, wis: 1, cha: -2 }, ["Poisonous Stinger"]),

  // Z
  m("Zombie", 2, "Chaotic", 8, 11, "Near", [
    { name: "Slam", count: 1, bonus: 2, damage: "1d6" },
  ], { str: 2, dex: -2, con: 2, int: -3, wis: -1, cha: -3 }, ["Undead Fortitude (DC 15 CON to drop to 1 HP instead of 0)", "Undead"]),
];

export function getShadowdarkMonster(idOrName: string): ShadowdarkMonsterDef | undefined {
  const norm = idOrName.toLowerCase().trim();
  const slug = slugify(norm);
  return SHADOWDARK_MONSTERS.find(
    (m) =>
      m.id === slug ||
      m.name.toLowerCase() === norm ||
      slugify(m.name) === slug,
  );
}

export interface SearchMonstersOptions {
  search?: string;
  level?: number;
  alignment?: "Lawful" | "Neutral" | "Chaotic" | "L" | "N" | "C";
}

export function searchShadowdarkMonsters(opts: SearchMonstersOptions = {}) {
  let list = SHADOWDARK_MONSTERS;
  if (opts.search) {
    const q = opts.search.toLowerCase().trim();
    list = list.filter((m) => m.name.toLowerCase().includes(q));
  }
  if (opts.level !== undefined) {
    list = list.filter((m) => m.level === opts.level);
  }
  if (opts.alignment) {
    const a = opts.alignment.toUpperCase();
    const align =
      a === "L" || a === "LAWFUL"
        ? "Lawful"
        : a === "N" || a === "NEUTRAL"
          ? "Neutral"
          : "Chaotic";
    list = list.filter((m) => m.alignment === align);
  }
  return list;
}
