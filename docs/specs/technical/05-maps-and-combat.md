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
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
}

model CombatState {
  id            String     @id @default(cuid())
  mapId         String     @unique
  map           SessionMap @relation(fields: [mapId], references: [id], onDelete: Cascade)
  active        Boolean    @default(false)
  round         Int        @default(1)
  turnIndex     Int        @default(0)
  activeTokenId String?
  turnOrder     String     @default("[]") // JSON serialized Array<string> of MapToken IDs
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}
```

---

## 2. REST API Endpoints

### 2.1 Map Management
- `GET /api/sessions/:sessionId/maps`
  - Returns array of maps for the session.
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
  - Updates token stats or position `(x, y)` subject to movement rules.
- `DELETE /api/tokens/:tokenId` (GM only)
  - Removes a token from the map.

### 2.3 Combat Controls
- `POST /api/maps/:mapId/combat/start` (GM only)
  - Rolls initiative, initializes turn order and round 1, activates combat.
- `POST /api/maps/:mapId/combat/next` (GM or active player)
  - Advances turn to next combatant (increments round on wrap).
- `POST /api/maps/:mapId/combat/attack` (GM or active player)
  - Executes attack from active token to target token; returns combat result.
- `POST /api/maps/:mapId/combat/end` (GM only)
  - Terminates combat and clears turn state.

---

## 3. Real-Time WebSocket Protocol Extension

Clients connected to `/ws/sessions/:id` exchange map and combat messages:

### 3.1 Client -> Server Messages
- `update_map`: `{ type: "update_map", mapId, theme?, width?, height?, allowPlayerMovement? }`
- `place_token`: `{ type: "place_token", mapId, tokenData }`
- `move_token`: `{ type: "move_token", tokenId, x, y }`
- `delete_token`: `{ type: "delete_token", tokenId }`
- `start_combat`: `{ type: "start_combat", mapId }`
- `next_turn`: `{ type: "next_turn", mapId }`
- `combat_attack`: `{ type: "combat_attack", mapId, attackerId, targetId }`
- `end_combat`: `{ type: "end_combat", mapId }`

### 3.2 Server -> Client Broadcasts
- `session_state`: Extended to include `maps: Array<SessionMapWithTokensAndCombat>`.
- `map_updated`: `{ type: "map_updated", map: SessionMap }`
- `token_placed`: `{ type: "token_placed", token: MapToken }`
- `token_moved`: `{ type: "token_moved", token: MapToken }`
- `token_updated`: `{ type: "token_updated", token: MapToken }`
- `token_deleted`: `{ type: "token_deleted", tokenId: string }`
- `combat_started`: `{ type: "combat_started", combat: CombatState, tokens: MapToken[] }`
- `turn_changed`: `{ type: "turn_changed", combat: CombatState }`
- `combat_attack`: `{ type: "combat_attack", attack: CombatAttackResult, targetToken: MapToken }`
- `combat_ended`: `{ type: "combat_ended", combat: CombatState }`

---

## 4. Combat Resolution Engine

### 4.1 Attack Evaluation Algorithm
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
| Start Combat Button (GM) | `combat-start-button` | Initiates turn-based combat |
| Next Turn Button | `combat-next-button` | Advances turn |
| End Combat Button (GM) | `combat-end-button` | Concludes combat |
| Active Turn Indicator | `active-turn-indicator` | Highlights current combatant |
| Target Selector | `combat-target-select` | Selects target token to attack |
| Attack Action Button | `combat-attack-button` | Executes attack against selected target |
| Combat Log Message | `combat-log-message` | Formatted combat summary in chat feed |
