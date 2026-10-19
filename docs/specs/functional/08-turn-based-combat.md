# Functional Specification: Turn-Based Combat

**Document ID:** SPEC-F-08  
**Module:** Turn-Based Combat (Phase 4)  
**Status:** Approved  
**Related Requirements:** BR-43..BR-50, UC-39..UC-45

---

## 1. Overview & Objective
This specification defines the turn-based tactical combat engine operating on tactical session maps. It coordinates:
- Initiative rolling and descending turn order tracking.
- Round counting and active token highlighting.
- Turn cycling (`Next Turn`) and combat lifecycle management (`Start Combat`, `End Combat`).
- Server-authoritative attack and damage resolution enforcing RPG rules (natural 20 critical hits, natural 1 automatic misses, Armor Class comparison, and HP deduction).
- Real-time combat logging into the session chat feed and token HP updates.

---

## 2. Business Rules (BR)

### BR-43: Combat Lifecycle
- Combat is scoped to a tactical map within a `GameSession`.
- Only the GM can initiate (`Start Combat`) or terminate (`End Combat`) an encounter.
- When combat starts:
  1. Participating combatants include all `CHARACTER` and `MONSTER` tokens on the map (`ITEM` tokens are excluded).
  2. Each participant receives an initiative value.
  3. `round` initializes to 1.
  4. `turnIndex` initializes to 0.
  5. `activeTokenId` is assigned to the first combatant in initiative order.
  6. Combat state becomes `active: true`.
- When combat ends:
  - `active` becomes false, turn order is cleared, and free movement resumes according to map settings.

### BR-44: Initiative Calculation & Sorting
- Initiative formula:
  $$\text{Initiative} = 1d20 + \text{InitiativeModifier}$$
  - For `CHARACTER` tokens linked to a `CharacterSheet`, the modifier is the character's Dexterity modifier or system-derived initiative score.
  - For unlinked tokens or monsters, the modifier is the token's configured initiative bonus (default 0).
- Combatants are sorted in descending order of total initiative.
- Tie-breaking: higher initiative modifier breaks ties; if identical, stable identifier ordering applies.

### BR-45: Turn Cycling & Movement Economy
- In active combat, actions and moves are strictly turn-restricted:
  - Only the player controlling the `activeTokenId` (or the GM) may act on that turn.
  - GM may act on behalf of any monster or token.
- Advancing turn (`Next Turn`):
  - Increments `turnIndex = (turnIndex + 1) % combatants.length`.
  - When wrapping to index 0, `round` increments by 1.
  - `activeTokenId` shifts to the new combatant.
  - Movement points for the new active token reset to `token.speed` (default 6 cells).

### BR-46: Attack Resolution Mechanics
- An attack action requires an attacker (`activeTokenId`) and a valid target (`targetTokenId` on the map).
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
  - Status is flagged as defeated / unconscious.
- Real-time combat event is broadcast to all clients and logged to session chat.

---

## 3. Use Cases (UC)

### UC-39: GM Initiates Combat
1. GM clicks "Start Combat" on the session room map.
2. System rolls initiative for all characters and monsters.
3. Turn tracker displays combatants in descending initiative order.
4. Token with highest initiative is marked as active. Round is set to 1.

### UC-40: Turn Advancement
1. Active combatant completes actions.
2. GM or active player clicks "Next Turn".
3. System shifts active turn highlight to next combatant.
4. If the last combatant ended their turn, round counter increments.

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
1. Inactive player attempts to attack or move out of turn.
2. System denies the request with "It is not your turn".

### UC-45: GM Concludes Combat
1. GM clicks "End Combat".
2. Turn tracker closes. Combat state is cleared. Map returns to exploration mode.
