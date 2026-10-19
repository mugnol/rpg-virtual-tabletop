# Functional Specification — Game Rooms & Sessions

| | |
|---|---|
| Feature ID | ROOMS |
| Phase | 3 |
| Status | Approved for implementation |
| Depends on | AUTH, CAMP |

## 1. Overview

Tabletop RPG gameplay happens in **Sessions** (also called **Game Rooms**). A session is scoped to a specific campaign. The campaign's Game Master (GM) controls the room's lifecycle: creating rooms, opening/starting them for real-time play, pausing them during breaks, and ending/closing them when play concludes.

All connected participants (GM and joined players) communicate through a real-time WebSocket connection that tracks player presence in the room, synchronizes state, and coordinates chat and dice rolling.

## 2. Business Rules

| ID | Rule |
|---|---|
| BR-24 | A game session is scoped to exactly one campaign. Only the campaign GM (owner) can create a session, edit its details, change its lifecycle status, or delete it. |
| BR-25 | A campaign may have multiple past ended sessions, but at most one `ACTIVE` or `PAUSED` session at any given time. |
| BR-26 | Access control: Only authenticated participants of the campaign (the GM and joined players) may view session metadata, load its chat history, or connect to its real-time WebSocket room. Non-participants receive 404 Not Found (existence of the session is not revealed). |
| BR-27 | Session Lifecycle Statuses:
  - `SCHEDULED`: Session created but not yet open for live play.
  - `ACTIVE`: Session is open and running. Participants can join the WebSocket room, see each other's presence, send chat messages, and roll dice.
  - `PAUSED`: Session is temporarily halted by the GM (e.g. bio break, rules discussion). All participants stay connected and see a "Paused by GM" indicator; player chat and dice roll inputs are disabled until resumed.
  - `ENDED`: Session is closed and archived. The room becomes read-only; historical messages and dice rolls can be inspected, but no new messages or rolls can be submitted. |
| BR-28 | Real-Time Presence: Connecting to a session room over WebSockets adds the participant to the room's real-time presence roster. Disconnecting removes them. The full presence list (user ID, display name, role) is broadcast to all clients in the room whenever presence changes. |

## 3. Use Cases

### UC-26 Create a game session (GM only)
- **Actor:** Campaign GM
- **Main flow:**
  1. GM navigates to the campaign detail page and clicks "New session".
  2. GM inputs session name and optional description, then submits.
  3. System creates the session with status `SCHEDULED`.
- **Exception flow EF-26.1:** Non-GM player attempting creation is refused (403 Forbidden).

### UC-27 Manage session lifecycle (GM only)
- **Actor:** Campaign GM
- **Main flow:**
  1. GM opens the session room or campaign detail page.
  2. GM clicks "Start Session" (transitions from `SCHEDULED` or `PAUSED` to `ACTIVE`), "Pause Session" (`ACTIVE` to `PAUSED`), or "End Session" (`ACTIVE`/`PAUSED` to `ENDED`).
  3. Status change is persisted to DB and broadcast over WebSockets to all connected participants immediately.

### UC-28 Join a live session room
- **Actor:** Any campaign participant (GM or Player)
- **Main flow:**
  1. Participant navigates to `/sessions/:id` (or clicks "Join Session" from the campaign detail page).
  2. System verifies membership, renders the session room UI, and establishes an authenticated WebSocket connection.
  3. Server broadcasts updated presence to everyone in the room and sends the initial session state (metadata, presence list, and recent message history) to the client.
- **Exception flow EF-28.1:** Non-member receives 404. Guest receives 401.

### UC-29 Leave a session room
- **Actor:** Session participant
- **Main flow:** Participant navigates away or closes tab. The WebSocket disconnects; the server removes the user from the presence list and broadcasts the updated roster to the remaining room participants.

## 4. UI Summary (Phase 3)

- Campaign detail page: "Sessions" section listing past and scheduled sessions, with status badges (`SCHEDULED`, `ACTIVE`, `PAUSED`, `ENDED`), "New session" button (GM only), and "Join room" button for participants.
- Session Room page (`/sessions/:id`):
  - Top header: Session name, status badge, GM lifecycle controls ("Start", "Pause", "Resume", "End"), and link back to campaign.
  - Left/side panel: Live Participant Presence roster (GM and players currently in the room).
  - Main center panel: Real-time chat & dice roll event stream.
  - Bottom panel: Message input bar and interactive Dice Roller tray.
