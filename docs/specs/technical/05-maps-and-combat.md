# Technical Specification: Maps & Turn-Based Combat

**Document ID:** SPEC-T-05  
**Module:** Maps & Turn-Based Combat (Phase 4)  
**Status:** Approved  
**Related Specs:** SPEC-F-07, SPEC-F-08

---

## 1. Architecture & Data Model

### 1.1 Prisma Schema Additions
```prisma
model SessionMap {
  id                  String       @id @default(cuid())
  sessionId           String
  session             GameSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name                String       @default("Dungeon Map")
  theme               String       @default("stone-dungeon") // stone-dungeon | forest-clearing | tavern-cellar
  width               Int          @default(12)
  height              Int          @default(8)
  allowPlayerMovement Boolean      @default(false)
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  tokens              MapToken[]
  combat              CombatState?
}

model MapToken {
  id               String          @id @default(cuid())
  mapId            String
  map              SessionMap      @relation(fields: [mapId], references: [id], onDelete: Cascade)
  type             String          // "CHARACTER" | "MONSTER" | "ITEM"
  name             String
  characterSheetId String?
  characterSheet   CharacterSheet? @relation(fields: [characterSheetId], references: [id], onDelete: SetNull)
  ownerId          String?
  owner            User?           @relation("TokenOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  x                Int             @default(0)
  y                Int             @default(0)
  color            String          @default("#6366f1")
  hpMax            Int             @default(10)
  hpCurrent        Int             @default(10)
  ac               Int             @default(10)
  speed            Int             @default(6)
  attackBonus      Int             @default(0)
  damageFormula    String          @default("1d6")
  initiative       Int             @default(0)
  dexModifier      Int             @default(0)
  hasSurprise      Boolean         @default(false)
  initiativeMeta   String          @default("{}") // JSON serialized InitiativeRollMeta
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
}

model CombatState {
  id                     String     @id @default(cuid())
  mapId                  String     @unique
  map                    SessionMap @relation(fields: [mapId], references: [id], onDelete: Cascade)
  active                 Boolean    @default(false)
  round                  Int        @default(1)
  turnIndex              Int        @default(0)
  activeTokenId          String?
  turnOrder              String     @default("[]") // JSON serialized Array<string> of MapToken IDs
  timers                 String     @default("[]") // JSON serialized Array<CombatTimer>
  chaosMode              Boolean    @default(false)
  groupMonsterInitiative Boolean    @default(false)
  isSurpriseRound        Boolean    @default(false)
  freeformMode           Boolean    @default(false)
  createdAt              DateTime   @default(now())
  updatedAt              DateTime   @updatedAt
}
```

### 1.2 Turn Queue, Initiative & Timer DTOs
```ts
export interface InitiativeRollMeta {
  dice: number[];
  keptDie: number;
  dexModifier: number;
  total: number;
  hasAdvantage: boolean;
  formula: string;
}

export interface TurnQueueEntry {
  id: string;
  entityId: string;
  name: string;
  type: "CHARACTER" | "MONSTER";
  entityType: "character" | "monster";
  initiative: number;
  dexModifier: number;
  hasSurprise: boolean;
  hasInitiativeAdvantage: boolean;
  initiativeMeta: InitiativeRollMeta | null;
  ownerId: string | null;
  characterSheetId: string | null;
  hpCurrent: number;
  hpMax: number;
  ac: number;
  speed: number;
  isActive: boolean;
}

export interface CombatTimer {
  id: string;
  name: string;
  category: "spell" | "light" | "dying" | "custom";
  scope: "personal" | "gm";
  entityId: string | null;
  entityName?: string | null;
  remainingRounds: number;
  initialRounds: number;
  expired: boolean;
}

export interface FormattedCombatState {
  id: string;
  mapId: string;
  active: boolean;
  round: number;
  roundNumber: number;
  turnIndex: number;
  activeTokenId: string | null;
  activeTurnEntityId: string | null;
  turnOrder: string[];
  turnQueue: TurnQueueEntry[];
  timers: CombatTimer[];
  chaosMode: boolean;
  groupMonsterInitiative: boolean;
  isSurpriseRound: boolean;
  freeformMode: boolean;
}
```

