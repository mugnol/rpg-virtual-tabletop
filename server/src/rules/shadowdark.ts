/**
 * Shadowdark RPG Core Rules (V4-7) & Shadowdarklings Parity Engine.
 * Implements complete tables, formulas, and gameplay mechanics from
 * Shadowdark RPG by Kelsey Dionne / The Arcane Library.
 */

export type ShadowdarkAbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type ShadowdarkAlignment = "Lawful" | "Neutral" | "Chaotic";
export type ShadowdarkClassKey = "fighter" | "priest" | "thief" | "wizard";
export type ShadowdarkAncestryKey =
  | "dwarf"
  | "elf"
  | "goblin"
  | "half-orc"
  | "halfling"
  | "human";

export interface ShadowdarkAncestryDef {
  key: ShadowdarkAncestryKey;
  name: string;
  languages: string[];
  extraCommonLanguages?: number;
  traitName: string;
  traitDescription: string;
  stoutHpBonus?: number;
  hpRollAdvantage?: boolean;
  farsightOptions?: Array<"ranged" | "spellcasting">;
  immuneToSurprise?: boolean;
  meleeAttackBonus?: number;
  meleeDamageBonus?: number;
  invisibilityRoundsPerDay?: number;
  extraTalentRollsAtLevel1?: number;
}

export const SHADOWDARK_ANCESTRIES: Record<
  ShadowdarkAncestryKey,
  ShadowdarkAncestryDef
> = {
  dwarf: {
    key: "dwarf",
    name: "Dwarf",
    languages: ["Common", "Dwarvish"],
    traitName: "Stout",
    traitDescription: "Start with +2 HP. Roll hit points per level with advantage.",
    stoutHpBonus: 2,
    hpRollAdvantage: true,
  },
  elf: {
    key: "elf",
    name: "Elf",
    languages: ["Common", "Elvish", "Sylvan"],
    traitName: "Farsight",
    traitDescription:
      "+1 bonus to attack rolls with ranged weapons or +1 bonus to spellcasting checks.",
    farsightOptions: ["ranged", "spellcasting"],
  },
  goblin: {
    key: "goblin",
    name: "Goblin",
    languages: ["Common", "Goblin"],
    traitName: "Keen Senses",
    traitDescription: "You can't be surprised.",
    immuneToSurprise: true,
  },
  "half-orc": {
    key: "half-orc",
    name: "Half-Orc",
    languages: ["Common", "Orcish"],
    traitName: "Mighty",
    traitDescription: "+1 bonus to attack and damage rolls with melee weapons.",
    meleeAttackBonus: 1,
    meleeDamageBonus: 1,
  },
  halfling: {
    key: "halfling",
    name: "Halfling",
    languages: ["Common"],
    traitName: "Stealthy",
    traitDescription: "Once per day, you can become invisible for 3 rounds.",
    invisibilityRoundsPerDay: 3,
  },
  human: {
    key: "human",
    name: "Human",
    languages: ["Common"],
    extraCommonLanguages: 1,
    traitName: "Ambitious",
    traitDescription: "You gain one additional talent roll at 1st level.",
    extraTalentRollsAtLevel1: 1,
  },
};

export interface ShadowdarkTalentEntry {
  minRoll: number;
  maxRoll: number;
  effect: string;
}

export interface ShadowdarkClassDef {
  key: ShadowdarkClassKey;
  name: string;
  hitDie: number;
  allowedWeapons: "all" | string[];
  allowedArmor: "all" | "none" | string[];
  allowsShield: boolean;
  spellcastingAbility?: "int" | "wis";
  freeSpells?: string[];
  features: Array<{ name: string; description: string }>;
  talentsTable: ShadowdarkTalentEntry[];
}

export const PRIEST_SPELLS_KNOWN_BY_TIER: Record<
  number,
  [number, number, number, number, number]
> = {
  1: [2, 0, 0, 0, 0],
  2: [3, 0, 0, 0, 0],
  3: [3, 1, 0, 0, 0],
  4: [3, 2, 0, 0, 0],
  5: [3, 2, 1, 0, 0],
  6: [3, 2, 2, 0, 0],
  7: [3, 3, 2, 1, 0],
  8: [3, 3, 2, 2, 0],
  9: [3, 3, 2, 2, 1],
  10: [3, 3, 3, 2, 2],
};

export const WIZARD_SPELLS_KNOWN_BY_TIER: Record<
  number,
  [number, number, number, number, number]
> = {
  1: [3, 0, 0, 0, 0],
  2: [4, 0, 0, 0, 0],
  3: [4, 1, 0, 0, 0],
  4: [4, 2, 0, 0, 0],
  5: [4, 2, 1, 0, 0],
  6: [4, 3, 2, 0, 0],
  7: [4, 3, 2, 1, 0],
  8: [4, 4, 2, 2, 0],
  9: [4, 4, 3, 2, 1],
  10: [4, 4, 4, 2, 2],
};

export const SHADOWDARK_CLASSES: Record<ShadowdarkClassKey, ShadowdarkClassDef> = {
  fighter: {
    key: "fighter",
    name: "Fighter",
    hitDie: 8,
    allowedWeapons: "all",
    allowedArmor: "all",
    allowsShield: true,
    features: [
      {
        name: "Hauler",
        description: "Add your Constitution modifier, if positive, to your gear slots.",
      },
      {
        name: "Weapon Mastery",
        description:
          "Choose one type of weapon. Gain +1 to attack and damage with that weapon type, plus half your level (rounded down).",
      },
      {
        name: "Grit",
        description:
          "Choose Strength or Dexterity. You have advantage on checks of that type to overcome an opposing force.",
      },
    ],
    talentsTable: [
      { minRoll: 2, maxRoll: 2, effect: "Gain Weapon Mastery with one additional weapon type" },
      { minRoll: 3, maxRoll: 6, effect: "+1 to melee and ranged attacks" },
      { minRoll: 7, maxRoll: 9, effect: "+2 to Strength, Dexterity, or Constitution stat" },
      { minRoll: 10, maxRoll: 11, effect: "Choose one kind of armor. You get +1 AC from that armor" },
      { minRoll: 12, maxRoll: 12, effect: "Choose a talent or +2 points to distribute to stats" },
    ],
  },
  priest: {
    key: "priest",
    name: "Priest",
    hitDie: 6,
    allowedWeapons: [
      "club",
      "crossbow",
      "dagger",
      "mace",
      "longsword",
      "staff",
      "warhammer",
    ],
    allowedArmor: "all",
    allowsShield: true,
    spellcastingAbility: "wis",
    freeSpells: ["turn-undead"],
    features: [
      {
        name: "Languages",
        description: "You know Celestial, Diabolic, or Primordial.",
      },
      {
        name: "Turn Undead",
        description:
          "You know the turn undead spell. It doesn't count toward your number of known spells.",
      },
      {
        name: "Deity",
        description:
          "Choose a god to serve who matches your alignment. You have a holy symbol for your god (takes up no gear slots).",
      },
      {
        name: "Spellcasting",
        description: "You can cast priest spells you know using Wisdom.",
      },
    ],
    talentsTable: [
      { minRoll: 2, maxRoll: 2, effect: "Gain advantage on casting one spell you know" },
      { minRoll: 3, maxRoll: 6, effect: "+1 to melee or ranged attacks" },
      { minRoll: 7, maxRoll: 9, effect: "+1 to priest spellcasting checks" },
      { minRoll: 10, maxRoll: 11, effect: "+2 to Strength or Wisdom stat" },
      { minRoll: 12, maxRoll: 12, effect: "Choose a talent or +2 points to distribute to stats" },
    ],
  },
  thief: {
    key: "thief",
    name: "Thief",
    hitDie: 4,
    allowedWeapons: ["club", "crossbow", "dagger", "shortbow", "shortsword"],
    allowedArmor: ["leather", "mithral-chain"],
    allowsShield: false,
    features: [
      {
        name: "Backstab",
        description:
          "If you hit a creature who is unaware of your attack, you deal an extra weapon die of damage plus additional weapon dice equal to half your level (rounded down).",
      },
      {
        name: "Thievery",
        description:
          "You have tools of the trade (0 gear slots) and advantage on climbing, sneaking and hiding, applying disguises, finding and disabling traps, and delicate tasks.",
      },
    ],
    talentsTable: [
      { minRoll: 2, maxRoll: 2, effect: "Gain advantage on initiative rolls (reroll if duplicate)" },
      { minRoll: 3, maxRoll: 5, effect: "Your Backstab deals +1 dice of damage" },
      { minRoll: 6, maxRoll: 9, effect: "+2 to Strength, Dexterity, or Charisma stat" },
      { minRoll: 10, maxRoll: 11, effect: "+1 to melee and ranged attacks" },
      { minRoll: 12, maxRoll: 12, effect: "Choose a talent or +2 points to distribute to stats" },
    ],
  },
  wizard: {
    key: "wizard",
    name: "Wizard",
    hitDie: 4,
    allowedWeapons: ["dagger", "staff"],
    allowedArmor: "none",
    allowsShield: false,
    spellcastingAbility: "int",
    features: [
      {
        name: "Languages",
        description: "You know two additional common languages and two rare languages.",
      },
      {
        name: "Learning Spells",
        description:
          "Permanently learn a wizard spell from a spell scroll by studying it for a day and succeeding on a DC 15 Intelligence check (expends scroll).",
      },
      {
        name: "Spellcasting",
        description: "You can cast wizard spells you know using Intelligence.",
      },
    ],
    talentsTable: [
      { minRoll: 2, maxRoll: 2, effect: "Make 1 random magic item of a type you choose" },
      {
        minRoll: 3,
        maxRoll: 7,
        effect: "+2 to Intelligence stat or +1 to wizard spellcasting checks",
      },
      { minRoll: 8, maxRoll: 9, effect: "Gain advantage on casting one spell you know" },
      { minRoll: 10, maxRoll: 11, effect: "Learn one additional wizard spell of any tier you know" },
      { minRoll: 12, maxRoll: 12, effect: "Choose a talent or +2 points to distribute to stats" },
    ],
  },
};

export interface ShadowdarkBackgroundDef {
  roll: number;
  key: string;
  name: string;
  description: string;
}

export const SHADOWDARK_BACKGROUNDS: ShadowdarkBackgroundDef[] = [
  { roll: 1, key: "urchin", name: "Urchin", description: "You grew up in the merciless streets of a large city" },
  { roll: 2, key: "wanted", name: "Wanted", description: "There's a price on your head, but you have allies" },
  { roll: 3, key: "cult-initiate", name: "Cult Initiate", description: "You know blasphemous secrets and rituals" },
  { roll: 4, key: "thieves-guild", name: "Thieves' Guild", description: "You have connections, contacts, and debts" },
  { roll: 5, key: "banished", name: "Banished", description: "Your people cast you out for supposed crimes" },
  { roll: 6, key: "orphaned", name: "Orphaned", description: "An unusual guardian rescued and raised you" },
  { roll: 7, key: "wizards-apprentice", name: "Wizard's Apprentice", description: "You have a knack and eye for magic" },
  { roll: 8, key: "jeweler", name: "Jeweler", description: "You can easily appraise value and authenticity" },
  { roll: 9, key: "herbalist", name: "Herbalist", description: "You know plants, medicines, and poisons" },
  { roll: 10, key: "barbarian", name: "Barbarian", description: "You left the horde, but it never quite left you" },
  { roll: 11, key: "mercenary", name: "Mercenary", description: "You fought friend and foe alike for your coin" },
  { roll: 12, key: "sailor", name: "Sailor", description: "Pirate, privateer, or merchant — the seas are yours" },
  { roll: 13, key: "acolyte", name: "Acolyte", description: "You're well trained in religious rites and doctrines" },
  { roll: 14, key: "soldier", name: "Soldier", description: "You served as a fighter in an organized army" },
  { roll: 15, key: "ranger", name: "Ranger", description: "The woods and wilds are your true home" },
  { roll: 16, key: "scout", name: "Scout", description: "You survived on stealth, observation, and speed" },
  { roll: 17, key: "minstrel", name: "Minstrel", description: "You've traveled far with your charm and talent" },
  { roll: 18, key: "scholar", name: "Scholar", description: "You know much about ancient history and lore" },
  { roll: 19, key: "noble", name: "Noble", description: "A famous name has opened many doors for you" },
  { roll: 20, key: "chirurgeon", name: "Chirurgeon", description: "You know anatomy, surgery, and first aid" },
];

export const SHADOWDARK_ALIGNMENTS: ShadowdarkAlignment[] = [
  "Lawful",
  "Neutral",
  "Chaotic",
];

export interface ShadowdarkDeityDef {
  key: string;
  name: string;
  alignment: ShadowdarkAlignment | "Unknown";
  description: string;
}

export const SHADOWDARK_DEITIES: ShadowdarkDeityDef[] = [
  {
    key: "saint-terragnis",
    name: "Saint Terragnis",
    alignment: "Lawful",
    description: "A legendary knight who is the patron of most lawful humans.",
  },
  {
    key: "gede",
    name: "Gede",
    alignment: "Neutral",
    description: "The god of feasts, mirth, and the wilds.",
  },
  {
    key: "madeera",
    name: "Madeera the Covenant",
    alignment: "Lawful",
    description: "The first manifestation of Law, carrying the Covenant on her skin.",
  },
  {
    key: "ord",
    name: "Ord",
    alignment: "Neutral",
    description: "Ord the Unbending, the Wise, the Secret-Keeper.",
  },
  {
    key: "memnon",
    name: "Memnon",
    alignment: "Chaotic",
    description: "The first manifestation of Chaos, Madeera's leonine twin.",
  },
  {
    key: "ramlaat",
    name: "Ramlaat",
    alignment: "Chaotic",
    description: "The Pillager, the Barbaric, the Horde.",
  },
  {
    key: "shune",
    name: "Shune the Vile",
    alignment: "Chaotic",
    description: "Whispers arcane secrets to sorcerers and witches.",
  },
  {
    key: "the-lost-1",
    name: "The Lost (First)",
    alignment: "Unknown",
    description: "First of the two Lost gods whose names were expunged from history.",
  },
  {
    key: "the-lost-2",
    name: "The Lost (Second)",
    alignment: "Unknown",
    description: "Second of the two Lost gods whose names were expunged from history.",
  },
];

