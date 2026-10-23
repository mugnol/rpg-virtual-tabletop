# Functional Specification — Rules Engine & System Configuration

| | |
|---|---|
| Feature ID | RULES |
| Phase | 2 |
| Status | Approved for implementation |
| Depends on | AUTH |

## 1. Overview

The VTT is system-agnostic: everything rules-specific (abilities, modifiers,
level progression, classes, armor, derived statistics) lives in a **system
configuration** — a JSON document per game system. A small rules engine
interprets the active configuration to validate and compute character data.
Two systems ship pre-installed: **Shadowdark RPG** and **Dungeons & Dragons
5e (2024 revision, "SRD 5.2.1")**. Game Masters can import additional systems
as JSON, validated against a published JSON Schema, and export any installed
system for sharing.

## 2. Business Rules

| ID | Rule |
|---|---|
| BR-10 | A system configuration is an immutable, versioned document identified by `(key, version)`. Two documents may share a `key` only if their `version` differs. |
| BR-11 | Every configuration is validated against the project's JSON Schema on import; invalid documents are rejected with the schema errors (nothing is stored). |
| BR-12 | Configurations contain **mechanical facts only** (names, numbers, dice formulas) — no rules prose. Each system carries a mandatory `attribution` legal line, displayed wherever the system is shown (see §6). |
| BR-13 | Two systems ship pre-installed ("built-in"): `shadowdark` and `dnd5e-2024`. Built-ins are seeded idempotently; they cannot be modified or removed in Phase 2. Importing a document with the same `key` but higher/new `version` installs an additional version side by side. |
| BR-14 | System installation is global (not per-campaign). Importing requires the GM role; browsing, viewing, and exporting require any logged-in user. |
| BR-15 | The rules engine supports only the computation primitives declared by a configuration. Unsupported expressions are a schema error at import time — the engine never evaluates arbitrary code. |

## 3. What a Configuration Can Declare

The full JSON Schema is the normative contract
(`docs/specs/technical/03-rules-engine-and-sheets.md` §2). In words, a
configuration declares:

| Section | Purpose | Example (Shadowdark) | Example (D&D 5e 2024) |
|---|---|---|---|
| Identity | `key`, `name`, `version`, `attribution` | `shadowdark` | `dnd5e-2024` |
| Abilities | ordered ability list (key, name, abbreviation) | STR/INT/DEX/WIS/CON/CHA | Str/Dex/Con/Int/Wis/Cha |
| Ability scores | valid integer range, modifier formula (whitelisted arithmetic; optional clamp) | 3–18, `floor((score-10)/2)` clamped to ±4 | 3–20, `floor((score-10)/2)` unclamped |
| Creation | allowed creation methods (manual, roll, standard array) + parameters | 3d6 in order, mulligan if no score ≥ 14 | standard array 15/14/13/12/10/8, 4d6 drop lowest |
| Levels | max level, advancement model, proficiency bonus formula (optional) | XP = 10 × level, resets on advance, max 10 | fixed XP thresholds, max 20, PB = `2 + floor((level-1)/4)` |
| Classes | key, name, hit die, optional spellcasting metadata | Fighter d8, Priest d6, Thief d4, Wizard d4 | 12 classes, d6–d12 |
| Ancestries | key/name list (called "ancestries" generically; 5e renders them as "Species") | Human, Elf, Dwarf, Halfling, Half-orc, Goblin | 9 SRD 5.2 species (Aasimar is brand-excluded from the SRD) |
| Backgrounds | key/name list | free-form professions (d20 table) | 4 SRD 5.2 backgrounds (Acolyte, Criminal, Sage, Soldier); more importable |
| Armor & shield | armor catalog (base AC, DEX handling: `full` / `none` / cap N) + shield bonus | Leather 11+DEX … Plate 15; shield +2 | Padded 11+DEX … Plate 18; shield +2 |
| Derived stats | formulas: HP at level 1, HP per level, initiative, carry capacity (optional each) | HP = max hit die + CON mod (CON mod once); carry = max(STR, 10) gear slots | HP = hit die + CON mod; per level `floor(die/2)+1+CON mod` |
| Currency | coin units for the sheet's purse | gp/sp/cp | gp (with sp/cp noted) |
| Extras | free-form sheet sections toggles: talents, known spells, notes | talents + spells | spells (prepared list as free text) |

## 4. Use Cases

### UC-13 Browse installed systems
- **Actor:** Any logged-in user
- **Main flow:** User opens the Systems page (`/systems`). System shows every installed `(key, version)` with name and attribution. Each entry offers "Export" (downloads the JSON document).
- **Alternative AF-13.1:** Empty list (cannot happen in practice — built-ins always exist).

