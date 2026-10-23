# Technical Specification — Rules Engine & Character Sheets

| | |
|---|---|
| Phase | 2 |
| Status | Approved for implementation |
| Companion | functional `03-rules-engine.md`, `04-character-sheets.md`; appends to technical `01-architecture.md` |

## 1. New Dependencies & Layout

| Addition | Choice | Justification |
|---|---|---|
| JSON Schema validation | **ajv** (draft 2020-12) | Reference validator; the import contract is "validated against a JSON schema" — use the real thing, not a hand-rolled check. |
| Expression evaluation | **hand-written parser** (recursive descent, whitelisted grammar) | Configs declare formulas; `eval`/`Function` is a non-starter for documents that can be imported by users. Grammar: numbers, `+ - * /`, parentheses, `floor/ceil/max/min/abs`, and identifiers (§3). |
| New server module | `server/src/rules/` | `schema.ts` (ajv compile/validate), `expressions.ts` (parser/evaluator), `engine.ts` (all computations), `builtin.ts` (load built-in configs), plus `server/src/modules/systems/` and `server/src/modules/sheets/`. |
| Built-in config data | `server/data/systems/*.json` | Committed as plain data; seeded idempotently. |

Prisma 5's SQLite connector has no `Json` column type → configuration
documents and sheet ability maps are stored as **String columns holding
JSON**, parsed and re-validated at the app layer (D-8).

## 2. Configuration Document (normative shape; the JSON Schema in
`server/src/rules/schema.ts` is enforced)

```jsonc
{
  "key": "shadowdark",            // slug, /^[a-z0-9][a-z0-9-]{1,39}$/
  "name": "Shadowdark RPG",       // 2–80 chars
  "version": "1.0.0",             // semver-ish, 1–20 chars
  "attribution": "…legal line…",  // 10–500 chars, mandatory (BR-12)
  "abilities": [ { "key": "str", "name": "Strength", "abbreviation": "STR" } ],
                                  // 1–12 items, unique keys
  "abilityScoreRange": { "min": 3, "max": 18 },
  "abilityModifier": {
    "formula": "floor((score - 10) / 2)",
    "min": -4, "max": 4          // optional clamp (Shadowdark ±4)
  },
  "creation": {
    "methods": ["roll3d6InOrder", "manual"],
    "mulliganIfAllBelow": 14,     // optional (Shadowdark)
    "standardArray": [15,14,13,12,10,8]  // required iff standardArray method
  },
  "levels": {
    "max": 10,
    "advancement": {
      "mode": "multiplier",       // or "thresholds"
      "xpMultiplier": 10, "resetOnAdvance": true,
      // mode "thresholds": "thresholds": [0, 300, …, 355000] (length = max)
    },
    "proficiencyBonus": { "formula": "2 + floor((level - 1) / 4)" } // optional
  },
  "classes": [ { "key": "fighter", "name": "Fighter", "hitDie": 8,
                 "spellcasting": { "ability": "wis", "knownByLevel": […] } } ],
  "ancestries": [ { "key": "human", "name": "Human" } ],
  "backgrounds": [ { "key": "urchin", "name": "Urchin" } ],
  "armor": [ { "key": "leather", "name": "Leather", "base": 11,
               "dex": "full", "slots": 1 } ],
                                  // dex: "full" | "none" | integer cap
  "shield": { "bonus": 2 },
  "derived": {                    // all optional; formulas per §3
    "hitPointsAtFirstLevel": "class.hitDie + con.mod",   // max of die = its value
    "hitPointsPerLevel": "floor(class.hitDie / 2) + 1",
    "initiative": "dex.mod",
    "carrySlots": "max(str.score, 10)"
  },
  "currency": { "units": ["gp", "sp", "cp"] },
  "extras": { "talents": true, "spells": true, "notes": true }
}
```

Both built-in systems conform to this shape; `dnd5e-2024` uses
`mode: "thresholds"`, no clamp, no `carrySlots`, proficiency bonus present.

## 3. Expression Grammar (BR-15)

```
expr     := term (('+' | '-') term)*
term     := factor (('*' | '/') factor)*
factor   := NUMBER | IDENT | call | '(' expr ')'
call     := ('floor' | 'ceil' | 'abs') '(' expr ')'
         |  ('max' | 'min') '(' expr (',' expr)+ ')'
```

Identifiers resolve from a whitelisted context (anything else is a schema
error at import, caught by ajv's `pattern` on formula strings plus an
engine pre-check):

| Identifier | Value |
|---|---|
| `score` | ability score (inside modifier formula only) |
| `<ability>.score`, `<ability>.mod` | per configured ability key |
| `level` | sheet level |
| `class.hitDie` | hit die of the sheet's class |

