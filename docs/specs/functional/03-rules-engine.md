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

## 7. Out of Scope (Phase 2)

- Point-buy calculator UI (config may declare point buy; UI lands later).
- Rolling on talent tables, weapon mastery mechanics, feats/class features
  beyond hit die & spellcasting counts.
- Spell/compendium content (the catalog of spells themselves); sheets store
  known-spell *names* as free text, optionally count-limited per config.
- System deletion/version management UI; multi-system campaigns.