---

## 2. REST API Endpoints

### 2.1 Map Management
- `GET /api/sessions/:sessionId/maps`
  - Returns array of maps for the session with formatted `combat` state.
- `POST /api/sessions/:sessionId/maps` (GM only)
  - Creates a new tactical map.
- `GET /api/maps/:mapId`
  - Returns map detail including all tokens and current combat state.
- `PATCH /api/maps/:mapId` (GM only)
  - Updates map name, theme, dimensions, or `allowPlayerMovement`.

### 2.2 Token Management
- `POST /api/maps/:mapId/tokens` (GM only)
  - Places a new token (`CHARACTER`, `MONSTER`, or `ITEM`).
- `PATCH /api/tokens/:tokenId`
  - Updates token stats or position `(x, y)` subject to movement and active turn rules.
- `DELETE /api/tokens/:tokenId` (GM only)
  - Removes a token from the map (and removes from active `turnQueue` if present).

### 2.3 Combat, Initiative & Turn Queue Controls
- `POST /api/maps/:mapId/combat/start` (GM only)
  - Rolls initiative for all `CHARACTER` (`character`) and `MONSTER` (`monster`) participants (respecting `groupMonsterInitiative`, Thief initiative advantage `2d20kh1 + DEX`, and `hasSurprise`), initializes `turnOrder` / `turnQueue`, sets `round` / `roundNumber` to 1, `activeTokenId` / `activeTurnEntityId` to the first participant, and activates combat.
- `POST /api/maps/:mapId/combat/initiative/roll` (GM or Campaign Participant)
  - Rolls initiative (`1d20 + DEX` or `2d20kh1 + DEX` for Thief talent) for a specific `tokenId` (owned by player or any if GM) or all combatants (GM), re-sorts the Turn Queue, logs the roll to session chat, and broadcasts updated combat state.
- `PATCH /api/maps/:mapId/combat/initiative` / `POST /api/maps/:mapId/combat/initiative` (GM only)
  - Manually sets/overrides a participant's `initiative` score (`{ tokenId, initiative }`), re-sorts the Turn Queue, and broadcasts updated state.
- `POST /api/maps/:mapId/combat/surprise` (GM only)
  - Toggles or sets `hasSurprise` (`{ tokenId, hasSurprise }`) on a participant and re-sorts the Turn Queue.
- `POST /api/maps/:mapId/combat/reorder` (GM only)
  - Reorders the Turn Queue participants via `{ orderedTokenIds: string[] }` or `{ tokenId: string, direction: "up" | "down" }`. Preserves `activeTurnEntityId` and recomputes `turnIndex`. Non-GM requests are rejected with `403 FORBIDDEN`.
- `PATCH /api/maps/:mapId/combat/settings` (GM only)
  - Updates combat encounter settings (`{ chaosMode?, groupMonsterInitiative?, freeformMode? }`) and broadcasts updated combat state.
- `POST /api/maps/:mapId/combat/next` (GM or active player)
  - Advances turn to next participant in queue. On full queue cycle wrap (`turnIndex` wraps to 0), increments `roundNumber`, decrements all active `timers` by 1 round, clears `isSurpriseRound`, and if `chaosMode` is active, automatically re-rolls initiative and re-sorts the Turn Queue for the new round.
- `POST /api/maps/:mapId/combat/end-turn` (Active player or GM)
  - Allows the active player to end their own character's turn and advance the queue to the next participant.
- `POST /api/maps/:mapId/combat/prev` (GM only)
  - Reverts turn to the previous participant in the queue. If `turnIndex` was 0 and `roundNumber > 1`, wraps backward to `turnQueue.length - 1`, decrements `roundNumber` by 1 (min 1), and restores timer countdowns by 1 round.
- `POST /api/maps/:mapId/combat/timers` (GM or Campaign Participant)
  - Adds a personal or GM round timer (`spell`, `light`, `dying`, `custom`) to the combat encounter.
- `DELETE /api/maps/:mapId/combat/timers/:timerId` (GM or Campaign Participant)
  - Removes a round timer from the combat encounter.