### UC-14 View a system
- **Main flow:** From Systems or when configuring a campaign, the user sees the system's full detail: abilities, classes, armor, progression — rendered from the configuration.

### UC-15 Export a system configuration
- **Main flow:** User clicks Export; the server returns the exact JSON document with `Content-Disposition: attachment` so the browser downloads `<key>-<version>.json`.

### UC-16 Import a system configuration (GM only)
- **Actor:** GM
- **Main flow:**
  1. GM opens `/systems`, pastes (or uploads) a JSON configuration, submits.
  2. System validates the document against the JSON Schema, stores it, and shows it in the list (UC-13).
- **Alternative flow AF-16.1 — Malformed JSON:** "Invalid JSON" error; nothing stored.
- **Alternative flow AF-16.2 — Schema violations:** Field-level errors are shown (e.g. `abilities: must NOT have fewer than 1 items`); nothing stored.
- **Alternative flow AF-16.3 — Duplicate (key, version):** "This system and version are already installed"; nothing stored.
- **Exception flow EF-16.1 — Not a GM:** Player attempting import is refused (403).

### UC-17 Select a system for a campaign
- **Main flow:** When creating or editing a campaign, the GM picks a system from the installed ones (or "None / generic"). The campaign's sheets are thereafter driven by that configuration (see 04-character-sheets.md).
- **Note:** This supersedes the Phase 1 free-text `system` field (BR-9): the field now holds an installed system key or `generic`.

## 5. Pre-installed Systems

Both built-in configurations are derived from the mechanical facts researched
from primary sources (listed in `technical/03` §7): Shadowdark RPG (The Arcane
Library, 2023) and D&D 5e 2024 revision (Wizards of the Coast — SRD 5.2.1,
CC-BY-4.0).

## 6. Licensing & Attribution (BR-12 enforcement)

| System | Basis | Required attribution (stored in `attribution`, shown on Systems page and sheet footers) |
|---|---|---|
| Shadowdark RPG | Shadowdark RPG Third-Party License v1.1 §2 permits use of game mechanics and names; the license FAQ excludes *character-builder products* from the general 3PL, so the app stays a generic, config-driven VTT and ships mechanics as data only — no rules text, no logos. | "…is an independent product published under the Shadowdark RPG Third-Party License and is not affiliated with The Arcane Library, LLC. Shadowdark RPG © 2023 The Arcane Library, LLC." |
| D&D 5e (2024) | SRD 5.2.1 is released under **CC-BY-4.0** (Wizards, Apr/May 2025), covering the 2024 core mechanics. Excluded IP (e.g. Aasimar, Beholder) is not used; app is not branded "D&D". | "This work includes material from the System Reference Document 5.2.1 by Wizards of the Coast LLC, licensed under CC-BY-4.0." |

Only mechanical facts (ability names, formulas, numeric tables, option lists)
are encoded. No rulebook prose is reproduced anywhere in configurations,
tests, or fixtures.

## 7. Shadowdark RPG Complete Core Rules Parity

Using the **Shadowdark RPG Core Rulebook (V4-7)** and **Shadowdarklings (`shadowdarklings.net`)** as the single source of truth, the `shadowdark` system and rules engine implement complete support for:

1. **Core Stats & Modifiers (pg. 15)**:
   - 6 Stats (`STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA`), rolled `3d6` in order with optional re-roll (mulligan) if no stat is `14+`.
   - Exact modifier mapping: `1-3 (-4)`, `4-5 (-3)`, `6-7 (-2)`, `8-9 (-1)`, `10-11 (0)`, `12-13 (+1)`, `14-15 (+2)`, `16-17 (+3)`, `18+ (+4)`.
2. **Starting Levels: Level 0 (The Gauntlet) & Level 1 (pgs. 14, 33, 40–41, 116)**:
   - **0-Level Characters**: Start with HP = `max(1, CON mod)` (+2 for Dwarf *Stout*), no class (can wield all weapons and armor until 1st level), and `1d4` items from the Starting Gear d12 table. 0-level PCs who drop to 0 HP die instantly. Surviving 0-level characters graduate to 1st level.
   - **1st-Level Characters**: Start with HP = `max(1, Class Hit Die + CON mod)` (+2 for Dwarf *Stout*), 1 class talent roll (+1 for Human *Ambitious*), and `2d6 × 5` gp (or the random 1st-level gear pack: crawling kit, 1 weapon, leather armor if wearable, and 5 gp).