export const SHADOWDARK_TITLES: Record<
  ShadowdarkClassKey,
  Array<{
    minLevel: number;
    maxLevel: number;
    Lawful: string;
    Chaotic: string;
    Neutral: string;
  }>
> = {
  fighter: [
    { minLevel: 1, maxLevel: 2, Lawful: "Squire", Chaotic: "Knave", Neutral: "Warrior" },
    { minLevel: 3, maxLevel: 4, Lawful: "Cavalier", Chaotic: "Bandit", Neutral: "Barbarian" },
    { minLevel: 5, maxLevel: 6, Lawful: "Knight", Chaotic: "Slayer", Neutral: "Battlerager" },
    { minLevel: 7, maxLevel: 8, Lawful: "Thane", Chaotic: "Reaver", Neutral: "Warchief" },
    { minLevel: 9, maxLevel: 10, Lawful: "Lord/Lady", Chaotic: "Warlord", Neutral: "Chieftain" },
  ],
  priest: [
    { minLevel: 1, maxLevel: 2, Lawful: "Acolyte", Chaotic: "Initiate", Neutral: "Seeker" },
    { minLevel: 3, maxLevel: 4, Lawful: "Crusader", Chaotic: "Zealot", Neutral: "Invoker" },
    { minLevel: 5, maxLevel: 6, Lawful: "Templar", Chaotic: "Cultist", Neutral: "Haruspex" },
    { minLevel: 7, maxLevel: 8, Lawful: "Champion", Chaotic: "Scourge", Neutral: "Mystic" },
    { minLevel: 9, maxLevel: 10, Lawful: "Paladin", Chaotic: "Chaos Knight", Neutral: "Oracle" },
  ],
  thief: [
    { minLevel: 1, maxLevel: 2, Lawful: "Footpad", Chaotic: "Thug", Neutral: "Robber" },
    { minLevel: 3, maxLevel: 4, Lawful: "Burglar", Chaotic: "Cutthroat", Neutral: "Outlaw" },
    { minLevel: 5, maxLevel: 6, Lawful: "Rook", Chaotic: "Shadow", Neutral: "Rogue" },
    { minLevel: 7, maxLevel: 8, Lawful: "Underboss", Chaotic: "Assassin", Neutral: "Renegade" },
    { minLevel: 9, maxLevel: 10, Lawful: "Boss", Chaotic: "Wraith", Neutral: "Bandit King/Queen" },
  ],
  wizard: [
    { minLevel: 1, maxLevel: 2, Lawful: "Apprentice", Chaotic: "Adept", Neutral: "Shaman" },
    { minLevel: 3, maxLevel: 4, Lawful: "Conjurer", Chaotic: "Channeler", Neutral: "Seer" },
    { minLevel: 5, maxLevel: 6, Lawful: "Arcanist", Chaotic: "Witch/Warlock", Neutral: "Warden" },
    { minLevel: 7, maxLevel: 8, Lawful: "Mage", Chaotic: "Diabolist", Neutral: "Sage" },
    { minLevel: 9, maxLevel: 10, Lawful: "Archmage", Chaotic: "Sorcerer", Neutral: "Druid" },
  ],
};

export const SHADOWDARK_LANGUAGES = {
  common: [
    "Common",
    "Dwarvish",
    "Elvish",
    "Giant",
    "Goblin",
    "Merran",
    "Orcish",
    "Reptilian",
    "Sylvan",
    "Thanian",
  ],
  rare: ["Celestial", "Diabolic", "Draconic", "Primordial"],
} as const;

export const SHADOWDARK_NAMES: Record<ShadowdarkAncestryKey, string[]> = {
  dwarf: [
    "Hilde", "Torbin", "Marga", "Bruno", "Karina",
    "Naugrim", "Brenna", "Darvin", "Elga", "Alric",
    "Isolde", "Gendry", "Bruga", "Junnor", "Vidrid",
    "Torson", "Brielle", "Ulfgar", "Sarna", "Grimm",
  ],
  elf: [
    "Eliara", "Ryarn", "Sariel", "Tirolas", "Galira",
    "Varos", "Daeniel", "Axidor", "Hiralia", "Cyrwin",
    "Lothiel", "Zaphiel", "Nayra", "Ithior", "Amriel",
    "Elyon", "Jirwyn", "Natinel", "Fiora", "Ruhiel",
  ],
  goblin: [
    "Iggs", "Tark", "Nix", "Lenk", "Roke",
    "Fitz", "Tila", "Riggs", "Prim", "Zeb",
    "Finn", "Borg", "Yark", "Deeg", "Nibs",
    "Brak", "Fink", "Rizzo", "Squib", "Grix",
  ],
  halfling: [
    "Willow", "Benny", "Annie", "Tucker", "Marie",
    "Hobb", "Cora", "Gordie", "Rose", "Ardo",
    "Alma", "Norbert", "Jennie", "Barvin", "Tilly",
    "Pike", "Lydia", "Marlow", "Astrid", "Jasper",
  ],
  "half-orc": [
    "Vara", "Gralk", "Ranna", "Korv", "Zasha",
    "Hrogar", "Klara", "Tragan", "Brolga", "Drago",
    "Yelena", "Krull", "Ulara", "Tulk", "Shiraal",
    "Wulf", "Ivara", "Hirok", "Aja", "Zoraan",
  ],
  human: [
    "Zali", "Bram", "Clara", "Nattias", "Rina",
    "Denton", "Mirena", "Aran", "Morgan", "Giralt",
    "Tamra", "Oscar", "Ishana", "Rogar", "Jasmin",
    "Tarin", "Yuri", "Malchor", "Lienna", "Godfrey",
  ],
};

export const SHADOWDARK_STARTING_GEAR_D12: string[] = [
  "Torch",
  "Dagger",
  "Pole",
  "Shortbow and 5 arrows",
  "Rope, 60'",
  "Oil, flask",
  "Crowbar",
  "Iron spikes (10)",
  "Flint and steel",
  "Grappling hook",
  "Club",
  "Caltrops (one bag)",
];

export interface ShadowdarkBasicGearItem {
  key: string;
  name: string;
  cost: string;
  slots: number;
  maxPerSlot: number;
  freeFirst?: boolean;
}

export const SHADOWDARK_BASIC_GEAR: ShadowdarkBasicGearItem[] = [
  { key: "arrows", name: "Arrows (20)", cost: "1 gp", slots: 1, maxPerSlot: 20 },
  { key: "backpack", name: "Backpack", cost: "2 gp", slots: 1, maxPerSlot: 1, freeFirst: true },
  { key: "caltrops", name: "Caltrops (one bag)", cost: "5 sp", slots: 1, maxPerSlot: 1 },
  { key: "coins", name: "Coin", cost: "Varies", slots: 1, maxPerSlot: 100, freeFirst: true },
  { key: "crossbow-bolts", name: "Crossbow bolts (20)", cost: "1 gp", slots: 1, maxPerSlot: 20 },
  { key: "crowbar", name: "Crowbar", cost: "5 sp", slots: 1, maxPerSlot: 1 },
  { key: "flask", name: "Flask or bottle", cost: "3 sp", slots: 1, maxPerSlot: 1 },
  { key: "flint-and-steel", name: "Flint and steel", cost: "5 sp", slots: 1, maxPerSlot: 1 },
  { key: "gem", name: "Gem", cost: "Varies", slots: 1, maxPerSlot: 10 },
  { key: "grappling-hook", name: "Grappling hook", cost: "1 gp", slots: 1, maxPerSlot: 1 },
  { key: "iron-spikes", name: "Iron spikes (10)", cost: "1 gp", slots: 1, maxPerSlot: 10 },
  { key: "lantern", name: "Lantern", cost: "5 gp", slots: 1, maxPerSlot: 1 },
  { key: "mirror", name: "Mirror", cost: "10 gp", slots: 1, maxPerSlot: 1 },
  { key: "oil-flask", name: "Oil, flask", cost: "5 sp", slots: 1, maxPerSlot: 1 },
  { key: "pole", name: "Pole", cost: "5 sp", slots: 1, maxPerSlot: 1 },
  { key: "rations", name: "Rations (3)", cost: "5 sp", slots: 1, maxPerSlot: 3 },
  { key: "rope", name: "Rope, 60'", cost: "1 gp", slots: 1, maxPerSlot: 1 },
  { key: "torch", name: "Torch", cost: "5 sp", slots: 1, maxPerSlot: 1 },
];

export const SHADOWDARK_CRAWLING_KIT = {
  name: "Crawling Kit",
  costGp: 7,
  totalSlots: 7,
  items: [
    { name: "Backpack", quantity: 1, slots: 0, cost: "2 gp" },
    { name: "Flint and steel", quantity: 1, slots: 1, cost: "5 sp" },
    { name: "Torch", quantity: 2, slots: 2, cost: "1 gp" },
    { name: "Rations", quantity: 3, slots: 1, cost: "5 sp" },
    { name: "Iron spikes", quantity: 10, slots: 1, cost: "1 gp" },
    { name: "Grappling hook", quantity: 1, slots: 1, cost: "1 gp" },
    { name: "Rope, 60'", quantity: 1, slots: 1, cost: "1 gp" },
  ],
} as const;

export interface ShadowdarkArmorDef {
  key: string;
  name: string;
  cost: string;
  slots: number;
  baseAc: number;
  dexMode: "full" | "none";
  properties: string[];
}

export const SHADOWDARK_ARMOR: ShadowdarkArmorDef[] = [
  { key: "leather", name: "Leather armor", cost: "10 gp", slots: 1, baseAc: 11, dexMode: "full", properties: [] },
  { key: "chainmail", name: "Chainmail", cost: "60 gp", slots: 2, baseAc: 13, dexMode: "full", properties: ["disadv_stealth", "disadv_swim"] },
  { key: "plate", name: "Plate mail", cost: "130 gp", slots: 3, baseAc: 15, dexMode: "none", properties: ["no_swim", "disadv_stealth"] },
  { key: "mithral-chain", name: "Mithral Chainmail", cost: "240 gp", slots: 1, baseAc: 13, dexMode: "full", properties: ["mithral"] },
  { key: "mithral-plate", name: "Mithral Plate mail", cost: "520 gp", slots: 2, baseAc: 15, dexMode: "none", properties: ["mithral"] },
];

export interface ShadowdarkWeaponDef {
  key: string;
  name: string;
  cost: string;
  type: "M" | "R" | "M/R";
  range: "C" | "N" | "F" | "C/N" | "C/F";
  damage: string;
  versatileDamage?: string;
  slots: number;
  properties: Array<"F" | "L" | "Th" | "2H" | "V">;
}

export const SHADOWDARK_WEAPONS: ShadowdarkWeaponDef[] = [
  { key: "bastard-sword", name: "Bastard sword", cost: "10 gp", type: "M", range: "C", damage: "1d8", versatileDamage: "1d10", slots: 2, properties: ["V"] },
  { key: "club", name: "Club", cost: "5 cp", type: "M", range: "C", damage: "1d4", slots: 1, properties: [] },
  { key: "crossbow", name: "Crossbow", cost: "8 gp", type: "R", range: "F", damage: "1d6", slots: 1, properties: ["2H", "L"] },
  { key: "dagger", name: "Dagger", cost: "1 gp", type: "M/R", range: "C/N", damage: "1d4", slots: 1, properties: ["F", "Th"] },
  { key: "greataxe", name: "Greataxe", cost: "10 gp", type: "M", range: "C", damage: "1d8", versatileDamage: "1d10", slots: 2, properties: ["V"] },
  { key: "greatsword", name: "Greatsword", cost: "12 gp", type: "M", range: "C", damage: "1d12", slots: 2, properties: ["2H"] },
  { key: "javelin", name: "Javelin", cost: "5 sp", type: "M/R", range: "C/F", damage: "1d4", slots: 1, properties: ["Th"] },
  { key: "longbow", name: "Longbow", cost: "8 gp", type: "R", range: "F", damage: "1d8", slots: 1, properties: ["2H"] },
  { key: "longsword", name: "Longsword", cost: "9 gp", type: "M", range: "C", damage: "1d8", slots: 1, properties: [] },
  { key: "mace", name: "Mace", cost: "5 gp", type: "M", range: "C", damage: "1d6", slots: 1, properties: [] },
  { key: "shortbow", name: "Shortbow", cost: "6 gp", type: "R", range: "F", damage: "1d4", slots: 1, properties: ["2H"] },
  { key: "shortsword", name: "Shortsword", cost: "7 gp", type: "M", range: "C", damage: "1d6", slots: 1, properties: [] },
  { key: "spear", name: "Spear", cost: "5 sp", type: "M/R", range: "C/N", damage: "1d6", slots: 1, properties: ["Th"] },
  { key: "staff", name: "Staff", cost: "5 sp", type: "M", range: "C", damage: "1d4", slots: 1, properties: ["2H"] },
  { key: "warhammer", name: "Warhammer", cost: "10 gp", type: "M", range: "C", damage: "1d10", slots: 1, properties: ["2H"] },
];