- `POST /api/maps/:mapId/combat/attack` (GM or active player)
  - Executes attack from active token to target token; returns combat result.
- `POST /api/maps/:mapId/combat/end` (GM only)

### 2.4 Monster Compendium & Generator Endpoints
- `GET /api/monsters`
  - Query parameters: `search` (name substring), `level` (numeric integer), `alignment` (`L` / `N` / `C` / `Lawful` / `Neutral` / `Chaotic`), `system` (defaults to `shadowdark`).
  - Returns array of monster summaries: `[{ id, name, level, alignment, ac, hp, movement, attacks, features, dexModifier, darkAdapted }]`.
- `GET /api/monsters/:id`
  - Returns complete monster definition by ID or slug key.
- `GET /api/monsters/roles`
  - Returns official Shadowdark Combat Role presets (`Mook`, `Soldier`, `Striker`, `Tank`, `Controller`, `Legendary`) and baseline stat computation formulas.
- `POST /api/monsters/generate`
  - Accepts `{ partyLevel: number, rollCombat?: number, rollQuality?: number, rollStrength?: number, rollWeakness?: number, mutationRolls?: number[] }`.
  - Implements procedural d20 generation and optional d12 mutations table, returning a complete generated monster stat block.
  - Terminates combat and clears turn queue and timers.

---

## 3. Real-Time WebSocket Protocol Extension

Clients connected to `/ws/sessions/:id` exchange map and combat messages:

### 3.1 Client -> Server Messages
- `update_map`: `{ type: "update_map", mapId, data: { theme?, width?, height?, allowPlayerMovement? } }`
- `place_token`: `{ type: "place_token", mapId, token }`
- `move_token`: `{ type: "move_token", tokenId, x, y }`
- `delete_token`: `{ type: "delete_token", tokenId }`
- `start_combat`: `{ type: "start_combat", mapId, groupMonsterInitiative?, chaosMode? }`
- `roll_initiative`: `{ type: "roll_initiative", mapId, tokenId? }`
- `set_initiative`: `{ type: "set_initiative", mapId, tokenId, initiative }`
- `toggle_surprise`: `{ type: "toggle_surprise", mapId, tokenId, hasSurprise? }`
- `reorder_turn_queue`: `{ type: "reorder_turn_queue", mapId, orderedTokenIds?: string[], tokenId?: string, direction?: "up" | "down" }`
- `update_combat_settings`: `{ type: "update_combat_settings", mapId, chaosMode?, groupMonsterInitiative?, freeformMode? }`
- `next_turn`: `{ type: "next_turn", mapId }`
- `end_turn`: `{ type: "end_turn", mapId }`
- `prev_turn`: `{ type: "prev_turn", mapId }`
- `add_combat_timer`: `{ type: "add_combat_timer", mapId, timer: { name, durationRounds, category?, scope?, entityId? } }`
- `remove_combat_timer`: `{ type: "remove_combat_timer", mapId, timerId }`
- `combat_attack`: `{ type: "combat_attack", mapId, attackerId, targetId }`
- `end_combat`: `{ type: "end_combat", mapId }`

### 3.2 Server -> Client Broadcasts
- `session_state`: Extended to include `maps: Array<SessionMapWithTokensAndCombat>`.
- `map_updated`: `{ type: "map_updated", map: SessionMap }`
- `token_placed`: `{ type: "token_placed", mapId, token: MapToken, combat?: FormattedCombatState }`
- `token_moved`: `{ type: "token_moved", token: MapToken }`
- `token_updated`: `{ type: "token_updated", token: MapToken, combat?: FormattedCombatState }`
- `token_deleted`: `{ type: "token_deleted", tokenId: string, combat?: FormattedCombatState }`
- `combat_started`: `{ type: "combat_started", mapId, combat: FormattedCombatState, tokens: MapToken[] }`
- `initiative_updated`: `{ type: "initiative_updated", mapId, combat: FormattedCombatState, tokens: MapToken[] }`
- `turn_queue_reordered`: `{ type: "turn_queue_reordered", mapId, combat: FormattedCombatState }`
- `turn_changed`: `{ type: "turn_changed", mapId, combat: FormattedCombatState, tokens?: MapToken[] }`
- `combat_timer_updated`: `{ type: "combat_timer_updated", mapId, combat: FormattedCombatState }`
- `combat_attack`: `{ type: "combat_attack", mapId, attack: CombatAttackResult, targetToken: MapToken, combat?: FormattedCombatState }`
- `combat_ended`: `{ type: "combat_ended", mapId, combat: FormattedCombatState }`

