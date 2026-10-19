# Functional Specification — Character Sheets

| | |
|---|---|
| Feature ID | SHEETS |
| Phase | 2 |
| Status | Approved for implementation |
| Depends on | RULES, CAMP |

## 1. Overview

A *character sheet* is a persistent character inside a campaign — a player
character (**PC**, owned by the player who created it) or a non-player
character (**NPC**, created by the GM). The sheet's structure and every
computed number on it are driven by the campaign's **active system
configuration** (03-rules-engine.md): ability list and modifiers, valid
score ranges, class/ancestry/background options, armor catalog, level/XP
progression, and derived statistics (HP, AC, initiative, proficiency bonus,
carry capacity) all come from configuration, not from hard-coded rules.

## 2. Business Rules

| ID | Rule |
|---|---|
| BR-16 | Sheets exist only in campaigns that have a system assigned. A campaign with `system: "generic"` cannot hold sheets. |
| BR-17 | A sheet is either a **PC** (exactly one owner — its creator) or an **NPC** (no owner). Only the campaign owner (GM) may create NPCs. Any campaign participant may create a PC. |
| BR-18 | Read access = campaign participants (owner + members). Non-participants get "not found" (existence not revealed, consistent with EF-7.1). |
| BR-19 | Write/delete access: the campaign owner (GM) may edit/delete any sheet; a player may edit/delete only PCs they own. NPCs are GM-only. |
| BR-20 | All sheet input is validated against the active configuration: ability scores within the configured range; ancestry/class/background/armor values must be options declared by the configuration. Violations are field errors; nothing is persisted. |
| BR-21 | Derived statistics are computed by the rules engine **on the server** and returned with the sheet; the client never computes rules. Stored mutable state is limited to: identity choices, level, XP, ability scores, current/max HP, armor + shield selection, and free-form extras (talents, known-spell names, notes, coins). |
| BR-22 | Level changes only upward via the dedicated level-up action (adds the configured HP-per-level to max HP). Direct level edits are not allowed; XP is editable within 0…999,999. |
| BR-23 | Deleting a campaign or its owner cascades to sheets (ownerless NPCs belong to the campaign; PC sheets die with their owner or campaign). |

## 3. Use Cases

### UC-18 Create a player character
- **Actor:** Any campaign participant
- **Main flow:**
  1. From the campaign detail page ("Sheets" section) the user clicks "New character".
  2. The sheet form shows exactly the fields the configuration declares: abilities (with a creation-method roll button, e.g. 3d6 in order / 4d6 drop lowest / standard array), ancestry, class, background, name; armor/shield selection; HP is pre-filled from the configuration formula.
  3. User submits → system validates against the configuration (BR-20), creates the PC with the user as owner, and opens the sheet page.
- **Exception EF-18.1 — Validation failure:** field errors; nothing created.

### UC-19 Create an NPC (GM only)
- Same as UC-18 without an owner. A player attempting it is refused (403).
- NPCs and PCs appear together in the campaign's sheet list, badged by kind.

### UC-20 List campaign sheets
- From the campaign detail page: all sheets (name, kind badge, ancestry/class/level summary, owner name for PCs), PCs first then NPCs, alphabetical within each group.

### UC-21 View a character sheet
- **Actor:** Campaign participant
- **Main flow:** The sheet page shows: name; kind badge; ancestry · class · background · level; XP with progress toward the next level (per configuration); ability scores with computed modifiers; HP (current/max, editable); AC (computed from armor/shield/abilities per configuration); derived stats the configuration declares (initiative, proficiency bonus, carry slots); free-form sections (talents, known spells, notes, coins).
- **Exception EF-21.1:** Non-participant → "not found".

### UC-22 Edit a character sheet
- **Actor:** Sheet owner (own PC) or campaign owner (any sheet)
- Fields editable per BR-21; server re-validates (BR-20) and recomputes derived stats. HP current can be adjusted (damage/heal) within 0…max.

### UC-23 Level up
- **Actor:** As UC-22
- **Main flow:** "Level up" button (hidden at max level): level +1 and max HP increases by the configuration's HP-per-level value, in one atomic update. XP handling on advance follows the configuration (e.g. D&D keeps accumulated XP; Shadowdark resets XP to 0 per its advancement model).

### UC-24 Delete a character sheet
- As UC-22; after confirm, the sheet is gone from the list.

### UC-25 Change a campaign's system
- The campaign owner may switch the campaign to another installed system (or none). Existing sheets keep their stored values; derived numbers recompute against the new configuration. (Values that no longer validate — e.g. a class that doesn't exist in the new system — are shown as raw text and must be re-picked on next edit; they do not block reading.)

## 4. UI Summary (Phase 2)

- `/systems` — installed systems, attribution lines, export, GM-only import form.
- Campaign create/edit — system dropdown (installed systems + "None").
- Campaign detail — "Sheets" section: list, "New character" (participants), "New NPC" (GM only).
- `/sheets/:id` — the sheet page (UC-21), with edit mode and level-up for authorized users.

## 5. Out of Scope (Phase 2)

- Skill proficiencies/expertise, feats, equipment inventories beyond armor/shield,
  portraits, dice rollers for attacks/spells, death-save trackers.
- Sheet templates/duplication, sheet visibility restrictions within a campaign.