export const PRIEST_PENANCE_SACRIFICE_GP: Record<number, number> = {
  1: 5,
  2: 20,
  3: 40,
  4: 90,
  5: 150,
};

export interface WizardMishapEntry {
  roll: number;
  name: string;
  effect: string;
}

export const WIZARD_MISHAP_TABLES: {
  tier1_2: WizardMishapEntry[];
  tier3_4: WizardMishapEntry[];
  tier5: WizardMishapEntry[];
} = {
  tier1_2: [
    { roll: 1, name: "Devastation!", effect: "Roll twice and combine both effects (reroll any further 1s)" },
    { roll: 2, name: "Explosion!", effect: "You take 1d8 damage" },
    { roll: 3, name: "Refraction!", effect: "You target yourself with the spell" },
    { roll: 4, name: "Your hand slipped!", effect: "You target a random ally with the spell" },
    { roll: 5, name: "Mind wound!", effect: "You can't cast this spell again for a week" },
    { roll: 6, name: "Discorporation!", effect: "One random piece of your gear disappears forever" },
    { roll: 7, name: "Spell worm!", effect: "You lose the ability to cast a random spell on each of your turns until you pass a DC 12 CON check (regain after rest)" },
    { roll: 8, name: "Harmonic failure!", effect: "You lose the ability to cast a random spell until you complete a rest" },
    { roll: 9, name: "Poof!", effect: "You suppress all light within a near distance from you for 10 rounds" },
    { roll: 10, name: "The horror!", effect: "You scream uncontrollably for 3 rounds in Primordial, drawing lots of attention" },
    { roll: 11, name: "Energy surge!", effect: "You glow bright purple for 10 rounds, granting enemies advantage on attacks against you" },
    { roll: 12, name: "Unstable conduit!", effect: "You have disadvantage on casting spells of the same tier for 10 rounds" },
  ],
  tier3_4: [
    { roll: 1, name: "Devastation!", effect: "Roll twice and combine both effects (reroll any further 1s)" },
    { roll: 2, name: "Blast radius!", effect: "You and all near creatures take 2d6 damage" },
    { roll: 3, name: "Duplicate refraction!", effect: "You target yourself and the nearest ally with two identical copies of the spell" },
    { roll: 4, name: "You flubbed the incantation!", effect: "You cast a random spell from your known spells at the same targets" },
    { roll: 5, name: "Ethereal bandersnatch!", effect: "Two random pieces of your gear disappear forever" },
    { roll: 6, name: "Arcano-mutagenesis!", effect: "Pass a DC 12 CON check or a random stat drops to 3 (-4) until you complete a rest" },
    { roll: 7, name: "Boom!", effect: "You open a 30-foot deep sinkhole with you at the center; you and near creatures pass DC 15 DEX or fall in" },
    { roll: 8, name: "Petrification!", effect: "1d4 of your limbs petrify for the next 24 hours" },
    { roll: 9, name: "Stupefaction!", effect: "You lose the ability to cast all spells of the same tier until you complete a rest" },
    { roll: 10, name: "It cannot be unseen!", effect: "Pass a DC 12 WIS check or descend into mad raving for 1d10 rounds" },
    { roll: 11, name: "Radioactive energies!", effect: "You whirl with repulsive energies, drawing attacks of all enemies who see you for 1d4 rounds" },
    { roll: 12, name: "Uncontained channeling!", effect: "You have disadvantage on casting spells of the same tier and lower for 10 rounds" },
  ],
  tier5: [
    { roll: 1, name: "Devastation!", effect: "Roll twice and combine both effects (reroll any further 1s)" },
    { roll: 2, name: "Pyroclastic extrusion!", effect: "You deal 3d8 damage to yourself and all creatures within near" },
    { roll: 3, name: "Astral incision!", effect: "An otherworldly blade cuts into your memory. You permanently forget one random spell" },
    { roll: 4, name: "The grimlow!", effect: "You accidentally summon a hostile grimlow in a space near to you for 2d4 rounds" },
    { roll: 5, name: "Dark plasma aura!", effect: "Attacks against you deal double damage for the next 2d6 rounds" },
    { roll: 6, name: "Gate!", effect: "You open a magic portal; something dreadful comes through in 1d4 rounds unless closed with DC 18 INT check" },
    { roll: 7, name: "Runaway arcana loop!", effect: "Your spell targets a random creature you can see; each turn pass spellcasting check or cast again" },
    { roll: 8, name: "Arcane obstruction!", effect: "You lose the ability to cast all spells of a random tier until you complete a rest" },
    { roll: 9, name: "What lurks beyond the veil!", effect: "Pass a DC 15 WIS check or fall into mad raving for 1d4 hours" },
    { roll: 10, name: "Ord's balance!", effect: "Permanently sacrifice either a magic item or the ability to cast a tier 3+ spell you know" },
    { roll: 11, name: "Unmitigated chain reaction!", effect: "You have disadvantage on casting all spells for the next 10 rounds" },
    { roll: 12, name: "Shred!", effect: "You tear a large hole in the fabric of the universe close to you that grows larger every round" },
  ],
};

export interface ShadowdarkSpellDef {
  key: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  classes: Array<"priest" | "wizard">;
  duration: string;
  range: "Self" | "Close" | "Near" | "Far" | "Unlimited";
  isFocus?: boolean;
  autoAdvantage?: boolean;
  failedCheckIsCrit?: boolean;
  requiresPenanceAfterCast?: boolean;
  requiresRestAfterCast?: boolean;
  damageOrHealing?: string;
}

export const SHADOWDARK_SPELLS: ShadowdarkSpellDef[] = [
  // Priest Tier 1
  { key: "cure-wounds", name: "Cure Wounds", tier: 1, classes: ["priest"], duration: "Instant", range: "Close", damageOrHealing: "1d6" },
  { key: "holy-weapon", name: "Holy Weapon", tier: 1, classes: ["priest"], duration: "5 rounds", range: "Close" },
  { key: "light", name: "Light", tier: 1, classes: ["priest", "wizard"], duration: "1 hour real time", range: "Close" },
  { key: "protection-from-evil", name: "Protection From Evil", tier: 1, classes: ["priest", "wizard"], duration: "Focus", range: "Close", isFocus: true },
  { key: "shield-of-faith", name: "Shield of Faith", tier: 1, classes: ["priest"], duration: "5 rounds", range: "Self" },
  { key: "turn-undead", name: "Turn Undead", tier: 1, classes: ["priest"], duration: "Instant", range: "Near" },
  // Priest Tier 2
  { key: "augury", name: "Augury", tier: 2, classes: ["priest"], duration: "Instant", range: "Self" },
  { key: "bless", name: "Bless", tier: 2, classes: ["priest"], duration: "Instant", range: "Close" },
  { key: "blind-deafen", name: "Blind/Deafen", tier: 2, classes: ["priest"], duration: "Focus", range: "Near", isFocus: true },
  { key: "cleansing-weapon", name: "Cleansing Weapon", tier: 2, classes: ["priest"], duration: "5 rounds", range: "Close", damageOrHealing: "1d4" },
  { key: "smite", name: "Smite", tier: 2, classes: ["priest"], duration: "Instant", range: "Near", damageOrHealing: "1d6" },
  { key: "zone-of-truth", name: "Zone of Truth", tier: 2, classes: ["priest"], duration: "Focus", range: "Near", isFocus: true },
  // Priest Tier 3
  { key: "command", name: "Command", tier: 3, classes: ["priest"], duration: "Focus", range: "Far", isFocus: true },
  { key: "lay-to-rest", name: "Lay To Rest", tier: 3, classes: ["priest"], duration: "Instant", range: "Close" },
  { key: "mass-cure", name: "Mass Cure", tier: 3, classes: ["priest"], duration: "Instant", range: "Near", damageOrHealing: "2d6" },
  { key: "rebuke-unholy", name: "Rebuke Unholy", tier: 3, classes: ["priest"], duration: "Instant", range: "Near" },
  { key: "restoration", name: "Restoration", tier: 3, classes: ["priest"], duration: "Instant", range: "Close" },
  { key: "speak-with-dead", name: "Speak With Dead", tier: 3, classes: ["priest", "wizard"], duration: "Instant", range: "Close" },
  // Priest Tier 4
  { key: "commune", name: "Commune", tier: 4, classes: ["priest"], duration: "Instant", range: "Self" },
  { key: "control-water", name: "Control Water", tier: 4, classes: ["priest", "wizard"], duration: "Focus", range: "Far", isFocus: true },
  { key: "flame-strike", name: "Flame Strike", tier: 4, classes: ["priest"], duration: "Instant", range: "Far", damageOrHealing: "2d6" },
  { key: "pillar-of-salt", name: "Pillar of Salt", tier: 4, classes: ["priest"], duration: "Focus", range: "Near", isFocus: true },
  { key: "regenerate", name: "Regenerate", tier: 4, classes: ["priest"], duration: "Focus", range: "Close", isFocus: true, damageOrHealing: "1d4" },
  { key: "wrath", name: "Wrath", tier: 4, classes: ["priest"], duration: "10 rounds", range: "Self", damageOrHealing: "1d8" },
  // Priest Tier 5
  { key: "divine-vengeance", name: "Divine Vengeance", tier: 5, classes: ["priest"], duration: "10 rounds", range: "Self" },
  { key: "dominion", name: "Dominion", tier: 5, classes: ["priest"], duration: "10 rounds", range: "Near", requiresPenanceAfterCast: true },
  { key: "heal", name: "Heal", tier: 5, classes: ["priest"], duration: "Instant", range: "Close", requiresRestAfterCast: true },
  { key: "judgment", name: "Judgment", tier: 5, classes: ["priest"], duration: "5 rounds", range: "Close" },
  { key: "plane-shift", name: "Plane Shift", tier: 5, classes: ["priest", "wizard"], duration: "Instant", range: "Close" },
  { key: "prophecy", name: "Prophecy", tier: 5, classes: ["priest"], duration: "Instant", range: "Self", requiresPenanceAfterCast: true },

  // Wizard Tier 1
  { key: "alarm", name: "Alarm", tier: 1, classes: ["wizard"], duration: "1 day", range: "Close" },
  { key: "burning-hands", name: "Burning Hands", tier: 1, classes: ["wizard"], duration: "Instant", range: "Close", damageOrHealing: "1d6" },
  { key: "charm-person", name: "Charm Person", tier: 1, classes: ["wizard"], duration: "1d8 days", range: "Near" },
  { key: "detect-magic", name: "Detect Magic", tier: 1, classes: ["wizard"], duration: "Focus", range: "Near", isFocus: true },
  { key: "feather-fall", name: "Feather Fall", tier: 1, classes: ["wizard"], duration: "Instant", range: "Self" },
  { key: "floating-disk", name: "Floating Disk", tier: 1, classes: ["wizard"], duration: "10 rounds", range: "Near" },
  { key: "hold-portal", name: "Hold Portal", tier: 1, classes: ["wizard"], duration: "10 rounds", range: "Near" },
  { key: "mage-armor", name: "Mage Armor", tier: 1, classes: ["wizard"], duration: "10 rounds", range: "Self" },
  { key: "magic-missile", name: "Magic Missile", tier: 1, classes: ["wizard"], duration: "Instant", range: "Far", autoAdvantage: true, damageOrHealing: "1d4" },
  { key: "sleep", name: "Sleep", tier: 1, classes: ["wizard"], duration: "Instant", range: "Near" },
  // Wizard Tier 2
  { key: "acid-arrow", name: "Acid Arrow", tier: 2, classes: ["wizard"], duration: "Focus", range: "Far", isFocus: true, damageOrHealing: "1d6" },
  { key: "alter-self", name: "Alter Self", tier: 2, classes: ["wizard"], duration: "5 rounds", range: "Self" },
  { key: "detect-thoughts", name: "Detect Thoughts", tier: 2, classes: ["wizard"], duration: "Focus", range: "Near", isFocus: true },
  { key: "fixed-object", name: "Fixed Object", tier: 2, classes: ["wizard"], duration: "5 rounds", range: "Close" },
  { key: "hold-person", name: "Hold Person", tier: 2, classes: ["wizard"], duration: "Focus", range: "Near", isFocus: true },
  { key: "invisibility", name: "Invisibility", tier: 2, classes: ["wizard"], duration: "10 rounds", range: "Close" },
  { key: "knock", name: "Knock", tier: 2, classes: ["wizard"], duration: "Instant", range: "Near" },
  { key: "levitate", name: "Levitate", tier: 2, classes: ["wizard"], duration: "Focus", range: "Self", isFocus: true },
  { key: "mirror-image", name: "Mirror Image", tier: 2, classes: ["wizard"], duration: "5 rounds", range: "Self" },
  { key: "misty-step", name: "Misty Step", tier: 2, classes: ["wizard"], duration: "Instant", range: "Self" },
  { key: "silence", name: "Silence", tier: 2, classes: ["wizard"], duration: "Focus", range: "Far", isFocus: true },
  { key: "web", name: "Web", tier: 2, classes: ["wizard"], duration: "5 rounds", range: "Far" },
  // Wizard Tier 3
  { key: "animate-dead", name: "Animate Dead", tier: 3, classes: ["wizard"], duration: "1 day", range: "Close" },
  { key: "dispel-magic", name: "Dispel Magic", tier: 3, classes: ["wizard"], duration: "Instant", range: "Near" },
  { key: "fabricate", name: "Fabricate", tier: 3, classes: ["wizard"], duration: "10 rounds", range: "Near" },
  { key: "fireball", name: "Fireball", tier: 3, classes: ["wizard"], duration: "Instant", range: "Far", damageOrHealing: "4d6" },
  { key: "fly", name: "Fly", tier: 3, classes: ["wizard"], duration: "5 rounds", range: "Self" },
  { key: "gaseous-form", name: "Gaseous Form", tier: 3, classes: ["wizard"], duration: "10 rounds", range: "Self" },
  { key: "illusion", name: "Illusion", tier: 3, classes: ["wizard"], duration: "Focus", range: "Far", isFocus: true },
  { key: "lightning-bolt", name: "Lightning Bolt", tier: 3, classes: ["wizard"], duration: "Instant", range: "Far", damageOrHealing: "3d6" },
  { key: "magic-circle", name: "Magic Circle", tier: 3, classes: ["wizard"], duration: "Focus", range: "Near", isFocus: true },
  { key: "protection-from-energy", name: "Protection From Energy", tier: 3, classes: ["wizard"], duration: "Focus", range: "Close", isFocus: true },
  { key: "sending", name: "Sending", tier: 3, classes: ["wizard"], duration: "Instant", range: "Unlimited" },
  // Wizard Tier 4
  { key: "arcane-eye", name: "Arcane Eye", tier: 4, classes: ["wizard"], duration: "Focus", range: "Near", isFocus: true },
  { key: "cloudkill", name: "Cloudkill", tier: 4, classes: ["wizard"], duration: "5 rounds", range: "Far", damageOrHealing: "2d6" },
  { key: "confusion", name: "Confusion", tier: 4, classes: ["wizard"], duration: "Focus", range: "Near", isFocus: true },
  { key: "dimension-door", name: "Dimension Door", tier: 4, classes: ["wizard"], duration: "Instant", range: "Self" },
  { key: "divination", name: "Divination", tier: 4, classes: ["wizard"], duration: "Instant", range: "Self" },
  { key: "passwall", name: "Passwall", tier: 4, classes: ["wizard"], duration: "5 rounds", range: "Close" },
  { key: "polymorph", name: "Polymorph", tier: 4, classes: ["wizard"], duration: "10 rounds", range: "Close" },
  { key: "resilient-sphere", name: "Resilient Sphere", tier: 4, classes: ["wizard"], duration: "5 rounds", range: "Close" },
  { key: "stoneskin", name: "Stoneskin", tier: 4, classes: ["wizard"], duration: "10 rounds", range: "Self" },
  { key: "telekinesis", name: "Telekinesis", tier: 4, classes: ["wizard"], duration: "Focus", range: "Far", isFocus: true },
  { key: "wall-of-force", name: "Wall of Force", tier: 4, classes: ["wizard"], duration: "5 rounds", range: "Near" },
  // Wizard Tier 5
  { key: "antimagic-shell", name: "Antimagic Shell", tier: 5, classes: ["wizard"], duration: "Focus", range: "Self", isFocus: true },
  { key: "create-undead", name: "Create Undead", tier: 5, classes: ["wizard"], duration: "1 day", range: "Close" },
  { key: "disintegrate", name: "Disintegrate", tier: 5, classes: ["wizard"], duration: "Instant", range: "Far", damageOrHealing: "3d8" },
  { key: "hold-monster", name: "Hold Monster", tier: 5, classes: ["wizard"], duration: "Focus", range: "Near", isFocus: true },
  { key: "power-word-kill", name: "Power Word Kill", tier: 5, classes: ["wizard"], duration: "Instant", range: "Near", failedCheckIsCrit: true },
  { key: "prismatic-orb", name: "Prismatic Orb", tier: 5, classes: ["wizard"], duration: "Instant", range: "Far", damageOrHealing: "3d8" },
  { key: "scrying", name: "Scrying", tier: 5, classes: ["wizard"], duration: "Focus", range: "Self", isFocus: true },
  { key: "shapechange", name: "Shapechange", tier: 5, classes: ["wizard"], duration: "Focus", range: "Self", isFocus: true },
  { key: "summon-extraplanar", name: "Summon Extraplanar", tier: 5, classes: ["wizard"], duration: "Focus", range: "Near", isFocus: true },
  { key: "teleport", name: "Teleport", tier: 5, classes: ["wizard"], duration: "Instant", range: "Close" },
  { key: "wish", name: "Wish", tier: 5, classes: ["wizard"], duration: "Instant", range: "Self", failedCheckIsCrit: true },
];

