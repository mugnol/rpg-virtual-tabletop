# Functional Specification: Maps & Tokens

**Document ID:** SPEC-F-07  
**Module:** Maps & Tokens (Phase 4)  
**Status:** Approved  
**Related Requirements:** BR-35..BR-42, UC-33..UC-38

---

## 1. Overview & Objective
This specification defines the 2D interactive tactical map and token placement system inside virtual tabletop game rooms (`GameSession`). The system provides:
- Built-in generic tactical map themes and configurable grid dimensions.
- Token placement, editing, and deletion for Player Characters (`CHARACTER`), GM-controlled adversaries (`MONSTER`), and environmental markers (`ITEM`).
- Real-time token synchronization across all connected participants.
- GM-controlled player movement authorization and spatial boundary validation.

---

## 2. Business Rules (BR)

### BR-35: Map Association & Themes
- Each `GameSession` possesses one or more `SessionMap` records.
- Built-in map themes are offline-capable, self-contained SVG/CSS patterns:
  1. `stone-dungeon`: Flagstone masonry grid for underground exploration.
  2. `forest-clearing`: Woodland and foliage terrain for outdoor encounters.
  3. `tavern-cellar`: Wooden planks and barrels for indoor skirmishes.
- Maps define integer grid dimensions: `width` (columns, default 12–16) and `height` (rows, default 8–12).
- Cell coordinates are zero-indexed `(x, y)` where `0 <= x < width` and `0 <= y < height`.

### BR-36: Token Classification & Attributes
Tokens placed on the map belong to one of three types:
1. `CHARACTER`:
   - Represents a player character or friendly ally.
   - Optionally references a campaign `CharacterSheet`.
   - Inherits `name`, `hpMax`, `hpCurrent`, `ac`, and `ownerId` from the linked sheet.
   - Movement speed defaults to 6 squares (30 feet).
2. `MONSTER`:
   - Represents adversaries and NPCs controlled exclusively by the GM.
   - Configured with `name`, `hpMax`, `hpCurrent`, `ac`, `attackBonus`, `damageFormula`, and `speed` (default 6).
   - Only the GM can select, configure, and move monster tokens.
3. `ITEM`:
   - Represents loot chests, traps, doors, or tactical landmarks.
   - Contains `name` and optional descriptive note.
   - Has no combat statistics (HP/AC).

### BR-37: Movement Authorization Matrix
| Actor | Token Type | `allowPlayerMovement` = False | `allowPlayerMovement` = True | During Active Combat |
| :--- | :--- | :--- | :--- | :--- |
| **GM** | Any (`CHARACTER`, `MONSTER`, `ITEM`) | Permitted (any cell) | Permitted (any cell) | Permitted (any cell) |
| **Player** | Owned `CHARACTER` | **Denied** | **Permitted** | Permitted ONLY on own turn within `speed` |
| **Player** | Other Player's `CHARACTER` | **Denied** | **Denied** | **Denied** |
| **Player** | `MONSTER` or `ITEM` | **Denied** | **Denied** | **Denied** |

### BR-38: Real-Time Synchronization
- Any map change (grid size, theme, movement toggle), token placement, token move, or token deletion broadcasts immediately via WebSockets to all connected session participants.
- Client state updates optimistically or synchronously to ensure all users view identical token positions.

### BR-39: Token Images and Predefined Avatars
- Tokens (`CHARACTER` and `MONSTER`) support visual avatar images via `avatarKey` (referencing bundled vector/raster assets) or `imageUrl` (custom URL / Data URL).
- Built-in predefined asset library provides stylized, distinct SVG/PNG avatars for:
  - **Shadowdark Classes & Level 0**: `peasant` (Level 0), `fighter`, `priest`, `thief`, `wizard`.
  - **Generic Combat Roles**: `mook`, `soldier`, `striker`, `tank`, `controller`, `legendary`.
  - **Monster Categories & Creatures**: `goblin`, `skeleton`, `zombie`, `orc`, `dragon`, `beast`, `demon`, `aberration`, `undead`.
- **Automatic Assignment**:
  - Creating a `CHARACTER` token from a sheet automatically assigns the avatar corresponding to the sheet's class (or `peasant` if level 0 / unclassed).
  - Creating a `MONSTER` token automatically assigns the avatar corresponding to its monster type/key or combat role preset.
- **Customization & Permissions**:
  - The GM (and players for tokens they own) can pick from the predefined avatar gallery or provide a custom image URL / Data URL.
- **Rendering**:
  - Avatars render inside the circular tactical map tokens and as a visual thumbnail inside the Campaign Turn Queue list (`turn-queue-list`).

---

## 3. Use Cases (UC)

### UC-33: GM Configures Map Dimensions & Theme
1. GM opens the session room and selects the Map tab/panel.
2. GM adjusts grid width/height and chooses a theme (`stone-dungeon`, `forest-clearing`, `tavern-cellar`).
3. GM saves; grid updates on screen and broadcasts to all participants.

### UC-34: GM Toggles Player Movement
1. GM toggles the `allowPlayerMovement` switch.
2. Server updates the map configuration and broadcasts `map_updated`.
3. Players' movement controls become active/disabled accordingly.

### UC-35: GM Places Tokens
1. GM clicks "Add Token", selects type (`CHARACTER`, `MONSTER`, or `ITEM`).
2. For `CHARACTER`, GM can pick an existing campaign character sheet; name, stats, and owner are auto-populated.
3. For `MONSTER`, GM can select one of three creation modes:
   - **Compendium**: Search and filter from the complete Shadowdark Monster Catalog by name, level, or alignment. Selecting an entry auto-populates `name`, `hpMax`, `hpCurrent`, `ac`, `attackBonus`, `damageFormula`, `dexModifier` (for initiative), and attacks/traits.
   - **Generic / Combat Role**: Choose custom name, level, and optional Combat Role preset (`Mook`, `Soldier`, `Striker`, `Tank`, `Controller`, `Legendary` per pg. 192), which auto-calculates recommended AC, HP, attack bonus, and damage dice based on monster level.
   - **Procedural Generator ("Make It Weird")**: Set average Party Level (`PL`) and generate a procedural monster (Combat `PL - 3` to `PL + 4`, `AC = PL + 10`, `1d4` attacks, `1d8` damage, Quality d20, Strength d20, Weakness d20) with optional d12 mutations (Mutation 1, 2, and 3).
4. GM places the token at coordinate `(x, y)`. Token appears on all screens and integrates into the turn queue if combat is active.

### UC-36: Player Moves Owned Character
1. Player clicks their character token on the grid.
2. Valid destination cells within map bounds are highlighted.
3. Player clicks destination cell `(x', y')`.
4. If permitted, token moves and position syncs to all clients.

### UC-37: Unauthorized Move Rejected
1. Player attempts to drag/move a monster token or another player's token.
2. System blocks the action and displays an authorization error.
3. Token remains in original position.

### UC-38: GM Deletes Token
1. GM selects a token and clicks "Delete Token".
2. Token is removed from the database and disappears in real-time from all clients.

### UC-39: Token Avatar Selection & Custom Images
1. When placing or configuring a token, GM (or player for owned character tokens) views the avatar picker gallery containing predefined class and monster avatars.
2. User clicks a predefined avatar option or types a custom image URL.
3. Token updates in real time and renders the chosen avatar image on both the tactical map cell and in the Campaign Turn Queue list.