---

## 4. Combat Resolution & Turn Queue Engine

### 4.0 Initiative Calculation, Advantage, Grouping & Sorting (`combat.ts`)
1. **`hasThiefInitiativeTalent(characterClass, talents)`**:
   - Inspects character talents (and class features) for `"Gain advantage on initiative rolls"`, `"Initiative Advantage"`, or `"advantage on initiative"`.
2. **`rollInitiative(dexModifier, forcedRollOrOptions)`**:
   - Standard roll: `1d20 + dexModifier`.
   - With advantage (`hasAdvantage: true` or Thief talent active): rolls two d20s (`2d20kh1 + dexModifier`), keeps `Math.max(d1, d2)`, and records `dice: [d1, d2]`, `keptDie`, `dexModifier`, `total`, `hasAdvantage: true`, and `formula` in metadata.
3. **`rollEncounterInitiative(combatants, options)`**:
   - Supports `groupMonsterInitiative: boolean`:
     - When `false` (Individual Monster Initiative): each combatant rolls its own initiative (`1d20 + dexModifier` or `2d20kh1 + dexModifier`).
     - When `true` (Grouped Monster Initiative): all `MONSTER` combatants share a single `1d20 + max(monster.dexModifier)` initiative score, while each `CHARACTER` rolls individually.
4. **`sortInitiative(tokens, options)`**:
   - Sorts combatants by:
     1. `hasSurprise` (`true` before `false` when `isSurpriseRound !== false`).
     2. Descending `initiative` score.
     3. Descending `dexModifier`.
     4. Entity priority (`CHARACTER` before `MONSTER`).
     5. Stable `id` comparison.

5. **`moveTurnQueueEntry(turnOrder, tokenId, direction, activeTokenId)`**:
   - Moves `tokenId` up (`direction = "up"`) or down (`direction = "down"`) by 1 position in `turnOrder`.
   - Clamps at boundary (cannot move top element up or bottom element down).
   - Preserves `activeTokenId` and updates `turnIndex = turnOrder.indexOf(activeTokenId)`.
6. **`reorderTurnQueue(turnOrder, orderedTokenIds, activeTokenId)`**:
   - Validates that `orderedTokenIds` contains the existing participant IDs.
   - Sets `turnOrder = orderedTokenIds` and updates `turnIndex = turnOrder.indexOf(activeTokenId)`.

### 4.1 Turn Queue Progression & Timer Ticking
1. **`advanceTurn(turnOrder, currentTurnIndex, currentRound)`**:
   - Computes `nextTurnIndex = (currentTurnIndex + 1) % turnOrder.length`.
   - `wrappedRound = nextTurnIndex === 0`.
   - `nextRound = wrappedRound ? currentRound + 1 : currentRound`.
   - Returns `{ nextTurnIndex, nextRound, roundNumber: nextRound, activeTokenId, activeTurnEntityId: activeTokenId, wrappedRound }`.
2. **`revertTurn(turnOrder, currentTurnIndex, currentRound)`**:
   - If `currentTurnIndex > 0`: `prevTurnIndex = currentTurnIndex - 1`, `prevRound = currentRound`, `wrappedBack = false`.
   - If `currentTurnIndex === 0` and `currentRound > 1`: `prevTurnIndex = turnOrder.length - 1`, `prevRound = currentRound - 1`, `wrappedBack = true`.
   - If `currentTurnIndex === 0` and `currentRound <= 1`: `prevTurnIndex = 0`, `prevRound = 1`, `wrappedBack = false`.
   - Returns `{ prevTurnIndex, prevRound, roundNumber: prevRound, activeTokenId, activeTurnEntityId: activeTokenId, wrappedBack }`.