Server computations (engine.ts): `abilityModifier(config, abilityKey,
score)`, `proficiencyBonus(config, level)`, `hpAtFirstLevel(config,
classKey, abilities)`, `hpPerLevel(config, classKey, abilities)`,
`armorClass(config, armorKey|null, shield, abilities)`, `carrySlots`,
`nextLevelXp(config, level)` (multiplier vs thresholds; `null` at max).

## 4. Data Model (append to `server/prisma/schema.prisma`)

```prisma
model SystemConfig {
  key         String   @id // composite with version: @@id([key, version])
  version     String
  name        String
  attribution String
  builtin     Boolean  @default(false)
  config      String   // full JSON document (validated at write time)
  createdAt   DateTime @default(now())
  @@id([key, version])
}

model CharacterSheet {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  kind         String   // "PC" | "NPC"
  name         String
  ownerId      String?
  owner        User?    @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  systemKey    String   // snapshot of the campaign's system at creation
  ancestryId   String?
  classId      String?
  backgroundId String?
  level        Int      @default(1)
  xp           Int      @default(0)
  abilities    String   @default("{}") // {"str": 12, …}
  hpMax        Int      @default(1)
  hpCurrent    Int      @default(1)
  armorId      String?
  shield       Boolean  @default(false)
  extras       String   @default("{}") // {talents:[],spells:[],notes:"",coins:{}}
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Campaign change: `system` is now an installed system key or `"generic"`
(supersedes BR-9 free text). Create/update validates against installed
systems → 400 `UNKNOWN_SYSTEM` otherwise.

Seeding: `server/prisma/seed.ts` upserts both built-ins from
`server/data/systems/` (idempotent). Test `globalSetup` seeds them so suites
are deterministic; dev boots with a warning if the table is empty (pointing
at `npm run db:seed`); `scripts/run-e2e.sh` runs the seed after `db push`.

## 5. API

All require a session. New error codes: `INVALID_SYSTEM_CONFIG` (422),
`SYSTEM_EXISTS` (409), `UNKNOWN_SYSTEM` (400), `SYSTEM_REQUIRED` (400).

### Systems

| Method & path | Authz | Request → Response |
|---|---|---|
| `GET /api/systems` | any | → 200 `{systems: [{key, version, name, attribution, builtin}]}` |
| `GET /api/systems/:key` | any | → 200 `{system: <full config document>}` (latest installed version; 404 if unknown) |
| `GET /api/systems/:key/export` | any | → 200 `application/json`, `Content-Disposition: attachment; filename="<key>-<version>.json"`, body = exact config document |
| `POST /api/systems/import` | GM | config JSON body → 201 `{system: <document>}`. 400 malformed JSON; 422 `INVALID_SYSTEM_CONFIG` + ajv details; 409 `SYSTEM_EXISTS` |

### Sheets (all nested under a campaign; sheet routes check campaign participation → 404 for outsiders)

| Method & path | Authz | Request → Response |
|---|---|---|
| `GET /api/campaigns/:id/sheets` | participant | → 200 `{sheets: SheetSummary[]}` (PCs first, then NPCs, name asc) |
| `POST /api/campaigns/:id/sheets` | participant; NPC → GM only | `{kind, name, level? (0..1), ancestryId?, classId?, backgroundId?, abilities, armorId?, shield?, extras?}` → 201 `{sheet}`. 400 per BR-20 / `SYSTEM_REQUIRED` if campaign has no system / 403 NPC as player |
| `POST /api/campaigns/:id/sheets/generate` | participant | `{level?: 0 \| 1, kind?: "PC" \| "NPC", name?}` → 201 `{sheet}` (randomly rolls stats, ancestry, background, alignment, deity, class/talents/spells, starting gear per Shadowdark pgs. 40–41) |
| `POST /api/campaigns/:id/sheets/shadowdarklings` | participant | Shadowdarklings JSON body → 201 `{sheet}` (bidirectional import of Shadowdarklings character export) |
| `GET /api/sheets/:id` | participant | → 200 `{sheet}` |
| `GET /api/sheets/:id/shadowdarklings` | participant | → 200 `{character: ShadowdarklingsExport}` (full Shadowdarklings-compatible JSON export) |
| `PATCH /api/sheets/:id` | owner (own PC) or campaign owner | partial of create body + `{level? ignored, xp?, abilities?, hpMax?, hpCurrent?, armorId?, shield?, extras?}` → 200 `{sheet}` (BR-20 revalidated) |
| `POST /api/sheets/:id/levelup` | as PATCH | → 200 `{sheet}`; level+1 (including Level 0 → Level 1 graduation with class selection), hpMax += hpPerLevel, XP reset if config says so; 400 at max level |
| `POST /api/sheets/:id/shadowdark-action` | as PATCH | `{action: "cast_spell" \| "maintain_focus" \| "learn_scroll" \| "rest" \| "carouse" \| "roll_talent" \| "death_timer" \| "dying_roll" \| "stabilize" \| "light", ...params}` → 200 `{result, sheet}` |
| `DELETE /api/sheets/:id` | as PATCH | → 204 |

`SheetSummary`: `{id, kind, name, ownerId, ownerName?, ancestryId, classId, level, systemKey}`.
`Sheet` (detail): summary + `{backgroundId, xp, abilities: {str: {score, modifier}, …}, hpMax, hpCurrent, armorId, shield, extras, derived: {hpPerLevel?, proficiencyBonus?, initiative?, carrySlots?, armorClass, nextLevelXp?, spellcasting?: {ability, known, allowed, knownByTier?}, shadowdark?: ShadowdarkDerivedSummary}}`.

### Shadowdark Core Rules Module (`server/src/rules/shadowdark.ts`)
Encapsulates all tables, formulas, and rules from `Shadowdark RPG - V4-7.txt`:
- **Stats & Level 0/1**: `shadowdarkStatModifier(score)`, `rollShadowdarkStats(opts)`, `computeShadowdarkStartingHp(params)`, `rollLevelZeroGear(opts)`, `rollLevelOneGold(opts)`.
- **Ancestries & Classes**: `SHADOWDARK_ANCESTRIES` (Dwarf *Stout*, Elf *Farsight*, Goblin *Keen Senses*, Half-Orc *Mighty*, Halfling *Stealthy*, Human *Ambitious*), `SHADOWDARK_CLASSES` (Fighter *Hauler*/*Weapon Mastery*/*Grit*, Priest *Turn Undead*/*Deity*/*Languages*, Thief *Backstab*/*Thievery*, Wizard *Learning Spells*/*Languages*), `SHADOWDARK_BACKGROUNDS` (1–20), `SHADOWDARK_ALIGNMENTS`, `SHADOWDARK_DEITIES` (all 9), `SHADOWDARK_TITLES`, `SHADOWDARK_LANGUAGES` (10 Common, 4 Rare), `SHADOWDARK_NAMES`, `getCharacterTitle(classId, level, alignment)`, `rollClassTalent(classId, roll2d6)`.
- **Gear, Slots, Armor & Weapons**: `SHADOWDARK_BASIC_GEAR`, `SHADOWDARK_CRAWLING_KIT`, `SHADOWDARK_ARMOR`, `SHADOWDARK_WEAPONS` (all 15 weapons with cost, type `M`/`R`/`M/R`, range `C`/`N`/`F`, damage, versatile damage, gear slots, properties `F`/`L`/`Th`/`2H`/`V`), `calculateShadowdarkGearSlots(params)`, `computeWeaponAttackBonusAndDamage(params)`.
- **Magic, Focus, Penance & Mishaps**: `SHADOWDARK_SPELLS` (all Priest & Wizard spells Tiers 1–5), `PRIEST_SPELLS_KNOWN_BY_TIER`, `WIZARD_SPELLS_KNOWN_BY_TIER`, `PRIEST_PENANCE_SACRIFICE_GP` (`1:5, 2:20, 3:40, 4:90, 5:150`), `WIZARD_MISHAP_TABLES` (`tier1_2`, `tier3_4`, `tier5` with automatic Devastation! roll-twice-and-combine on 1), `resolveSpellcastingCheck(params)`, `resolveFocusCheck(params)`, `resolveScrollOrWandCast(params)`, `resolveLearnSpellFromScroll(params)`.
- **Gameplay, Light, Combat, Dying, Rest, Carousing, Wizards & Thieves, XP & Modes**: `SHADOWDARK_DCS` (`easy: 9, normal: 12, hard: 15, extreme: 18`), `rollD6Decider(roll)`, `manageLightSource(params)`, `rollLightMishap(roll)`, `rollMoraleCheck(params)`, `rollDeathTimer(params)`, `rollDyingTurn(params)`, `resolveStabilizeCheck(params)`, `resolveRest(params)`, `resolveCarousing(params)`, `playWizardsAndThievesTurn(params)`, `awardTreasureQualityXp(quality)`, `computeHunterModeMonsterXp(monsterLevel)`.
- **Monster Compendium, Procedural Generation & "Make It Weird" Mutations (pgs. 187–266)**:
  - `SHADOWDARK_MONSTERS`: Catalog of all official Shadowdark monsters with stats (`ac`, `hp`, `attacks`, `movement`, `modifiers`, `level`, `alignment`, `darkAdapted`, `spells`, `features`).
  - `SHADOWDARK_COMBAT_ROLES`: Presets (`Mook`, `Soldier`, `Striker`, `Tank`, `Controller`, `Legendary`) providing role-based attribute formulas.
  - `SHADOWDARK_PROCEDURAL_TABLES`: Procedural d20 tables (Combat `PL - 3` to `PL + 4`, Quality, Strength, Weakness) and d12 Mutation tables (Mutation 1, 2, and 3).
  - `generateProceduralMonster(options)`: Function to generate randomized or deterministic procedural monsters scaled by `partyLevel` (`PL`).
- **Shadowdarklings JSON Parity**: `exportToShadowdarklings(sheet, config)` and `importFromShadowdarklings(doc)`.

## 6. Permissions Matrix (integration-test checklist, append to `02` §4)

| Action | Guest | Player non-member | Player participant | Sheet owner | Campaign owner |
|---|---|---|---|---|---|
| list/browse systems, export | 401 | ✔ | ✔ | ✔ | ✔ |
| import system | 401 | 403 | 403 | 403 | ✔ (GM) |
| list sheets | 401 | 404 | ✔ | ✔ | ✔ |
| create PC | 401 | 404 | ✔ 201 | ✔ 201 | ✔ 201 |
| create NPC | 401 | 404 | 403 | 403 | ✔ 201 |
| read sheet | 401 | 404 | ✔ | ✔ | ✔ |
| edit PC | 401 | 404 | 403 (not owner) | ✔ | ✔ |
| edit NPC | 401 | 404 | 403 | 403 | ✔ |
| level up / delete | 401 | 404 | owner: ✔ (PC) | ✔ | ✔ |

## 7. Rules Research Sources (mechanical facts behind the built-in configs)

**Shadowdark RPG** (current edition: 2023 core rulebook; latest official
rules update Dec 2024 Rules FAQ; no newer edition found as of Oct 2026):

- Product/edition status: https://www.thearcanelibrary.com/pages/shadowdark
- Free Quickstart Set (primary mechanical source — modifier table, 3d6-in-order + mulligan, ancestries/classes, hit dice, talent tables, spells-known tables, armor values, gear slots, XP=10×level reset, luck tokens, DCs): https://www.thearcanelibrary.com/products/shadowdark-rpg-quickstart-set-pdf
- Official Rules FAQ Dec 2024 (CON mod only at 1st-level HP; no STR/DEX on damage; negative DEX applies to AC): https://www.thearcanelibrary.com/blogs/shadowdark-blog/shadowdark-rules-faq
- Official character sheet (authoritative field list): https://www.thearcanelibrary.com/blogs/shadowdark-blog/shadowdark-rpg-character-sheet
- Third-Party License v1.1 + FAQ (mechanics usable; attribution text; character-builder-app exclusion): https://www.thearcanelibrary.com/blogs/shadowdark-blog/faq-on-the-shadowdark-rpg-third-party-license · https://www.dropbox.com/sh/dvmwvjyieffurfb/AAC7cJFIg9NjV33zTDI2tGx5a?dl=0
- Cross-checks (licensed/endorsed implementations): https://github.com/Muttley/foundryvtt-shadowdark · https://shadowdarklings.net

**D&D 5e, 2024 revision** (D&D Beyond labels it "5.5e"; SRD 5.2.1 of
2025-05-01 is the current CC-BY-4.0 text, includes all second-printing
errata; latest errata 2026-10-07):

- Wizards SRD page (5.1 & 5.2/5.2.1 both CC-BY-4.0): https://dnd.wizards.com/resources/systems-reference-document
- Free Rules — Creating a Character (abilities, modifier table, generation, background ASIs, XP thresholds, PB, HP): https://www.dndbeyond.com/sources/dnd/free-rules/creating-a-character
- Free Rules — Character Origins (background anatomy, species, Heroic Inspiration): https://www.dndbeyond.com/sources/dnd/free-rules/character-origins
- Free Rules — Character Classes (12 classes, hit dice, saves, subclass at 3, spellcasting models): https://www.dndbeyond.com/sources/dnd/free-rules/character-classes
- Free Rules — Equipment (armor table, armor training): https://www.dndbeyond.com/sources/dnd/free-rules/equipment
- Free Rules — Playing the Game (skills, initiative, death saves): https://www.dndbeyond.com/sources/dnd/free-rules/playing-the-game
- Free Rules — Spells (prepared-vs-known by class, DC formulas): https://www.dndbeyond.com/sources/dnd/free-rules/spells
- PHB species/backgrounds lists: https://www.dndbeyond.com/posts/1783-the-10-species-in-the-2024-players-handbook · https://www.dndbeyond.com/posts/1785-the-backgrounds-and-origin-feats-in-the-2024
- Errata timeline: https://www.dndbeyond.com/posts/1950-sage-advice-and-errata-for-the-new-core-rules-is · https://www.geeknative.com/243095/dd-2024-update-26/

Research flags (encoded as spec choices): Shadowdark has no confirmed hard
ability cap → range max 18 per score-generation table; milestone leveling not
in core → not modeled; 2024 skills list is unchanged from 2014 (no renames
shipped) but skill proficiencies are Phase-2 out-of-scope anyway.

## 8. UI Testability Contract (data-testid additions)

| testid | Element |
|---|---|
| `page-systems`, `system-list`, `system-item`, `system-attribution` | Systems page, list, items (item text = name), attribution line |
| `system-import-form`, `system-import-input`, `system-import-submit` | GM import form (textarea) |
| `system-export-button` | Per-item export |
| `system-select` | Campaign create/edit system dropdown |
| `sheet-section`, `sheet-list`, `sheet-item`, `sheet-kind-badge` | Campaign detail sheets block (item text = name; badge text = `PC`/`NPC`) |
| `sheet-create-pc-button`, `sheet-create-npc-button` | Create buttons (NPC = GM only) |
| `page-sheet`, `sheet-name`, `sheet-identity`, `sheet-level`, `sheet-xp`, `next-level-xp` | Sheet page header & progression |
| `ability-row`, `ability-score`, `ability-modifier` | One row per configured ability (row text = name; modifier prefixed `+`/`-`) |
| `hp-current`, `hp-max`, `ac-value`, `initiative-value`, `pb-value`, `carry-value` | Stats (pb/carry rendered only when configured) |
| `armor-select`, `shield-checkbox` | Armor picker from config catalog |
| `ancestry-select`, `class-select`, `background-select` | Identity selects (options from config) |
| `talents-input`, `spells-input`, `notes-input` | Free-form extras |
| `roll-abilities-button` | Ability roll per config creation method |
| `level-up-button`, `sheet-edit-button`, `sheet-save-button`, `sheet-delete-button` | Actions |

## 9. Testing Strategy (TDD)

- **Unit (engine)**: expression parser (grammar, precedence, errors); ability
  modifiers incl. Shadowdark ±4 clamp; HP at 1st level & per level for both
  systems; AC across armor/dex modes + shield; proficiency bonus table; XP
  next-level (multiplier-reset vs thresholds, null at max); carry slots.
- **Unit (schema)**: ajv acceptance/rejection matrix for every required
  section (bad formula identifier, empty abilities, thresholds length ≠ max,
  duplicate ability keys, …).
- **Integration**: permissions matrix §6 end-to-end; import happy path +
  AF-16.1/16.2/16.3 + EF-16.1; export byte-equality with the committed
  built-in file; campaign `UNKNOWN_SYSTEM`; sheet validation against config
  (score out of range, unknown class/armor id); levelup atomicity + XP reset
  (Shadowdark) vs accumulation (5e).
- **E2E (Robot)**: `04_systems.robot` (browse, export download, GM import
  round-trip, invalid import errors, player 403) and `05_sheets.robot`
  (create PC via roll, computed modifiers/AC visible, GM NPC + player 403,
  edit own vs other's sheet, level-up, campaign without system shows no
  sheet UI).

## 10. Decision Log (appended to `01-architecture.md` §10)

| ID | Decision | Consequence |
|---|---|---|
| D-8 | Configs & ability maps stored as String-JSON (Prisma 5 SQLite lacks Json) | App layer owns parsing/validation; ajv runs at every system read/write boundary that matters (import; sheet create/edit). |
| D-9 | Hand-rolled whitelisted expression parser | Formulas are data, never code (BR-15); testable; ~150 lines. |
| D-10 | Systems are global; import is GM-gated (BR-14) | No per-campaign system sprawl; one permission rule. |
| D-11 | Mechanics-as-data + attribution lines only (BR-12) | Legally defensible under Shadowdark 3PL §2 / SRD 5.2.1 CC-BY-4.0; no rules prose anywhere. |
| D-12 | Sheet snapshots `systemKey` at creation; computations use the latest installed version of that key | Sheets survive config re-imports; switching campaign system recomputes (UC-25). |