export const SHADOWDARK_DCS = {
  easy: 9,
  normal: 12,
  hard: 15,
  extreme: 18,
} as const;

export const LIGHT_MISHAPS = [
  { roll: 1, name: "Dud", effect: "The light source (even a magical one) goes out and needs to be replaced or recast." },
  { roll: 2, name: "Fire", effect: "The light source flares and burns your hand. Take 1 damage. DC 18 DEX or drop it." },
  { roll: 3, name: "Air", effect: "A rogue wind or pocket of thin air blows through. DC 15 DEX or the flames go out." },
  { roll: 4, name: "Water", effect: "A sudden rain shower or dripping ceiling hits the light source. DC 15 DEX or the flames go out." },
  { roll: 5, name: "Earth", effect: "Falling rocks, mud, leaves, or ash cover the light source. DC 12 DEX to protect it." },
  { roll: 6, name: "Spark", effect: "If open flame, it sparks and catches on 1d4 flammable objects within close. DC 12 DEX to extinguish each." },
] as const;

export const CAROUSING_EVENTS = [
  { costGp: 30, bonus: 0, description: "A worthy night of drinking and festivity" },
  { costGp: 100, bonus: 1, description: "A full day and night of revelry, gambling, and recounting your exploits" },
  { costGp: 300, bonus: 2, description: "Two days of crawling dozens of taverns to sing, buy rounds, and celebrate" },
  { costGp: 600, bonus: 3, description: "A three-day voyage into the finest food, drink, and gambling you can find" },
  { costGp: 900, bonus: 4, description: "A hazy, weeklong bender that runs multiple well-known taverns dry" },
  { costGp: 1200, bonus: 5, description: "A spirited fete lasting ten days that attracts hordes of revelers and takes over an entire town or city district" },
  { costGp: 1800, bonus: 6, description: "Two legendary weeks of drinking and debauchery widespread enough to take over a whole city" },
] as const;

export interface CarousingOutcomeDef {
  roll: number;
  outcome: string;
  benefit: string;
  xpGained: number;
  wealthLossPercent?: number;
  luckToken?: boolean;
}

export const CAROUSING_OUTCOMES: CarousingOutcomeDef[] = [
  { roll: 1, outcome: "You wake up blearily in your bed", benefit: "Gain 2 XP", xpGained: 2 },
  { roll: 2, outcome: "Locked in the stocks for 1d4 days and fined 20% of your total wealth for setting a building on fire", benefit: "Gain 2 XP", xpGained: 2, wealthLossPercent: 20 },
  { roll: 3, outcome: "You wake up in a gutter with 15% of your total wealth spent", benefit: "Gain 3 XP", xpGained: 3, wealthLossPercent: 15 },
  { roll: 4, outcome: "You hazily remember donating 10% of your total wealth to a glib priest", benefit: "Gain 3 XP and a priest ally", xpGained: 3, wealthLossPercent: 10 },
  { roll: 5, outcome: "You're fined 10% of your total wealth for starting a full-tavern brawl", benefit: "Gain 3 XP and be barred from a tavern", xpGained: 3, wealthLossPercent: 10 },
  { roll: 6, outcome: "The Thieves' Guild bilked you for 5% of your total wealth", benefit: "Gain 4 XP", xpGained: 4, wealthLossPercent: 5 },
  { roll: 7, outcome: "You led an entire tavern in a wildly insulting song about a disliked noble", benefit: "Gain 4 XP and a famous bard ally", xpGained: 4 },
  { roll: 8, outcome: "You survived a blindfolded knife-throwing demonstration unscathed", benefit: "Gain 4 XP and a luck token", xpGained: 4, luckToken: true },
  { roll: 9, outcome: "By talent (50%) or trickery (50%), you beat a rival crawler in a test of skill", benefit: "Gain 5 XP and an NPC ally or enemy", xpGained: 5 },
  { roll: 10, outcome: "An angry wizard cast a deadly spell at you, but you reflected it off your cup", benefit: "Gain 5 XP and a luck token", xpGained: 5, luckToken: true },
  { roll: 11, outcome: "You performed a humiliating prank on a despised and corrupt merchant", benefit: "Gain 5 XP and an ally in the City Watch", xpGained: 5 },
  { roll: 12, outcome: "You defeated a noble in a highly wagered drinking contest", benefit: "Gain 5 XP and a debt owed by the noble", xpGained: 5 },
  { roll: 13, outcome: "You pulled off an ill-advised heist inside a feared sorcerer's tower", benefit: "Gain 6 XP and an 80-100 item from your treasure table", xpGained: 6 },
  { roll: 14, outcome: "You wake up deep inside the local ruler's stronghold holding one of their priceless family heirlooms", benefit: "Gain 6 XP and a 90-100 item from your treasure table, if you escape", xpGained: 6 },
];

export const WIZARDS_AND_THIEVES_STAKES = {
  low: ["Copper", "Single drinks", "Bragging rights", "Minor baubles"],
  mid: ["Gold", "Drink rounds", "A sworn favor owed", "A personal trophy"],
  high: ["Jewelry", "Finest drink in the city", "A finger off your hand", "An irreplaceable item"],
  epic: ["Diamonds", "Rarest drink in world", "Your life", "A magic item"],
} as const;

function randomDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Exact Shadowdark stat modifier (pg. 15):
 * 1-3: -4, 4-5: -3, 6-7: -2, 8-9: -1, 10-11: 0, 12-13: +1, 14-15: +2, 16-17: +3, 18+: +4.
 */
export function shadowdarkStatModifier(score: number): number {
  const raw = Math.floor((score - 10) / 2);
  return Math.max(-4, Math.min(4, raw));
}

/**
 * Rolls 3d6 in order for STR, DEX, CON, INT, WIS, CHA with optional re-roll if no stat >= 14.
 */