3. **`tickCombatTimers(timers, delta)`**:
   - When `delta = -1` (round wrap forward): decrements each timer's `remainingRounds = Math.max(0, timer.remainingRounds - 1)` and sets `expired = remainingRounds === 0`.
   - When `delta = +1` (round wrap backward): increments each timer's `remainingRounds = Math.min(timer.initialRounds, timer.remainingRounds + 1)` and sets `expired = remainingRounds === 0`.

### 4.2 Attack Evaluation Algorithm
1. **D20 Roll:** Generate integer $r \in [1, 20]$.
2. **Critical Detection:**
   - If $r = 20 \implies \text{isCritical} = \text{true}, \text{hit} = \text{true}$.
   - If $r = 1 \implies \text{isFumble} = \text{true}, \text{hit} = \text{false}$.
   - Otherwise $\text{attackTotal} = r + \text{attacker.attackBonus}$. $\text{hit} = (\text{attackTotal} \ge \text{target.ac})$.
3. **Damage Evaluation:**
   - If $\text{hit} = \text{false} \implies \text{damage} = 0$.
   - If $\text{hit} = \text{true}$:
     - If $\text{isCritical} = \text{true}$: double damage dice count in formula (e.g. $1d8+2 \to 2d8+2$).
     - Roll damage formula using authoritative dice roller.
     - Calculate $\text{target.hpCurrent} = \max(0, \text{target.hpCurrent} - \text{damage})$.
4. **Synchronization:**
   - Update `MapToken` in database.
   - If `target.characterSheetId` is present, update `CharacterSheet.hpCurrent`.
   - Log combat summary in chat stream with type `COMBAT`.

---

## 5. UI Component & `data-testid` Contracts

