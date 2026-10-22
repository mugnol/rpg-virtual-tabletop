# Functional Specification: Turn-Based Combat & Campaign Turn Queue

**Document ID:** SPEC-F-08  
**Module:** Turn-Based Combat & Campaign Turn Queue (Phase 4)  
**Status:** Approved  
**Related Requirements:** BR-43..BR-50, UC-39..UC-46

---

## 1. Overview & Objective
This specification defines the turn-based tactical combat engine and campaign turn queue operating inside campaign session rooms. It coordinates:
- A persistent, real-time synchronized **Campaign Turn Queue** containing all active encounter participants: Player Characters (`character`) and Monsters/NPCs (`monster`).
- A visual **Turn Tracker** UI component visible to both the GM and Players via WebSockets.
- Initiative rolling, descending turn order sorting, `activeTurnEntityId` tracking, and `roundNumber` tracking (starting at Round 1).
- GM turn progression controls (`Start Combat`, `Next Turn`, `Previous Turn`, `End Combat`) and active player turn control (`End Turn` on their own character's turn).
- Automatic `roundNumber` increment upon completing a full queue cycle, triggering personal and GM round timer countdowns (e.g., spell durations, light timers, dying timers).
- Turn validation and visual movement/action highlighting during active combat mode.
- Server-authoritative attack and damage resolution enforcing RPG rules (natural 20 critical hits, natural 1 automatic misses, Armor Class comparison, and HP deduction).
- Real-time combat logging into the session chat feed and token HP updates.

---

## 2. Business Rules (BR)

### BR-43: Combat Lifecycle & Campaign Turn Queue
- Combat and turn tracking are scoped to a tactical map within a campaign `GameSession`.
- Only the GM can initiate (`Start Combat`) or terminate (`End Combat`) an encounter.
- When combat starts:
  1. Participating combatants include all active `CHARACTER` (`character`) and `MONSTER` (`monster`) entities on the map (`ITEM` tokens are excluded).
  2. Each participant receives an initiative score and is placed into the synchronized `turnQueue`.
  3. `round` / `roundNumber` initializes to `1`.
  4. `turnIndex` initializes to `0`.
  5. `activeTokenId` / `activeTurnEntityId` is assigned to the first participant in the `turnQueue`.
  6. Combat state becomes `active: true` and broadcasts immediately to the GM and all Players in the room.
- When combat ends:
  - `active` becomes `false`, the turn queue and active turn state are cleared, and exploration movement rules resume according to map settings.

### BR-44: Initiative Calculation & Sorting
- Initiative formula:
  $$\text{Initiative} = \text{Roll} + \text{InitiativeModifier}$$
  - For `CHARACTER` (`character`) participants linked to a `CharacterSheet`, the modifier is the character's Dexterity modifier or system-derived initiative score.
  - For unlinked tokens or `MONSTER` (`monster`) participants, the modifier is the token's configured initiative bonus (default 0).
- Participants in the `turnQueue` are sorted in descending order of total initiative.
- Tie-breaking: higher initiative modifier breaks ties; if identical, stable identifier ordering applies.

### BR-45: Turn Control, Progression & Validation
- In active combat, actions and movements are strictly validated against `activeTurnEntityId`:
  - Only the player controlling the active `character` entity (or the GM) may move or attack on that turn.
  - The GM may act on behalf of any monster or participant.
  - Valid movement cells within the active combatant's `speed` (default 6 squares) are highlighted on the tactical grid.
  - Out-of-turn movement or attack attempts by inactive players are rejected with `403 NOT_YOUR_TURN` (`"It is not your turn to act"`).
- **Advance to Next Turn (`Next Turn` / Player `End Turn`)**:
  - The GM can click `Next Turn` at any time during active combat.
  - The active player can click `End Turn` on their own character's turn to advance the queue to the next participant. Inactive players cannot advance or end someone else's turn.
  - Advancing the turn sets `turnIndex = (turnIndex + 1) % turnQueue.length` and updates `activeTurnEntityId`.
  - When wrapping from the last participant back to index `0`, `roundNumber` automatically increments by `1`.
- **Revert to Previous Turn (`Previous Turn`)**:
  - Only the GM can click `Previous Turn` to revert the turn queue to the previous participant.
  - If `turnIndex > 0`, `turnIndex` decrements by `1` within the same round.
  - If `turnIndex === 0` and `roundNumber > 1`, `turnIndex` wraps backward to `turnQueue.length - 1` and `roundNumber` decrements by `1` (minimum Round 1).

### BR-46: Attack Resolution Mechanics
- An attack action requires an attacker (`activeTurnEntityId`) and a valid target (`targetTokenId` on the map).
- Server rolls $1d20$ authoritatively:
  1. **Natural 20 (Critical Hit):** Automatic hit regardless of target AC. Damage dice count is doubled (e.g., $1d8+2$ becomes $2d8+2$).
  2. **Natural 1 (Critical Miss / Fumble):** Automatic miss regardless of target AC. Zero damage is dealt.
  3. **Standard Roll:**
     $$\text{AttackTotal} = d20 + \text{Attacker.attackBonus}$$
     - If $\text{AttackTotal} \ge \text{Target.ac}$, the attack **HITS**.
     - Otherwise, the attack **MISSES**.

### BR-47: Damage Calculation & Target HP Synchronization
- On a hit:
  - Damage is evaluated from the attacker's `damageFormula` (e.g., $1d8+2$).
  - Target current hit points are reduced:
    $$\text{Target.hpCurrent}_{\text{new}} = \max(0, \text{Target.hpCurrent}_{\text{old}} - \text{Damage})$$
- If the target token is linked to a campaign `CharacterSheet`, the character sheet's `hpCurrent` is updated in the database simultaneously.
- If target HP reaches 0:
  - Status is flagged as defeated / unconscious, and if the target is a player character (`CHARACTER`) in active combat, a personal `dying` round timer is automatically started if not already present.
- Real-time combat event is broadcast to all clients and logged to session chat.

### BR-48: Round Progression & Personal/GM Round Timer Countdowns
- Combat supports personal (participant-scoped) and GM (encounter-scoped) round timers for tracking effects such as:
  - `spell`: Spell durations (e.g., *Bless*, *Protection from Evil*).
  - `light`: Light source countdowns (e.g., *Torch*, *Lantern*).
  - `dying`: Dying countdown timers for characters at 0 HP.
  - `custom`: Custom GM or personal round timers.
- Whenever a full cycle of the turn queue completes (`roundNumber` increments by 1):
  - Every active round timer decrements its `remainingRounds` by 1 (`remainingRounds = max(0, remainingRounds - 1)`).
  - Timers reaching `0` are marked `expired: true`.
  - Updated timer states are persisted and broadcast in real time to all connected session participants.

---

## 3. Use Cases (UC)

### UC-39: GM Initiates Combat & Turn Queue
1. GM clicks "Start Combat" on the session room map.
2. System rolls initiative for all active `character` and `monster` participants.
3. Visual Turn Tracker opens for both GM and Players, displaying the ordered Turn Queue, participant types, HP, and initiative scores.
4. Participant with highest initiative is marked as `activeTurnEntityId`. `roundNumber` is set to 1.

### UC-40: Turn Advancement (`Next Turn` & Player `End Turn`)
1. Active combatant completes their movement and actions.
2. The active player clicks "End Turn" on their own character's turn (or the GM clicks "Next Turn").
3. System advances `activeTurnEntityId` to the next participant in the Turn Queue and broadcasts `turn_changed`.
4. If the last participant in the queue completed their turn, `roundNumber` increments by 1 and all personal/GM round timers tick down by 1 round.

### UC-40b: GM Reverts to Previous Turn (`Previous Turn`)
1. GM clicks "Previous Turn" in the Turn Tracker.
2. System shifts `activeTurnEntityId` back to the previous participant in the queue (decrementing `roundNumber` if wrapping back from index 0 on Round > 1, and restoring timer ticks).
3. Updated turn state broadcasts in real time to all connected clients.

### UC-41: Standard Attack Execution (Hit)
1. Active player selects their target enemy on the map.
2. Player clicks "Attack".
3. Server rolls $1d20 + \text{attackBonus}$. Total is $\ge \text{target.ac}$.
4. Server rolls damage, reduces target HP, and updates the token on the map.
5. Combat summary entry appears in session chat feed:
   `⚔️ Player attacks Goblin: Rolled 17 vs AC 13 -> HIT! 6 damage dealt (Goblin HP: 4/10)`.

### UC-42: Critical Hit Attack Execution
1. Attacker rolls a natural 20.
2. Server flags Critical Hit! Damage dice are doubled ($2d8+3$ instead of $1d8+3$).
3. Target HP is reduced and critical hit notification is broadcast.

### UC-43: Attack Execution (Miss)
1. Attacker rolls total below target AC (or natural 1).
2. Server registers Miss. No damage is applied.
3. Chat logs: `⚔️ Player attacks Goblin: Rolled 11 vs AC 13 -> MISS!`.

### UC-44: Player Acts Out of Turn Rejected
1. Inactive player attempts to move a token, attack, or end turn when `activeTurnEntityId` does not belong to their character.
2. System denies the request with `"It is not your turn to act"`.

### UC-45: GM Concludes Combat
1. GM clicks "End Combat".
2. Turn tracker closes. Combat state is cleared. Map returns to exploration mode.

### UC-46: Personal & GM Round Timer Countdowns
1. During an active encounter, GM or Player adds a round timer (e.g., "Torch Light" for 3 rounds, "Bless" spell for 2 rounds, or a "Dying" timer).
2. Timer appears in the Turn Tracker with its remaining round count.
3. As turns progress and a full cycle of the Turn Queue completes, `roundNumber` increments and each timer's `remainingRounds` decrements by 1 across all connected clients.