export function rollShadowdarkStats(options?: {
  mulliganIfAllBelow14?: boolean;
  candidateSets?: Array<Record<ShadowdarkAbilityKey, number>>;
}): {
  scores: Record<ShadowdarkAbilityKey, number>;
  modifiers: Record<ShadowdarkAbilityKey, number>;
  attempts: number;
} {
  const mulligan = options?.mulliganIfAllBelow14 ?? true;
  const keys: ShadowdarkAbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
  let attempts = 0;

  for (let i = 0; i < 100; i += 1) {
    attempts += 1;
    let scores: Record<ShadowdarkAbilityKey, number>;
    if (options?.candidateSets && options.candidateSets[i]) {
      scores = { ...options.candidateSets[i] };
    } else {
      scores = {
        str: randomDie(6) + randomDie(6) + randomDie(6),
        dex: randomDie(6) + randomDie(6) + randomDie(6),
        con: randomDie(6) + randomDie(6) + randomDie(6),
        int: randomDie(6) + randomDie(6) + randomDie(6),
        wis: randomDie(6) + randomDie(6) + randomDie(6),
        cha: randomDie(6) + randomDie(6) + randomDie(6),
      };
    }

    const has14Plus = keys.some((k) => scores[k] >= 14);
    if (!mulligan || has14Plus || (options?.candidateSets && i >= options.candidateSets.length - 1)) {
      const modifiers = {
        str: shadowdarkStatModifier(scores.str),
        dex: shadowdarkStatModifier(scores.dex),
        con: shadowdarkStatModifier(scores.con),
        int: shadowdarkStatModifier(scores.int),
        wis: shadowdarkStatModifier(scores.wis),
        cha: shadowdarkStatModifier(scores.cha),
      };
      return { scores, modifiers, attempts };
    }
  }

  const fallback = { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  return {
    scores: fallback,
    modifiers: { str: 2, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    attempts,
  };
}

/**
 * Computes starting HP at Level 0 (Gauntlet) or Level 1 (pgs. 14, 16, 33).
 * Dwarf Stout adds +2 starting HP.
 */
export function computeShadowdarkStartingHp(params: {
  level: number;
  classKey?: string | null;
  conScore: number;
  ancestryKey?: string | null;
  hitDieRoll?: number;
  includeStoutBonus?: boolean;
}): number {
  const conMod = shadowdarkStatModifier(params.conScore);
  const stoutBonus =
    params.includeStoutBonus !== false && params.ancestryKey === "dwarf"
      ? (SHADOWDARK_ANCESTRIES.dwarf.stoutHpBonus ?? 2)
      : 0;

  if (params.level <= 0) {
    return Math.max(1, conMod) + stoutBonus;
  }

  const cls =
    params.classKey && params.classKey in SHADOWDARK_CLASSES
      ? SHADOWDARK_CLASSES[params.classKey as ShadowdarkClassKey]
      : SHADOWDARK_CLASSES.fighter;

  let dieValue: number;
  if (params.hitDieRoll !== undefined) {
    dieValue = Math.max(1, Math.min(cls.hitDie, params.hitDieRoll));
  } else {
    dieValue = cls.hitDie;
  }

  return Math.max(1, dieValue + conMod) + stoutBonus;
}

/**
 * Rolls HP gained on level-up (pgs. 16, 39). Dwarves roll with advantage.
 */
export function rollShadowdarkLevelUpHp(params: {
  classKey?: string | null;
  ancestryKey?: string | null;
  forcedRolls?: number[];
}): {
  hpGained: number;
  rolls: number[];
  hasAdvantage: boolean;
} {
  const cls =
    params.classKey && params.classKey in SHADOWDARK_CLASSES
      ? SHADOWDARK_CLASSES[params.classKey as ShadowdarkClassKey]
      : SHADOWDARK_CLASSES.fighter;
  const hasAdvantage = params.ancestryKey === "dwarf";
  const roll1 = params.forcedRolls?.[0] ?? randomDie(cls.hitDie);
  if (hasAdvantage) {
    const roll2 = params.forcedRolls?.[1] ?? randomDie(cls.hitDie);
    const best = Math.max(roll1, roll2);
    return { hpGained: Math.max(1, best), rolls: [roll1, roll2], hasAdvantage: true };
  }
  return { hpGained: Math.max(1, roll1), rolls: [roll1], hasAdvantage: false };
}

/**
 * Rolls 1d4 items from the 0-Level Starting Gear d12 table (pg. 33).
 */
export function rollLevelZeroGear(options?: {
  countRoll?: number;
  itemRolls?: number[];
}): string[] {
  const count = Math.max(1, Math.min(4, options?.countRoll ?? randomDie(4)));
  const items: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const roll = Math.max(1, Math.min(12, options?.itemRolls?.[i] ?? randomDie(12)));
    items.push(SHADOWDARK_STARTING_GEAR_D12[roll - 1]);
  }
  return items;
}

/**
 * Rolls 2d6 x 5 gold pieces for 1st-level starting gold (pg. 33).
 */
export function rollLevelOneGold(forcedDice?: [number, number]): number {
  const d1 = forcedDice ? forcedDice[0] : randomDie(6);
  const d2 = forcedDice ? forcedDice[1] : randomDie(6);
  return (d1 + d2) * 5;
}

/**
 * Looks up a character's Title by Class, Level (1-10), and Alignment (pgs. 30-31).
 */
export function getCharacterTitle(
  classKey: string | null | undefined,
  level: number,
  alignment: string | null | undefined,
): string {
  if (level <= 0 || !classKey || !(classKey in SHADOWDARK_TITLES)) {
    return "Peasant";
  }
  const normAlign: ShadowdarkAlignment =
    alignment?.toLowerCase() === "lawful"
      ? "Lawful"
      : alignment?.toLowerCase() === "chaotic"
        ? "Chaotic"
        : "Neutral";
  const brackets = SHADOWDARK_TITLES[classKey as ShadowdarkClassKey];
  const clampedLevel = Math.max(1, Math.min(10, level));
  const found =
    brackets.find((b) => clampedLevel >= b.minLevel && clampedLevel <= b.maxLevel) ??
    brackets[0];
  return found[normAlign];
}

/**
 * Talent rolls occur at odd levels 1, 3, 5, 7, 9 (pg. 39).
 */
export function isTalentRollLevel(level: number): boolean {
  return level >= 1 && level <= 9 && level % 2 === 1;
}

/**
 * Rolls on a class's 2d6 Talent Table (pgs. 18-25).
 */
export function rollClassTalent(
  classKey: string,
  forced2d6?: number,
): { roll: number; effect: string } {
  const cls =
    classKey in SHADOWDARK_CLASSES
      ? SHADOWDARK_CLASSES[classKey as ShadowdarkClassKey]
      : SHADOWDARK_CLASSES.fighter;
  const roll =
    forced2d6 !== undefined
      ? Math.max(2, Math.min(12, forced2d6))
      : randomDie(6) + randomDie(6);
  const entry =
    cls.talentsTable.find((t) => roll >= t.minRoll && roll <= t.maxRoll) ??
    cls.talentsTable[0];
  return { roll, effect: entry.effect };
}

/**
 * Checks if a character can wield a weapon based on class & level (pgs. 14, 18-24).
 * 0-level PCs can wield all gear until 1st level.
 */
export function canClassUseWeapon(
  classKey: string | null | undefined,
  level: number,
  weaponKey: string,
): boolean {
  if (level <= 0) return true;
  if (!classKey || !(classKey in SHADOWDARK_CLASSES)) return true;
  const cls = SHADOWDARK_CLASSES[classKey as ShadowdarkClassKey];
  if (cls.allowedWeapons === "all") return true;
  return cls.allowedWeapons.includes(weaponKey.toLowerCase());
}

/**
 * Checks if a character can wear armor / shield based on class & level (pgs. 14, 18-24, 33).
 * 0-level PCs can wear all armor until 1st level.
 */
export function canClassUseArmor(
  classKey: string | null | undefined,
  level: number,
  armorKey: string | null | undefined,
  shield = false,
): boolean {
  if (level <= 0) return true;
  if (!classKey || !(classKey in SHADOWDARK_CLASSES)) return true;
  const cls = SHADOWDARK_CLASSES[classKey as ShadowdarkClassKey];
  if (shield && !cls.allowsShield) return false;
  if (!armorKey) return true;
  if (cls.allowedArmor === "all") return true;
  if (cls.allowedArmor === "none") return false;
  return cls.allowedArmor.includes(armorKey.toLowerCase());
}

/**
 * Calculates Max Gear Slots and Used Gear Slots (pgs. 18, 20, 22, 35-37).
 */
export function calculateShadowdarkGearSlots(params: {
  strScore: number;
  conScore?: number;
  classKey?: string | null;
  coins?: { gp?: number; sp?: number; cp?: number };
  items?: Array<{ name: string; quantity?: number; slots?: number }>;
}): {
  maxSlots: number;
  itemSlots: number;
  coinSlots: number;
  usedSlots: number;
} {
  const conMod = shadowdarkStatModifier(params.conScore ?? 10);
  const haulerBonus = params.classKey === "fighter" && conMod > 0 ? conMod : 0;
  const maxSlots = Math.max(10, params.strScore) + haulerBonus;

  const gp = params.coins?.gp ?? 0;
  const sp = params.coins?.sp ?? 0;
  const cp = params.coins?.cp ?? 0;
  const totalCoins = gp + sp + cp;
  const coinSlots = totalCoins <= 100 ? 0 : Math.ceil((totalCoins - 100) / 100);

  let itemSlots = 0;
  let seenFirstBackpack = false;

  for (const item of params.items ?? []) {
    const qty = Math.max(1, item.quantity ?? 1);
    const lower = item.name.trim().toLowerCase();

    if (lower.includes("holy symbol") || lower.includes("thieves' tools") || lower.includes("thieves tools")) {
      continue;
    }

    if (lower === "backpack") {
      const chargeableQty = seenFirstBackpack ? qty : Math.max(0, qty - 1);
      seenFirstBackpack = true;
      itemSlots += chargeableQty;
      continue;
    }

    if (item.slots !== undefined) {
      itemSlots += item.slots;
      continue;
    }

    if (lower.startsWith("arrow") || lower.startsWith("crossbow bolt")) {
      itemSlots += Math.ceil(qty / 20);
      continue;
    }
    if (lower.startsWith("iron spike") || lower.startsWith("gem")) {
      itemSlots += Math.ceil(qty / 10);
      continue;
    }
    if (lower.startsWith("ration")) {
      itemSlots += Math.ceil(qty / 3);
      continue;
    }

    const weapon = SHADOWDARK_WEAPONS.find(
      (w) => w.key === lower || w.name.toLowerCase() === lower,
    );
    if (weapon) {
      itemSlots += weapon.slots * qty;
      continue;
    }

    const armor = SHADOWDARK_ARMOR.find(
      (a) => a.key === lower || a.name.toLowerCase() === lower,
    );
    if (armor) {
      itemSlots += armor.slots * qty;
      continue;
    }

    itemSlots += qty;
  }

  return {
    maxSlots,
    itemSlots,
    coinSlots,
    usedSlots: itemSlots + coinSlots,
  };
}

/**
 * Computes weapon attack bonus and damage formula including Finesse, Thrown, Versatile,
 * Half-Orc Mighty, Elf Farsight, Fighter Weapon Mastery, and Thief Backstab.
 */
export function computeWeaponAttackAndDamage(params: {
  weaponKey: string;
  strScore: number;
  dexScore: number;
  level: number;
  classKey?: string | null;
  ancestryKey?: string | null;
  farsightMode?: "ranged" | "spellcasting";
  weaponMasteryKeys?: string[];
  talentMeleeBonus?: number;
  talentRangedBonus?: number;
  twoHanded?: boolean;
  thrown?: boolean;
  targetUnaware?: boolean;
  extraBackstabDice?: number;
}): {
  weapon: ShadowdarkWeaponDef;
  isRangedAttack: boolean;
  attackBonus: number;
  damageBonus: number;
  diceCount: number;
  dieSides: number;
  damageFormula: string;
} {
  const weapon =
    SHADOWDARK_WEAPONS.find(
      (w) =>
        w.key === params.weaponKey.toLowerCase() ||
        w.name.toLowerCase() === params.weaponKey.toLowerCase(),
    ) ?? SHADOWDARK_WEAPONS[0];

  const strMod = shadowdarkStatModifier(params.strScore);
  const dexMod = shadowdarkStatModifier(params.dexScore);

  const isRangedAttack =
    weapon.type === "R" || (weapon.type === "M/R" && Boolean(params.thrown));
  const isFinesseOrThrown =
    weapon.properties.includes("F") ||
    (isRangedAttack && weapon.properties.includes("Th"));

  const statMod = isFinesseOrThrown
    ? Math.max(strMod, dexMod)
    : isRangedAttack
      ? dexMod
      : strMod;

  let attackBonus = statMod;
  let damageBonus = 0;

  // Half-Orc Mighty: +1 attack and damage with melee weapons
  if (params.ancestryKey === "half-orc" && !isRangedAttack) {
    attackBonus += 1;
    damageBonus += 1;
  }

  // Elf Farsight: +1 ranged weapon attacks
  if (
    params.ancestryKey === "elf" &&
    isRangedAttack &&
    (params.farsightMode ?? "ranged") === "ranged"
  ) {
    attackBonus += 1;
  }

  // Fighter Weapon Mastery: +1 + floor(level / 2) to attack and damage
  const hasMastery =
    params.classKey === "fighter" &&
    (params.weaponMasteryKeys ?? []).some(
      (k) => k.toLowerCase() === weapon.key || k.toLowerCase() === weapon.name.toLowerCase(),
    );
  if (hasMastery) {
    const masteryBonus = 1 + Math.floor(Math.max(1, params.level) / 2);
    attackBonus += masteryBonus;
    damageBonus += masteryBonus;
  }

  if (isRangedAttack) {
    attackBonus += params.talentRangedBonus ?? 0;
  } else {
    attackBonus += params.talentMeleeBonus ?? 0;
  }

  const baseDieStr =
    params.twoHanded && weapon.versatileDamage ? weapon.versatileDamage : weapon.damage;
  const match = /^(\d+)d(\d+)$/i.exec(baseDieStr) ?? ["1d6", "1", "6"];
  let diceCount = Number.parseInt(match[1], 10);
  const dieSides = Number.parseInt(match[2], 10);

  // Thief Backstab: +1 + floor(level / 2) + extraBackstabDice weapon dice on unaware targets
  if (params.classKey === "thief" && params.targetUnaware) {
    diceCount += 1 + Math.floor(Math.max(1, params.level) / 2) + (params.extraBackstabDice ?? 0);
  }

  const bonusSuffix =
    damageBonus > 0 ? `+${damageBonus}` : damageBonus < 0 ? `${damageBonus}` : "";
  const damageFormula = `${diceCount}d${dieSides}${bonusSuffix}`;

  return {
    weapon,
    isRangedAttack,
    attackBonus,
    damageBonus,
    diceCount,
    dieSides,
    damageFormula,
  };
}

/**
 * Rolls on the Wizard Mishap Table corresponding to the spell tier (pgs. 46-48).
 * Handles result 1 ("Devastation!"): rolls twice and combines both non-1 effects.
 */
export function rollWizardMishap(
  spellTier: number,
  forcedRolls?: number[],
): {
  tierGroup: "tier1_2" | "tier3_4" | "tier5";
  initialRoll: number;
  isDevastation: boolean;
  effects: WizardMishapEntry[];
} {
  const tierGroup =
    spellTier <= 2 ? "tier1_2" : spellTier <= 4 ? "tier3_4" : "tier5";
  const table = WIZARD_MISHAP_TABLES[tierGroup];

  const initialRoll = Math.max(1, Math.min(12, forcedRolls?.[0] ?? randomDie(12)));
  if (initialRoll === 1) {
    const pickNonOne = (forced?: number): WizardMishapEntry => {
      const r =
        forced !== undefined && forced >= 2 && forced <= 12
          ? forced
          : Math.floor(Math.random() * 11) + 2;
      return table[r - 1];
    };
    const e1 = pickNonOne(forcedRolls?.[1]);
    const e2 = pickNonOne(forcedRolls?.[2]);
    return {
      tierGroup,
      initialRoll: 1,
      isDevastation: true,
      effects: [e1, e2],
    };
  }

  return {
    tierGroup,
    initialRoll,
    isDevastation: false,
    effects: [table[initialRoll - 1]],
  };
}

/**
 * Resolves a Shadowdark Spellcasting Check (pgs. 44-48).
 * DC = 10 + spell tier.
 */
export function resolveSpellcastingCheck(params: {
  spellKey: string;
  casterClass: "priest" | "wizard";
  abilityScore: number;
  spellcastingBonus?: number;
  elfFarsightSpellBonus?: boolean;
  hasAdvantage?: boolean;
  hasDisadvantage?: boolean;
  forcedD20?: number;
  forcedMishapRolls?: number[];
}): {
  spell: ShadowdarkSpellDef;
  d20: number;
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  isCriticalSuccess: boolean;
  isCriticalFailure: boolean;
  doubleNumericalEffect: boolean;
  spellLost: boolean;
  penanceRequired: { spellKey: string; tier: number; sacrificeGp: number } | null;
  mishap: ReturnType<typeof rollWizardMishap> | null;
} {
  const spell =
    SHADOWDARK_SPELLS.find(
      (s) =>
        s.key === params.spellKey.toLowerCase() ||
        s.name.toLowerCase() === params.spellKey.toLowerCase(),
    ) ?? {
      key: params.spellKey,
      name: params.spellKey,
      tier: 1 as const,
      classes: [params.casterClass],
      duration: "Instant",
      range: "Near" as const,
    };

  const dc = 10 + spell.tier;
  const statMod = shadowdarkStatModifier(params.abilityScore);
  const modifier =
    statMod +
    (params.spellcastingBonus ?? 0) +
    (params.elfFarsightSpellBonus ? 1 : 0);

  const adv = Boolean(params.hasAdvantage || spell.autoAdvantage);
  const disadv = Boolean(params.hasDisadvantage);

  let d20: number;
  if (params.forcedD20 !== undefined) {
    d20 = Math.max(1, Math.min(20, params.forcedD20));
  } else if (adv && !disadv) {
    d20 = Math.max(randomDie(20), randomDie(20));
  } else if (disadv && !adv) {
    d20 = Math.min(randomDie(20), randomDie(20));
  } else {
    d20 = randomDie(20);
  }

  const total = d20 + modifier;
  const isCriticalSuccess = d20 === 20;
  const rawFailure = d20 === 1 || (!isCriticalSuccess && total < dc);
  const isCriticalFailure =
    d20 === 1 || (rawFailure && Boolean(spell.failedCheckIsCrit));
  const success = !rawFailure;

  const spellLost =
    !success || Boolean(spell.requiresRestAfterCast) || Boolean(spell.requiresPenanceAfterCast);

  let penanceRequired: { spellKey: string; tier: number; sacrificeGp: number } | null = null;
  if (
    (params.casterClass === "priest" && isCriticalFailure) ||
    (success && spell.requiresPenanceAfterCast)
  ) {
    penanceRequired = {
      spellKey: spell.key,
      tier: spell.tier,
      sacrificeGp: PRIEST_PENANCE_SACRIFICE_GP[spell.tier] ?? 5,
    };
  }

  let mishap: ReturnType<typeof rollWizardMishap> | null = null;
  if (params.casterClass === "wizard" && isCriticalFailure) {
    mishap = rollWizardMishap(spell.tier, params.forcedMishapRolls);
  }

  return {
    spell,
    d20,
    modifier,
    total,
    dc,
    success,
    isCriticalSuccess,
    isCriticalFailure,
    doubleNumericalEffect: isCriticalSuccess,
    spellLost,
    penanceRequired,
    mishap,
  };
}

/**
 * Resolves a Focus Spell Maintenance Check (pg. 50).
 * Normal failure ends focus without losing the ability to cast the spell again.
 * Critical failure (Nat 1) ends focus AND triggers standard critical failure.
 */
export function resolveFocusCheck(params: {
  spellKey: string;
  casterClass: "priest" | "wizard";
  abilityScore: number;
  spellcastingBonus?: number;
  forcedD20?: number;
  forcedMishapRolls?: number[];
}): {
  maintained: boolean;
  focusEnded: boolean;
  spellLost: boolean;
  isCriticalFailure: boolean;
  penanceRequired: { spellKey: string; tier: number; sacrificeGp: number } | null;
  mishap: ReturnType<typeof rollWizardMishap> | null;
} {
  const check = resolveSpellcastingCheck(params);
  if (check.success) {
    return {
      maintained: true,
      focusEnded: false,
      spellLost: false,
      isCriticalFailure: false,
      penanceRequired: null,
      mishap: null,
    };
  }

  if (check.isCriticalFailure) {
    return {
      maintained: false,
      focusEnded: true,
      spellLost: true,
      isCriticalFailure: true,
      penanceRequired: check.penanceRequired,
      mishap: check.mishap,
    };
  }

  return {
    maintained: false,
    focusEnded: true,
    spellLost: false,
    isCriticalFailure: false,
    penanceRequired: null,
    mishap: null,
  };
}

/**
 * Resolves casting a spell from a Scroll or Wand (pg. 49).
 */
export function resolveScrollOrWandCast(params: {
  itemType: "scroll" | "wand";
  spellKey: string;
  casterClass: "priest" | "wizard";
  abilityScore: number;
  spellcastingBonus?: number;
  forcedD20?: number;
  forcedMishapRolls?: number[];
}): {
  success: boolean;
  isCriticalFailure: boolean;
  knownSpellLost: boolean;
  itemExpendedOrBroken: boolean;
  wandStoppedUntilRest: boolean;
  mishap: ReturnType<typeof rollWizardMishap> | null;
} {
  const check = resolveSpellcastingCheck(params);
  const isScroll = params.itemType === "scroll";
  return {
    success: check.success,
    isCriticalFailure: check.isCriticalFailure,
    knownSpellLost: false,
    itemExpendedOrBroken: isScroll ? true : check.isCriticalFailure,
    wandStoppedUntilRest: !isScroll && !check.success && !check.isCriticalFailure,
    mishap: check.isCriticalFailure && params.casterClass === "wizard" ? check.mishap : null,
  };
}

/**
 * Resolves a Wizard studying a spell scroll for 1 day to learn the spell (pg. 24: DC 15 INT).
 */
export function resolveLearnSpellFromScroll(params: {
  spellKey: string;
  intScore: number;
  forcedD20?: number;
}): {
  spellKey: string;
  d20: number;
  intModifier: number;
  total: number;
  dc: number;
  learned: boolean;
  scrollExpended: boolean;
} {
  const d20 = params.forcedD20 ?? randomDie(20);
  const intModifier = shadowdarkStatModifier(params.intScore);
  const total = d20 + intModifier;
  const dc = 15;
  const learned = d20 === 20 || (d20 !== 1 && total >= dc);
  return {
    spellKey: params.spellKey,
    d20,
    intModifier,
    total,
    dc,
    learned,
    scrollExpended: true,
  };
}

/**
 * The d6 Decider (pg. 78): 1-3 worse outcome, 4-6 better outcome.
 */
export function rollD6Decider(forcedRoll?: number): {
  roll: number;
  betterOutcome: boolean;
} {
  const roll = Math.max(1, Math.min(6, forcedRoll ?? randomDie(6)));
  return { roll, betterOutcome: roll >= 4 };
}

/**
 * Manages Light Source Timers (pgs. 82, 84, 86, 110, 111):
 * - Standard duration: 60 minutes real-time (10 rounds); Blitz mode: 30 minutes (5 rounds).
 * - Multi-light options: "ride-along" vs "extinguish-and-reset".
 * - Campfire: 3 torches = 8 hours (480 minutes).
 */
export function manageLightSource(params: {
  mode: "ride-along" | "extinguish-and-reset" | "campfire";
  currentRemainingMinutes?: number;
  blitzMode?: boolean;
  torchesAvailable?: number;
}): {
  mode: string;
  remainingMinutes: number;
  remainingRounds: number;
  torchesConsumed: number;
  immovable: boolean;
} {
  const standardMinutes = params.blitzMode ? 30 : 60;
  if (params.mode === "campfire") {
    if ((params.torchesAvailable ?? 3) < 3) {
      throw new Error("At least 3 torches are required to build a campfire");
    }
    return {
      mode: "campfire",
      remainingMinutes: 480,
      remainingRounds: 80,
      torchesConsumed: 3,
      immovable: true,
    };
  }

  if (params.mode === "ride-along") {
    const mins = params.currentRemainingMinutes ?? standardMinutes;
    return {
      mode: "ride-along",
      remainingMinutes: mins,
      remainingRounds: Math.ceil(mins / 6),
      torchesConsumed: 1,
      immovable: false,
    };
  }

  return {
    mode: "extinguish-and-reset",
    remainingMinutes: standardMinutes,
    remainingRounds: Math.ceil(standardMinutes / 6),
    torchesConsumed: 1,
    immovable: false,
  };
}

/**
 * Rolls on the d6 Light Mishaps table (pg. 110).
 */
export function rollLightMishap(forcedRoll?: number) {
  const roll = Math.max(1, Math.min(6, forcedRoll ?? randomDie(6)));
  return LIGHT_MISHAPS[roll - 1];
}

/**
 * Morale Check (pg. 89): DC 15 Wisdom check when reduced to half numbers or half HP.
 */
export function rollMoraleCheck(params: {
  wisModifier: number;
  forcedD20?: number;
}): {
  d20: number;
  total: number;
  dc: number;
  passed: boolean;
  flee: boolean;
} {
  const d20 = params.forcedD20 ?? randomDie(20);
  const total = d20 + params.wisModifier;
  const dc = 15;
  const passed = d20 === 20 || (d20 !== 1 && total >= dc);
  return { d20, total, dc, passed, flee: !passed };
}

/**
 * Death Timer (pgs. 89, 111, 116):
 * - 1d4 + CON mod (minimum 1) rounds.
 * - Deadly Mode: always 1 round.
 * - Fatality Mode or Level 0 Gauntlet: instant death at 0 HP.
 */
export function rollDeathTimer(params: {
  conScore: number;
  level?: number;
  forcedD4?: number;
  deadlyMode?: boolean;
  fatalityMode?: boolean;
}): {
  rounds: number;
  instantDeath: boolean;
} {
  if (params.fatalityMode || (params.level !== undefined && params.level <= 0)) {
    return { rounds: 0, instantDeath: true };
  }
  if (params.deadlyMode) {
    return { rounds: 1, instantDeath: false };
  }
  const d4 = Math.max(1, Math.min(4, params.forcedD4 ?? randomDie(4)));
  const conMod = shadowdarkStatModifier(params.conScore);
  const rounds = Math.max(1, d4 + conMod);
  return { rounds, instantDeath: false };
}

/**
 * Dying Turn Roll (pg. 89): roll a d20 on turn; natural 20 = rise with 1 HP.
 */
export function rollDyingTurn(params: {
  remainingRounds: number;
  forcedD20?: number;
}): {
  d20: number;
  risesWithOneHp: boolean;
  remainingRounds: number;
  dying: boolean;
  dead: boolean;
} {
  const d20 = params.forcedD20 ?? randomDie(20);
  if (d20 === 20) {
    return {
      d20,
      risesWithOneHp: true,
      remainingRounds: 0,
      dying: false,
      dead: false,
    };
  }
  const nextRemaining = Math.max(0, params.remainingRounds - 1);
  return {
    d20,
    risesWithOneHp: false,
    remainingRounds: nextRemaining,
    dying: nextRemaining > 0,
    dead: nextRemaining === 0,
  };
}

/**
 * Stabilize Check (pgs. 89, 111): Close range, DC 15 INT check (DC 18 in Deadly Mode).
 */
export function resolveStabilizeCheck(params: {
  intScore: number;
  deadlyMode?: boolean;
  forcedD20?: number;
}): {
  d20: number;
  total: number;
  dc: number;
  stabilized: boolean;
} {
  const dc = params.deadlyMode ? 18 : 15;
  const d20 = params.forcedD20 ?? randomDie(20);
  const intMod = shadowdarkStatModifier(params.intScore);
  const total = d20 + intMod;
  const stabilized = d20 === 20 || (d20 !== 1 && total >= dc);
  return { d20, total, dc, stabilized };
}

/**
 * Resolves Resting (pgs. 86, 111):
 * - Consumes 1 ration, 8 hours sleep.
 * - Interruption requires DC 12 CON check; failure consumes ration with no benefit.
 * - Grinder Mode: regains 1 HP die roll (advantage for Dwarf) and 1d4 lost spells.
 */
export function resolveRest(params: {
  hpCurrent: number;
  hpMax: number;
  rations?: number;
  interrupted?: boolean;
  conScore?: number;
  forcedInterruptionD20?: number;
  grinderMode?: boolean;
  classKey?: string | null;
  ancestryKey?: string | null;
  forcedHitDieRoll?: number;
  lostSpells?: string[];
}): {
  success: boolean;
  rationsRemaining: number;
  hpCurrent: number;
  lostSpells: string[];
} {
  const rationsAvailable = params.rations ?? 1;
  if (rationsAvailable <= 0) {
    return {
      success: false,
      rationsRemaining: 0,
      hpCurrent: params.hpCurrent,
      lostSpells: params.lostSpells ?? [],
    };
  }

  const rationsRemaining = rationsAvailable - 1;

  if (params.interrupted) {
    const d20 = params.forcedInterruptionD20 ?? randomDie(20);
    const conMod = shadowdarkStatModifier(params.conScore ?? 10);
    const passed = d20 === 20 || (d20 !== 1 && d20 + conMod >= 12);
    if (!passed) {
      return {
        success: false,
        rationsRemaining,
        hpCurrent: params.hpCurrent,
        lostSpells: params.lostSpells ?? [],
      };
    }
  }

  if (params.grinderMode) {
    const lvlRoll = rollShadowdarkLevelUpHp({
      classKey: params.classKey,
      ancestryKey: params.ancestryKey,
      forcedRolls: params.forcedHitDieRoll ? [params.forcedHitDieRoll] : undefined,
    });
    const nextHp = Math.min(params.hpMax, params.hpCurrent + lvlRoll.hpGained);
    const regainedCount = randomDie(4);
    const remainingLost = (params.lostSpells ?? []).slice(regainedCount);
    return {
      success: true,
      rationsRemaining,
      hpCurrent: nextHp,
      lostSpells: remainingLost,
    };
  }

  return {
    success: true,
    rationsRemaining,
    hpCurrent: params.hpMax,
    lostSpells: [],
  };
}

/**
 * Resolves Carousing (pgs. 92-93): 1d8 + event bonus.
 */
export function resolveCarousing(params: {
  eventCostGp: number;
  forcedD8?: number;
}): {
  event: (typeof CAROUSING_EVENTS)[number];
  d8: number;
  bonus: number;
  totalRoll: number;
  outcome: string;
  benefit: string;
  xpGained: number;
  wealthLossPercent: number;
  luckTokenGained: boolean;
} {
  const event =
    CAROUSING_EVENTS.find((e) => e.costGp === params.eventCostGp) ??
    CAROUSING_EVENTS[0];
  const d8 = Math.max(1, Math.min(8, params.forcedD8 ?? randomDie(8)));
  const totalRoll = Math.min(14, Math.max(1, d8 + event.bonus));
  const outcomeEntry =
    CAROUSING_OUTCOMES.find((o) => o.roll === totalRoll) ??
    CAROUSING_OUTCOMES[CAROUSING_OUTCOMES.length - 1];

  return {
    event,
    d8,
    bonus: event.bonus,
    totalRoll,
    outcome: outcomeEntry.outcome,
    benefit: outcomeEntry.benefit,
    xpGained: outcomeEntry.xpGained,
    wealthLossPercent: outcomeEntry.wealthLossPercent ?? 0,
    luckTokenGained: Boolean(outcomeEntry.luckToken),
  };
}

/**
 * Resolves a turn in the Wizards and Thieves dice game (pgs. 94-95).
 */
export function playWizardsAndThievesTurn(params: {
  declared: "wizard" | "thief";
  pot: number;
  otherPlayersCount: number;
  forcedDice?: [number, number, number];
}): {
  dice: [number, number, number];
  gameEnded: boolean;
  activePlayerGoesAgain: boolean;
  potAfter: number;
  activePlayerDelta: number;
  eachOtherPlayerGets: number;
  activePlayerRemainder: number;
  summary: string;
} {
  const dice: [number, number, number] = params.forcedDice ?? [
    randomDie(6),
    randomDie(6),
    randomDie(6),
  ];

  const rawWizards = dice.filter((d) => d === 6).length;
  const rawThieves = dice.filter((d) => d === 1).length;

  // Rolled 3 wizards (6, 6, 6): active player takes whole pot, game ends.
  if (rawWizards === 3) {
    return {
      dice,
      gameEnded: true,
      activePlayerGoesAgain: false,
      potAfter: 0,
      activePlayerDelta: params.pot,
      eachOtherPlayerGets: 0,
      activePlayerRemainder: 0,
      summary: "Rolled 3 wizards! Active player takes the whole pot.",
    };
  }

  // Rolled 3 thieves (1, 1, 1): pot split evenly among remaining players; active gets remainder.
  if (rawThieves === 3) {
    const others = Math.max(1, params.otherPlayersCount);
    const eachOtherPlayerGets = Math.floor(params.pot / others);
    const activePlayerRemainder = params.pot % others;
    return {
      dice,
      gameEnded: true,
      activePlayerGoesAgain: false,
      potAfter: 0,
      activePlayerDelta: activePlayerRemainder,
      eachOtherPlayerGets,
      activePlayerRemainder,
      summary: "Rolled 3 thieves! Honor among thieves splits the pot.",
    };
  }

  // Cancel 6s and 1s one-for-one
  const cancelled = Math.min(rawWizards, rawThieves);
  const netWizards = rawWizards - cancelled;
  const netThieves = rawThieves - cancelled;

  // Remaining dice after cancellations, ignoring 1 and 6 unless no other die type remains
  const nonExtreme = dice.filter((d) => d !== 1 && d !== 6);
  const lowestRemaining =
    nonExtreme.length > 0
      ? Math.min(...nonExtreme)
      : netWizards > 0
        ? 6
        : netThieves > 0
          ? 1
          : Math.min(...dice);

  const majority: "wizard" | "thief" | "none" =
    netWizards > netThieves
      ? "wizard"
      : netThieves > netWizards
        ? "thief"
        : "none";

  if (majority === "none") {
    return {
      dice,
      gameEnded: params.pot <= 0,
      activePlayerGoesAgain: false,
      potAfter: params.pot,
      activePlayerDelta: 0,
      eachOtherPlayerGets: 0,
      activePlayerRemainder: 0,
      summary: "No wizard or thief majority; play passes to the next player.",
    };
  }

  if (params.declared === "thief" && majority === "thief") {
    const taken = Math.min(params.pot, lowestRemaining);
    const potAfter = params.pot - taken;
    return {
      dice,
      gameEnded: potAfter === 0,
      activePlayerGoesAgain: potAfter > 0,
      potAfter,
      activePlayerDelta: taken,
      eachOtherPlayerGets: 0,
      activePlayerRemainder: 0,
      summary: `Declared thief, rolled majority thieves: took ${taken} from pot and goes again.`,
    };
  }

  if (params.declared === "wizard" && majority === "wizard") {
    const addedByOthers = lowestRemaining * Math.max(1, params.otherPlayersCount);
    const potAfter = params.pot + addedByOthers;
    return {
      dice,
      gameEnded: false,
      activePlayerGoesAgain: true,
      potAfter,
      activePlayerDelta: 0,
      eachOtherPlayerGets: -lowestRemaining,
      activePlayerRemainder: 0,
      summary: `Declared wizard, rolled majority wizards: others add ${lowestRemaining} each to pot; active player goes again.`,
    };
  }

  // Declared thief + rolled majority wizards OR Declared wizard + rolled majority thieves
  const potAfter = params.pot + lowestRemaining;
  return {
    dice,
    gameEnded: false,
    activePlayerGoesAgain: false,
    potAfter,
    activePlayerDelta: -lowestRemaining,
    eachOtherPlayerGets: 0,
    activePlayerRemainder: 0,
    summary: `Declared ${params.declared}, rolled majority ${majority}: active player adds ${lowestRemaining} to pot; play passes.`,
  };
}

/**
 * Awards XP for Treasure Quality (pg. 117):
 * Poor = 0, Normal = 1, Fabulous = 3, Legendary = 10.
 */
export function awardTreasureQualityXp(
  quality: "poor" | "normal" | "fabulous" | "legendary" | "clever-thinking",
): number {
  switch (quality) {
    case "poor":
      return 0;
    case "normal":
    case "clever-thinking":
      return 1;
    case "fabulous":
      return 3;
    case "legendary":
      return 10;
  }
}

/**
 * Hunter Mode optional rule (pg. 111): Defeated monsters grant XP equal to floor(level / 2).
 */
export function computeHunterModeMonsterXp(monsterLevel: number): number {
  return Math.max(0, Math.floor(monsterLevel / 2));
}

export interface GeneratedShadowdarkCharacter {
  name: string;
  level: number;
  ancestryId: ShadowdarkAncestryKey;
  classId: ShadowdarkClassKey | null;
  backgroundId: string;
  abilities: Record<ShadowdarkAbilityKey, number>;
  hpMax: number;
  hpCurrent: number;
  armorId: string | null;
  shield: boolean;
  extras: {
    alignment: ShadowdarkAlignment;
    deity: string;
    title: string;
    languages: string[];
    talents: string[];
    spells: string[];
    weapons: string[];
    weaponMastery: string[];
    gear: Array<{ name: string; quantity: number; slots: number; type: string }>;
    coins: { gp: number; sp: number; cp: number };
    notes: string;
  };
}

/**
 * Generates a Random 0-Level or 1st-Level Shadowdark Character (pgs. 40-41).
 */
export function generateRandomShadowdarkCharacter(options?: {
  level?: 0 | 1;
  name?: string;
  forcedAncestryRoll?: number;
  forcedClassRoll?: number;
  forcedBackgroundRoll?: number;
  forcedAlignmentRoll?: number;
  forcedDeityRoll?: number;
  forcedNameRoll?: number;
}): GeneratedShadowdarkCharacter {
  const level = options?.level ?? 1;
  const { scores } = rollShadowdarkStats({ mulliganIfAllBelow14: true });

  // d12 Ancestry (pg. 40)
  const ancRoll = options?.forcedAncestryRoll ?? randomDie(12);
  const ancestryId: ShadowdarkAncestryKey =
    ancRoll <= 4
      ? "human"
      : ancRoll <= 6
        ? "elf"
        : ancRoll <= 8
          ? "dwarf"
          : ancRoll <= 10
            ? "halfling"
            : ancRoll === 11
              ? "half-orc"
              : "goblin";

  // d4 Class (pg. 40) for Level 1
  const clsRoll = options?.forcedClassRoll ?? randomDie(4);
  const classId: ShadowdarkClassKey | null =
    level === 0
      ? null
      : clsRoll === 1
        ? "fighter"
        : clsRoll === 2
          ? "priest"
          : clsRoll === 3
            ? "thief"
            : "wizard";

  // d20 Background (pg. 26)
  const bgRoll = Math.max(1, Math.min(20, options?.forcedBackgroundRoll ?? randomDie(20)));
  const background = SHADOWDARK_BACKGROUNDS[bgRoll - 1];

  // d6 Alignment (pg. 41: 1-3 Lawful, 4-5 Neutral, 6 Chaotic)
  const alignRoll = options?.forcedAlignmentRoll ?? randomDie(6);
  const alignment: ShadowdarkAlignment =
    alignRoll <= 3 ? "Lawful" : alignRoll <= 5 ? "Neutral" : "Chaotic";

  // d8 Deity (pg. 40)
  const deityRoll = options?.forcedDeityRoll ?? randomDie(8);
  const deityNames = [
    "Saint Terragnis",
    "Saint Terragnis",
    "Gede",
    "Madeera the Covenant",
    "Ord",
    "Memnon",
    "Shune the Vile",
    "Ramlaat",
  ];
  const deity = deityNames[Math.max(1, Math.min(8, deityRoll)) - 1];

  // d20 Name (pg. 38)
  const nameRoll = Math.max(1, Math.min(20, options?.forcedNameRoll ?? randomDie(20)));
  const name = options?.name?.trim() || SHADOWDARK_NAMES[ancestryId][nameRoll - 1];

  const ancestryDef = SHADOWDARK_ANCESTRIES[ancestryId];
  const languages = [...ancestryDef.languages];
  if (ancestryDef.extraCommonLanguages && !languages.includes("Elvish")) {
    languages.push("Elvish");
  }
  if (classId === "priest" && !languages.includes("Celestial")) {
    languages.push("Celestial");
  }
  if (classId === "wizard") {
    if (!languages.includes("Draconic")) languages.push("Draconic");
    if (!languages.includes("Primordial")) languages.push("Primordial");
  }

  const talents: string[] = [`${ancestryDef.traitName}: ${ancestryDef.traitDescription}`];
  const spells: string[] = [];
  const weapons: string[] = [];
  const weaponMastery: string[] = [];
  const gear: Array<{ name: string; quantity: number; slots: number; type: string }> = [];
  let armorId: string | null = null;
  let gp = 0;

  if (level === 0) {
    const rolledItems = rollLevelZeroGear();
    for (const item of rolledItems) {
      gear.push({ name: item, quantity: 1, slots: 1, type: "sundry" });
    }
  } else if (classId) {
    const t1 = rollClassTalent(classId);
    talents.push(t1.effect);
    if (ancestryId === "human") {
      const t2 = rollClassTalent(classId);
      talents.push(`Ambitious: ${t2.effect}`);
    }

    if (classId === "fighter") {
      weapons.push("longsword");
      weaponMastery.push("longsword");
      armorId = "leather";
    } else if (classId === "priest") {
      weapons.push("mace");
      armorId = "leather";
      spells.push("turn-undead", "cure-wounds", "light");
    } else if (classId === "thief") {
      weapons.push("shortsword", "dagger");
      armorId = "leather";
    } else if (classId === "wizard") {
      weapons.push("staff", "dagger");
      armorId = null;
      spells.push("light", "magic-missile", "burning-hands");
    }

    for (const kitItem of SHADOWDARK_CRAWLING_KIT.items) {
      gear.push({
        name: kitItem.name,
        quantity: kitItem.quantity,
        slots: kitItem.slots,
        type: "sundry",
      });
    }
    for (const wKey of weapons) {
      const wDef = SHADOWDARK_WEAPONS.find((w) => w.key === wKey);
      if (wDef) {
        gear.push({ name: wDef.name, quantity: 1, slots: wDef.slots, type: "weapon" });
      }
    }
    if (armorId === "leather") {
      gear.push({ name: "Leather armor", quantity: 1, slots: 1, type: "armor" });
    }
    gp = 5;
  }

  const hpMax = computeShadowdarkStartingHp({
    level,
    classKey: classId,
    conScore: scores.con,
    ancestryKey: ancestryId,
  });

  const title = getCharacterTitle(classId, level, alignment);

  return {
    name,
    level,
    ancestryId,
    classId,
    backgroundId: background.key,
    abilities: scores,
    hpMax,
    hpCurrent: hpMax,
    armorId,
    shield: false,
    extras: {
      alignment,
      deity,
      title,
      languages,
      talents,
      spells,
      weapons,
      weaponMastery,
      gear,
      coins: { gp, sp: 0, cp: 0 },
      notes: "",
    },
  };
}

export interface ShadowdarklingsCharacterJson {
  [key: string]: unknown;
  name: string;
  stats: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };
  rolledStats: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };
  ancestry: string;
  class: string;
  level: number;
  levels: Array<Record<string, unknown>>;
  XP: number;
  ambitiousTalent: Record<string, unknown> | null;
  title: string;
  alignment: string;
  background: string;
  deity: string;
  maxHitPoints: number;
  armorClass: number;
  gearSlotsTotal: number;
  gearSlotsUsed: number;
  goldRolled: number;
  gold: number;
  silver: number;
  copper: number;
  gear: Array<{
    instanceId?: string;
    name: string;
    type: string;
    quantity: number;
    slots: number;
    cost?: number;
    currency?: string;
  }>;
  treasures: unknown[];
  magicItems: unknown[];
  attacks: string[];
  bonuses: Array<{
    name: string;
    bonusName: string;
    bonusTo: string;
    type: string;
    gainedAtLevel: number;
  }>;
  talents: Array<{
    name: string;
    source: string;
    gainedAtLevel: number;
    notes?: string;
  }>;
  spellsKnown: string;
  languages: string;
  ledger: unknown[];
}

