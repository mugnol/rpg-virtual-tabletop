# Functional Specification — Session Chat & Shared Dice Roller

| | |
|---|---|
| Feature ID | CHAT_DICE |
| Phase | 3 |
| Status | Approved for implementation |
| Depends on | ROOMS, AUTH |

## 1. Overview

Inside an active game session, all players and the GM need clear, synchronized communication. This feature provides:
1. **Real-time text chat** with persistent message history and GM moderation controls (deleting/redacting messages in real time).
2. **Server-authoritative dice rolling** supporting standard RPG polyhedral dice (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`), multiple dice, and arithmetic modifiers (`+`/`-`), paired with synchronized visual roll animations and roll breakdowns posted into the session feed.

Voice and video chat are out of scope.

## 2. Business Rules

| ID | Rule |
|---|---|
| BR-29 | Chat messages belong to a session and are persisted in the database. Messages have a `type`: `"TEXT"` (player/GM message), `"DICE"` (roll result), or `"SYSTEM"` (session lifecycle events). |
| BR-30 | Initial message history: when a participant enters a session room, the system loads the chronological message history (most recent 50 messages by default) so players catching up or refreshing see full context. |
| BR-31 | GM Moderation:
  - The GM can delete/redact any message in real time.
  - When a message is deleted, it is marked as deleted in the database and immediately removed/redacted on all connected clients via a WebSocket `message_deleted` event.
  - Non-GM players cannot delete messages.
  - When a session is `PAUSED` or `ENDED`, player chat input is disabled. |
| BR-32 | Supported Dice Notation:
  - Standard polyhedral dice: `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`.
  - Format: `[N]dX[+M|-M]`, where `1 <= N <= 100` (count of dice, default 1), `X in {4, 6, 8, 10, 12, 20, 100}`, and optional integer modifier `M` (`-999 <= M <= 999`).
  - Example valid formulas: `d20`, `1d20+5`, `2d6+3`, `4d6`, `1d100-10`, `3d8+2`.
  - Invalid formulas are rejected with field errors.
  - An optional human-readable roll label (e.g. "Stealth Check", "Initiative", "Longsword Damage") can accompany the roll. |
| BR-33 | Server-Authoritative Randomness:
  - Clients never calculate dice roll totals. The client requests a roll via formula (e.g. `2d6+3`).
  - The server parses the formula, generates cryptographically sound random values for each individual die, applies the modifier, calculates the total, and stores the roll as a message in the session history.
  - The server broadcasts the roll event `{ id, userId, userName, formula, dice, modifier, total, label, createdAt }` to all connected participants in the room. |
| BR-34 | Synchronized Visual Dice Animation:
  - When a `dice_roll` event is received via WebSocket, all connected clients display an animated roll in the dice area for ~1–2 seconds, displaying rotating/tumbling dice faces that resolve to the server's authoritative individual die values.
  - Once animation concludes (or immediately in the feed), the final roll breakdown (`2d6+3 = [4, 5] + 3 = 12`) is displayed in the session chat log. |

## 3. Use Cases

### UC-30 Send a chat message
- **Actor:** Connected session participant
- **Precondition:** Session status is `ACTIVE`.
- **Main flow:**
  1. Participant types message into the chat bar and hits Enter / clicks Send.
  2. Client sends message payload over WebSocket.
  3. Server validates content (non-empty, max 1,000 characters), persists to DB, and broadcasts `chat_message` to all participants in the room.
  4. Message appears in everyone's chat window in real time.

### UC-31 Delete/moderate a chat message (GM only)
- **Actor:** Campaign GM
- **Main flow:**
  1. GM hovers over a message and clicks the "Delete" (trash) icon.
  2. Client sends `delete_message` event with `messageId`.
  3. Server verifies the user is the campaign GM, flags the message as deleted in DB, and broadcasts `message_deleted` to the room.
  4. All clients immediately remove the message from the view.
- **Exception flow EF-31.1:** Non-GM attempting deletion is rejected with an error event.

### UC-32 Roll dice via interactive tray
- **Actor:** Connected session participant
- **Precondition:** Session status is `ACTIVE`.
- **Main flow:**
  1. User clicks dice buttons on the tray (e.g. clicking `d20` once and `+` modifier input `3`).
  2. User clicks "Roll" (or triggers quick-roll from sheet).
  3. Client sends `roll_dice` event with formula `1d20+3` and optional label.
  4. Server validates formula, rolls random values, stores roll log, and broadcasts `dice_roll` event.
  5. All participants see the synchronized visual roll animation followed by the roll entry in the chat log.
- **Alternative flow AF-32.1:** User types `/roll 2d6+2 Attack` directly in the chat bar. System parses it as a dice roll command.

## 4. Out of Scope (Phase 3)

- 3D WebGL physics-based dice engines (e.g. Cannon.js/Three.js heavy bundles). Synchronized SVG/CSS animated polyhedrals are used for instant load, accessibility, and reliability.
- Voice/video WebRTC streams.
- Whispered / private secret rolls (all rolls in Phase 3 are public to the room).