| Element | `data-testid` | Description |
| :--- | :--- | :--- |
| Map Container / Board | `map-board` | Tactical grid viewport |
| Map Grid Cell | `map-cell-${x}-${y}` | Individual coordinate cell |
| Grid Token | `token-${tokenId}` | Placed token element |
| Token Nameplate | `token-name` | Label on token |
| Token HP Bar / Label | `token-hp` | Displays `hpCurrent / hpMax` |
| Add Token Button (GM) | `token-add-button` | Opens token placement form |
| Token Type Select | `token-type-select` | Option: `CHARACTER`, `MONSTER`, `ITEM` |
| Monster Mode Select / Tabs | `monster-mode-select` | Mode: `compendium`, `generic`, `procedural`, `custom` |
| Monster Compendium Search Input | `monster-compendium-search` | Search box for monster catalog |
| Monster Compendium Filter Level | `monster-compendium-filter-level` | Filter monsters by level |
| Monster Compendium Filter Alignment | `monster-compendium-filter-alignment` | Filter monsters by alignment |
| Monster Compendium Select | `monster-compendium-select` | Dropdown to select monster from compendium |
| Monster Combat Role Select | `monster-role-select` | Role: `Mook`, `Soldier`, `Striker`, `Tank`, `Controller`, `Legendary` |
| Monster Level Input | `monster-level-input` | Monster level for scaling roles or generic |
| Monster Party Level Input | `monster-party-level-input` | Average party level (PL) for procedural generator |
| Monster Generator Button | `monster-generate-button` | Triggers procedural monster generator |
| Monster Mutation 1 Input | `monster-mutation-1` | Procedural or custom mutation 1 |
| Monster Mutation 2 Input | `monster-mutation-2` | Procedural or custom mutation 2 |
| Monster Mutation 3 Input | `monster-mutation-3` | Procedural or custom mutation 3 |
| Token Sheet Select | `token-sheet-select` | Select PC sheet to link |
| Token Name Input | `token-name-input` | Custom token name |
| Token HP Input | `token-hp-input` | Monster / custom HP |
| Token AC Input | `token-ac-input` | Monster / custom AC |
| Token Attack Bonus Input | `token-attack-bonus-input` | Attack bonus (+X) |
| Token Damage Formula Input | `token-damage-input` | Damage formula (e.g. `1d8+2`) |
| Token Submit Button | `token-submit-button` | Submits token creation |
| Token Delete Button (GM) | `token-delete-button` | Deletes selected token |
| Allow Movement Toggle (GM) | `allow-movement-toggle` | Checkbox / switch for player movement |
| Map Theme Select (GM) | `map-theme-select` | Selector for map theme |
| Combat Tracker Panel | `combat-tracker` | Turn order and combat controls |
| Round Number Badge | `combat-round-number` | Current `roundNumber` display |
| Turn Status Banner | `turn-status-banner` | Indicates whose turn is active & permission status |
| Turn Queue List | `turn-queue-list` | Ordered list of `character` and `monster` participants |
| Turn Queue Item | `turn-queue-item` | Participant card in the turn queue |
| Turn Queue Participant Name | `turn-queue-name` | Participant name in the turn queue |
| Turn Queue Participant Type | `turn-queue-type` | Participant type badge (`character` or `monster`) |
| Turn Queue Initiative | `turn-queue-initiative` | Participant initiative score badge |
| Initiative Badge (`tokenId`) | `initiative-badge-${tokenId}` | Token-specific initiative badge in queue |
| Advantage Badge | `initiative-advantage-badge` | Badge indicating `2d20kh1` Thief advantage |
| Surprise Badge | `surprise-badge` | Badge indicating participant has Surprise (`hasSurprise: true`) |
| Surprise Toggle Button (GM) | `surprise-toggle-${tokenId}` | Toggles `hasSurprise` on a participant |
| Roll Initiative Button | `roll-initiative-button` | Rolls initiative for active player's character or all combatants (GM) |
| Token Roll Initiative Button | `roll-initiative-${tokenId}` | Rolls initiative for a specific token |
| Initiative Override Input (GM) | `initiative-input-${tokenId}` | Input to manually set/override a token's initiative |
| Initiative Override Set Button (GM) | `initiative-set-${tokenId}` | Applies manual initiative override |
| Grouped Monster Initiative Toggle (GM) | `group-monster-initiative-toggle` | Toggles grouped vs individual monster initiative |
| Chaos Mode Toggle (GM) | `chaos-mode-toggle` | Toggles Chaos Mode (re-roll initiative every round) |
| Freeform Mode Toggle (GM) | `freeform-mode-toggle` | Toggles Freeform / round-robin custom turn order |
| Turn Queue Move Up Button (GM) | `turn-queue-move-up-${tokenId}` | Moves participant up 1 position in queue |
| Turn Queue Move Down Button (GM) | `turn-queue-move-down-${tokenId}` | Moves participant down 1 position in queue |
| Surprise Round Banner | `surprise-round-banner` | Indicates active Surprise Round |
| Turn Queue HP | `turn-queue-hp` | Participant HP in the turn queue |
| Turn Queue Active Badge | `turn-queue-active-badge` | Active turn badge on current participant |
| Start Combat Button (GM) | `combat-start-button` | Initiates turn-based combat |
| Previous Turn Button (GM) | `combat-prev-button` | Reverts to previous turn |
| Next Turn Button (GM) | `combat-next-button` | Advances to next turn |
| End Turn Button (Player) | `combat-end-turn-button` | Active player ends their turn |
| End Combat Button (GM) | `combat-end-button` | Concludes combat |
| Active Turn Indicator | `active-turn-indicator` | Highlights current combatant |
| Target Selector | `combat-target-select` | Selects target token to attack |
| Attack Action Button | `combat-attack-button` | Executes attack against selected target |
| Combat Timers Section | `combat-timers` | Personal & GM round timer countdowns |
| Combat Timer Item | `combat-timer-item` | Individual round timer row |
| Combat Timer Name | `combat-timer-name` | Name of the round timer |
| Combat Timer Rounds | `combat-timer-rounds` | Remaining rounds or `Expired` status |
| Timer Name Input | `timer-name-input` | Input for new timer name |
| Timer Category Select | `timer-category-select` | Select for `spell`, `light`, `dying`, `custom` |
| Timer Scope Select | `timer-scope-select` | Select for `personal`, `gm` |
| Timer Rounds Input | `timer-rounds-input` | Duration in rounds input |
| Timer Add Button | `timer-add-button` | Adds round timer |
| Timer Delete Button | `timer-delete-button` | Removes round timer |
| Combat Log Message | `combat-log-message` | Formatted combat summary in chat feed |