/**
 * Exports a sheet/character into full Shadowdarklings-compatible JSON format.
 */
export function exportToShadowdarklings(sheet: {
  name: string;
  level: number;
  xp?: number;
  ancestryId?: string | null;
  classId?: string | null;
  backgroundId?: string | null;
  hpMax: number;
  armorId?: string | null;
  shield?: boolean;
  abilities: Record<string, number | { score: number; modifier: number }>;
  extras?: {
    alignment?: string;
    deity?: string;
    title?: string;
    languages?: string[];
    talents?: string[];
    spells?: string[];
    weapons?: string[];
    weaponMastery?: string[];
    gear?: Array<{ name: string; quantity?: number; slots?: number; type?: string }>;
    coins?: Record<string, number>;
  };
}): ShadowdarklingsCharacterJson {
  const getScore = (k: string): number => {
    const val = sheet.abilities[k];
    if (typeof val === "number") return val;
    if (val && typeof val === "object" && typeof val.score === "number") return val.score;
    return 10;
  };

  const stats = {
    STR: getScore("str"),
    DEX: getScore("dex"),
    CON: getScore("con"),
    INT: getScore("int"),
    WIS: getScore("wis"),
    CHA: getScore("cha"),
  };

  const ancestryDef =
    sheet.ancestryId && sheet.ancestryId in SHADOWDARK_ANCESTRIES
      ? SHADOWDARK_ANCESTRIES[sheet.ancestryId as ShadowdarkAncestryKey]
      : SHADOWDARK_ANCESTRIES.human;

  const classDef =
    sheet.classId && sheet.classId in SHADOWDARK_CLASSES
      ? SHADOWDARK_CLASSES[sheet.classId as ShadowdarkClassKey]
      : null;

  const bgDef = SHADOWDARK_BACKGROUNDS.find((b) => b.key === sheet.backgroundId);
  const alignment = (sheet.extras?.alignment as ShadowdarkAlignment) ?? "Neutral";
  const deity = sheet.extras?.deity ?? "None";
  const title =
    sheet.extras?.title || getCharacterTitle(sheet.classId, sheet.level, alignment);

  const gearList: ShadowdarklingsCharacterJson["gear"] = (sheet.extras?.gear ?? []).map(
    (g, idx) => ({
      instanceId: `gear-${idx + 1}`,
      name: g.name,
      type: g.type ?? "sundry",
      quantity: g.quantity ?? 1,
      slots: g.slots ?? 1,
    }),
  );

  if (sheet.armorId && !gearList.some((g) => g.type === "armor")) {
    const arm = SHADOWDARK_ARMOR.find((a) => a.key === sheet.armorId);
    if (arm) {
      gearList.push({
        instanceId: "armor-1",
        name: arm.name,
        type: "armor",
        quantity: 1,
        slots: arm.slots,
      });
    }
  }
  if (sheet.shield && !gearList.some((g) => g.name.toLowerCase() === "shield")) {
    gearList.push({
      instanceId: "shield-1",
      name: "Shield",
      type: "armor",
      quantity: 1,
      slots: 1,
    });
  }
  for (const wKey of sheet.extras?.weapons ?? []) {
    const wDef = SHADOWDARK_WEAPONS.find(
      (w) => w.key === wKey.toLowerCase() || w.name.toLowerCase() === wKey.toLowerCase(),
    );
    if (
      wDef &&
      !gearList.some((g) => g.name.toLowerCase() === wDef.name.toLowerCase())
    ) {
      gearList.push({
        instanceId: `weapon-${wDef.key}`,
        name: wDef.name,
        type: "weapon",
        quantity: 1,
        slots: wDef.slots,
      });
    }
  }

  const coins = sheet.extras?.coins ?? {};
  const slotCalc = calculateShadowdarkGearSlots({
    strScore: stats.STR,
    conScore: stats.CON,
    classKey: sheet.classId,
    coins: { gp: coins.gp ?? 0, sp: coins.sp ?? 0, cp: coins.cp ?? 0 },
    items: gearList,
  });

  const dexMod = shadowdarkStatModifier(stats.DEX);
  const armorObj = SHADOWDARK_ARMOR.find((a) => a.key === sheet.armorId);
  let ac = armorObj
    ? armorObj.baseAc + (armorObj.dexMode === "full" ? dexMod : 0)
    : 10 + dexMod;
  if (sheet.shield) ac += 2;

  const languages =
    sheet.extras?.languages && sheet.extras.languages.length > 0
      ? sheet.extras.languages.join(", ")
      : ancestryDef.languages.join(", ");

  return {
    name: sheet.name,
    stats,
    rolledStats: { ...stats },
    ancestry: ancestryDef.name,
    class: classDef ? classDef.name : "Level 0",
    level: sheet.level,
    levels: [],
    XP: sheet.xp ?? 0,
    ambitiousTalent: null,
    title,
    alignment,
    background: bgDef ? bgDef.name : (sheet.backgroundId ?? "Urchin"),
    deity,
    maxHitPoints: sheet.hpMax,
    armorClass: ac,
    gearSlotsTotal: slotCalc.maxSlots,
    gearSlotsUsed: slotCalc.usedSlots,
    goldRolled: coins.gp ?? 0,
    gold: coins.gp ?? 0,
    silver: coins.sp ?? 0,
    copper: coins.cp ?? 0,
    gear: gearList,
    treasures: [],
    magicItems: [],
    attacks: [],
    bonuses: [],
    talents: (sheet.extras?.talents ?? []).map((t) => ({
      name: t,
      source: "Class",
      gainedAtLevel: 1,
    })),
    spellsKnown: (sheet.extras?.spells ?? []).join(", "),
    languages,
    ledger: [],
  };
}