3. **All 6 Core Ancestries (pgs. 16–17)**:
   - `Dwarf`: Common + Dwarvish; *Stout* (+2 starting HP, roll HP gains per level with advantage).
   - `Elf`: Common, Elvish, Sylvan; *Farsight* (+1 ranged weapon attacks OR +1 spellcasting checks).
   - `Goblin`: Common + Goblin; *Keen Senses* (cannot be surprised).
   - `Half-Orc`: Common + Orcish; *Mighty* (+1 attack and damage rolls with melee weapons).
   - `Halfling`: Common; *Stealthy* (1/day invisible for 3 rounds).
   - `Human`: Common + 1 extra Common language; *Ambitious* (+1 additional talent roll at 1st level).
4. **All 4 Classes, Talents, Titles, Deities, Backgrounds & Progression (pgs. 18–32, 38–39)**:
   - `Fighter`: `1d8` HP/lvl, all weapons/armor/shields, *Hauler* (+positive CON mod to gear slots), *Weapon Mastery* (`+1 + floor(level/2)` attack/damage with chosen weapon), *Grit* (STR or DEX advantage), 2d6 Fighter Talents table.
   - `Priest`: `1d6` HP/lvl, club/crossbow/dagger/mace/longsword/staff/warhammer, all armor/shields, Celestial/Diabolic/Primordial language, free *Turn Undead* spell, Deity & 0-slot Holy Symbol, WIS Spellcasting, Priest Spells Known table (Levels 1–10, Tiers 1–5), 2d6 Priest Talents table.
   - `Thief`: `1d4` HP/lvl, club/crossbow/dagger/shortbow/shortsword, leather armor/mithral chainmail, *Backstab* (`+1 + floor(level/2)` extra weapon dice on unaware targets), *Thievery* (0-slot tools, advantage on climbing, sneaking/hiding, disguises, traps, delicate tasks), 2d6 Thief Talents table.
   - `Wizard`: `1d4` HP/lvl, dagger/staff, no armor, 2 extra Common + 2 Rare languages, *Learning Spells* from scroll (1 day, DC 15 INT check, expends scroll), INT Spellcasting, Wizard Spells Known table (Levels 1–10, Tiers 1–5), 2d6 Wizard Talents table.
   - All 20 Backgrounds (pg. 26), 3 Alignments (`Lawful`, `Neutral`, `Chaotic`), 9 Deities (pgs. 28–29), Alignment/Level/Class Titles (pgs. 30–31), 10 Common & 4 Rare Languages (pg. 32), d20 Ancestry Character Names (pg. 38), and XP advancement (`Current Level × 10 XP`, resets to 0 on advance, talent rolls at levels 1, 3, 5, 7, 9).
5. **Gear Slots, Basic Gear, Crawling Kit, Armor & Weapons (pgs. 34–37)**:
   - Gear slots = `max(10, STR)` (+ positive CON mod for Fighter *Hauler*). First backpack free (0 slots), first 100 coins free, stackable item rules (Arrows 20/slot, Crossbow bolts 20/slot, Iron spikes 10/slot, Rations 3/slot, Gems 10/slot), Crawling Kit (7 gp, 7 slots).
   - Complete Armor Table (Leather, Chainmail, Plate mail, Shield, Mithral modifier) and all 15 Weapons with cost, type (`M`, `R`, `M/R`), range (`C`, `N`, `F`), damage, gear slots (2 slots for Bastard sword, Greataxe, Greatsword), and properties (`F`, `L`, `Th`, `2H`, `V`).
6. **Magic, Focus, Criticals, Penance & Wizard Mishap Tables (pgs. 44–73)**:
   - Spellcasting check `1d20 + INT/WIS mod + bonuses` vs `DC 10 + Spell Tier`.
   - Critical Success (Nat 20 doubles one numerical effect) and Critical Failure (Nat 1 ends focus; Priest triggers Deity Penance with Sacrifice Value table Tier 1=5gp, T2=20gp, T3=40gp, T4=90gp, T5=150gp; Wizard loses spell until rest and rolls on Tier 1–2, Tier 3–4, or Tier 5 Wizard Mishap d12 tables).
   - Focus spell maintenance checks, Scroll & Wand rules (pg. 49), and full Priest & Wizard spell catalog (pgs. 51–73).
7. **Gameplay, Light Timers, Combat, Dying, Resting, Carousing & Modes of Play (pgs. 78–95, 110–117)**:
   - Standard DCs (`9`, `12`, `15`, `18`), d6 Decider, Luck Tokens, Light Timers (60 min / 10 rounds, ride-along vs extinguish-and-reset, 3-torch 8-hour Campfire, Total Darkness disadvantage, Light Mishaps d6 table).
   - Combat attacks (Melee STR, Ranged DEX, Finesse/Thrown `max(STR, DEX)`, Versatile 1H/2H, Critical Hit double dice), Morale (`DC 15 WIS`), Death Timer (`1d4 + CON mod` min 1, Nat 20 rises with 1 HP), Stabilize (`DC 15 INT`).
   - Resting (`1` ration, 8 hrs, `DC 12 CON` on interruption), Carousing (`1d8 + event bonus`, pgs. 92–93), *Wizards and Thieves* dice game (pgs. 94–95), Treasure Quality XP (`0 / 1 / 3 / 10 XP`, pg. 117), and optional Modes of Play flags (`Blitz`, `Chaos`, `Deadly`, `Fatality`, `Grinder`, `Hunter`, `Momentum`, `Pulp`, pg. 111).