/**
 * Imports a Shadowdarklings JSON document into our internal CharacterSheet creation structure.
 */
export function importFromShadowdarklings(doc: Record<string, unknown>): {
  name: string;
  level: number;
  xp: number;
  ancestryId: string | null;
  classId: string | null;
  backgroundId: string | null;
  abilities: Record<ShadowdarkAbilityKey, number>;
  hpMax: number;
  hpCurrent: number;
  armorId: string | null;
  shield: boolean;
  extras: {
    alignment: ShadowdarkAlignment;
    deity: string;
    title: string;
    languages: string[];
    talents: string[];
    spells: string[];
    weapons: string[];
    weaponMastery: string[];
    gear: Array<{ name: string; quantity: number; slots: number; type: string }>;
    coins: { gp: number; sp: number; cp: number };
    notes: string;
  };
} {
  const name =
    typeof doc.name === "string" && doc.name.trim().length > 0
      ? doc.name.trim()
      : "Unnamed Crawler";
  const level =
    typeof doc.level === "number" ? Math.max(0, Math.min(10, Math.trunc(doc.level))) : 1;
  const xp = typeof doc.XP === "number" ? Math.max(0, Math.trunc(doc.XP)) : 0;

  const statsObj = (doc.stats ?? doc.rolledStats ?? {}) as Record<string, unknown>;
  const getStat = (upper: string, lower: string): number => {
    const v = statsObj[upper] ?? statsObj[lower];
    return typeof v === "number" ? Math.max(3, Math.min(18, Math.trunc(v))) : 10;
  };

  const abilities: Record<ShadowdarkAbilityKey, number> = {
    str: getStat("STR", "str"),
    dex: getStat("DEX", "dex"),
    con: getStat("CON", "con"),
    int: getStat("INT", "int"),
    wis: getStat("WIS", "wis"),
    cha: getStat("CHA", "cha"),
  };

  const rawAncestry = typeof doc.ancestry === "string" ? doc.ancestry.trim().toLowerCase() : "";
  const matchedAncestry = Object.values(SHADOWDARK_ANCESTRIES).find(
    (a) => a.key === rawAncestry || a.name.toLowerCase() === rawAncestry,
  );
  const ancestryId = matchedAncestry ? matchedAncestry.key : "human";

  const rawClass = typeof doc.class === "string" ? doc.class.trim().toLowerCase() : "";
  const matchedClass = Object.values(SHADOWDARK_CLASSES).find(
    (c) => c.key === rawClass || c.name.toLowerCase() === rawClass,
  );
  const classId = matchedClass ? matchedClass.key : level === 0 ? null : "fighter";

  const rawBg = typeof doc.background === "string" ? doc.background.trim().toLowerCase() : "";
  const matchedBg = SHADOWDARK_BACKGROUNDS.find(
    (b) => b.key === rawBg || b.name.toLowerCase() === rawBg,
  );
  const backgroundId = matchedBg ? matchedBg.key : "urchin";

  const rawAlign = typeof doc.alignment === "string" ? doc.alignment.trim().toLowerCase() : "";
  const alignment: ShadowdarkAlignment =
    rawAlign === "lawful" ? "Lawful" : rawAlign === "chaotic" ? "Chaotic" : "Neutral";

  const deity = typeof doc.deity === "string" ? doc.deity.trim() : "None";
  const title =
    typeof doc.title === "string" && doc.title.trim().length > 0
      ? doc.title.trim()
      : getCharacterTitle(classId, level, alignment);

  const rawGear = Array.isArray(doc.gear) ? doc.gear : [];
  let armorId: string | null = null;
  let shield = false;
  const weapons: string[] = [];
  const gear: Array<{ name: string; quantity: number; slots: number; type: string }> = [];

  for (const item of rawGear) {
    if (!item || typeof item !== "object") continue;
    const itemObj = item as Record<string, unknown>;
    const itemName = typeof itemObj.name === "string" ? itemObj.name.trim() : "";
    if (!itemName) continue;
    const lowerName = itemName.toLowerCase();
    const qty = typeof itemObj.quantity === "number" ? itemObj.quantity : 1;
    const slots = typeof itemObj.slots === "number" ? itemObj.slots : 1;
    const type = typeof itemObj.type === "string" ? itemObj.type : "sundry";

    gear.push({ name: itemName, quantity: qty, slots, type });

    if (lowerName === "shield") {
      shield = true;
    } else {
      const matchedArmor = SHADOWDARK_ARMOR.find(
        (a) => a.key === lowerName || a.name.toLowerCase() === lowerName || lowerName.includes(a.key),
      );
      if (matchedArmor) {
        armorId = matchedArmor.key;
      }
    }

    const matchedWeapon = SHADOWDARK_WEAPONS.find(
      (w) => w.key === lowerName || w.name.toLowerCase() === lowerName,
    );
    if (matchedWeapon && !weapons.includes(matchedWeapon.key)) {
      weapons.push(matchedWeapon.key);
    }
  }

  const rawTalents = Array.isArray(doc.talents) ? doc.talents : [];
  const talents: string[] = [];
  for (const t of rawTalents) {
    if (typeof t === "string" && t.trim()) {
      talents.push(t.trim());
    } else if (t && typeof t === "object") {
      const tObj = t as Record<string, unknown>;
      const tName = typeof tObj.name === "string" ? tObj.name.trim() : "";
      const tNotes = typeof tObj.notes === "string" && tObj.notes.trim() ? ` (${tObj.notes.trim()})` : "";
      if (tName) talents.push(`${tName}${tNotes}`);
    }
  }

  const spells: string[] = [];
  if (typeof doc.spellsKnown === "string" && doc.spellsKnown.trim() && doc.spellsKnown !== "None") {
    for (const s of doc.spellsKnown.split(",")) {
      const trimmed = s.trim();
      if (trimmed) spells.push(trimmed);
    }
  } else if (Array.isArray(doc.spellsKnown)) {
    for (const s of doc.spellsKnown) {
      if (typeof s === "string" && s.trim()) spells.push(s.trim());
    }
  }

  const languages: string[] = [];
  if (typeof doc.languages === "string") {
    for (const l of doc.languages.split(",")) {
      const trimmed = l.trim();
      if (trimmed) languages.push(trimmed);
    }
  } else if (Array.isArray(doc.languages)) {
    for (const l of doc.languages) {
      if (typeof l === "string" && l.trim()) languages.push(l.trim());
    }
  }

  const hpMax =
    typeof doc.maxHitPoints === "number" && doc.maxHitPoints >= 1
      ? Math.trunc(doc.maxHitPoints)
      : computeShadowdarkStartingHp({
          level,
          classKey: classId,
          conScore: abilities.con,
          ancestryKey: ancestryId,
        });

  const gp = typeof doc.gold === "number" ? Math.max(0, Math.trunc(doc.gold)) : 0;
  const sp = typeof doc.silver === "number" ? Math.max(0, Math.trunc(doc.silver)) : 0;
  const cp = typeof doc.copper === "number" ? Math.max(0, Math.trunc(doc.copper)) : 0;

  return {
    name,
    level,
    xp,
    ancestryId,
    classId,
    backgroundId,
    abilities,
    hpMax,
    hpCurrent: hpMax,
    armorId,
    shield,
    extras: {
      alignment,
      deity,
      title,
      languages,
      talents,
      spells,
      weapons,
      weaponMastery: [],
      gear,
      coins: { gp, sp, cp },
      notes: "",
    },
  };
}