8. **Monster Compendium, Procedural Generator & Mutations (pgs. 187–266)**:
   - **Monster Attributes (pg. 189)**: `AC`, `HP`, `ATK` (attack count, bonus, range, damage, special effects), `MV` (distance + special movement like fly/swim/climb/burrow), Stat Modifiers (`S`, `D`, `C`, `I`, `W`, `Ch`), Alignment (`AL`: `L`, `N`, `C`), Level (`LV`), Monster Spellcasting rules, and Dark-Adapted trait.
   - **Official Monsters Catalog (pgs. 194–266)**: Comprehensive seeding and access for all official Shadowdark monsters (Aboleth, Acolyte, Angels, Animated Armor, Ankheg, Ape, Snow Ape, Apprentice, Archmage, Assassin, Azer, Badger, Bandit, Basilisk, Giant Bat, Bat Swarm, Brown Bear, Polar Bear, Beastman, Berserker, Black Pudding, Boar, Brain Eater, Bugbear, Bulette, Camel, Cave Brute, Cave Creeper, Centaur, Giant Centipede, Centipede Swarm, Chimera, Chuul, Cloaker, Cockatrice, Couatl, Giant Crab, Crocodile, Cultist, Cyclops, Darkmantle, Deep One, Demons, Devils, Dinosaurs, Djinni, Doppelganger, Dragons, Drow, Druid, Dryad, Duergar, Giant Dung Beetle, Efreeti, Elementals, Elephant, Elf, Ettercap, Fairy, Giant Frog, Gargoyle, Gelatinous Cube, Ghast, Ghost, Ghoul, Giants, Gibbering Mouther, Gladiator, Gnoll, Deep Gnome, Goblins, Golems, Gorgon, Gorilla, Gray Ooze, Grick, Griffon, Grimlow, Guard, Hags, Harpy, Hell Hound, Hippogriff, Hippopotamus, Hobgoblin, Horse, Hydra, Invisible Stalker, Jellyfish, Knight, Kobold, Kobold Sorcerer, Kraken, Giant Leech, Leprechaun, Lich, Lion, Lizardfolk, Mage, Mammoth, Giant Manta Ray, Manticore, Mastiff, Medusa, Merfolk, Mimic, Minotaur, Moose, Mordanticus the Flayed, Mummy, Mushroomfolk, Naga, Bone Naga, Nightmare, Obe-Ixx of Azarumme, Ochre Jelly, Giant Octopus, Ogre, Oni, Orc, Orc Chieftain, Otyugh, Outsiders, Owlbear, Panther, Peasant, Pegasus, Phoenix, Piranha Swarm, Pirate, Priest, Purple Worm, Rakshasa, Rats, Rathgamnon, Reaver, Remorhaz, Rhino, Roc, Roper, Rust Monster, Sahuagin, Salamander, Scarab Swarm, Giant Scorpion, Shadow, Shambling Mound, Shark, Siren, Skeleton, Smilodon, Snakes, Soldier, Sphinx, Spiders, Stingbat, Strangler, Ten-Eyed Oracle, Thief, Thug, Treant, Trolls, Unicorn, Vampires, Violet Fungus, Viperians, Vulture, Wandering Merchant, Giant Wasp, Wererat, Werewolf, Wight, Will-o'-Wisp, Wolves, Worg, Wraith, Wyvern, Zombie).
   - **Procedural Monster Generator (pg. 190)**: Procedural generation scaled by average party level (`PL`): `AC = PL + 10`, `1d4` attacks, `1d8` damage, Combat level/attack bonus (`PL - 3` to `PL + 4`), Quality d20, Strength d20, and Weakness d20.
   - **Monster Mutations — "Make It Weird" (pg. 191)**: Up to 3 random mutations from Mutation 1 (forms/traits), Mutation 2 (combat/attacks), and Mutation 3 (powers/supernatural), adjusting treasure rating by +2 levels.
   - **Combat Roles & Scaling (pgs. 192–193)**: Presets for `Mook`, `Soldier`, `Striker`, `Tank`, `Controller`, and `Legendary` scaling across levels 0 to 18+.

## 9. Out of Scope
- Multi-system campaigns (one active system per campaign).
