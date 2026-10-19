# Technical Specification — Rooms, Chat & Dice Roller

| | |
|---|---|
| Phase | 3 |
| Status | Approved for implementation |
| Companion | functional `05-rooms-and-sessions.md`, `06-chat-and-dice.md`; appends to technical `01-architecture.md` |

## 1. Architecture & Real-Time Protocol

Phase 3 introduces WebSocket connectivity alongside the existing Express HTTP application. The server attaches a WebSocket server (`ws`) to the shared HTTP server.

```
Client (Browser / React)
  ├── HTTP /api/campaigns/:id/sessions (REST CRUD)
  └── WebSocket /ws/sessions/:id
        ├── Handshake Auth: Session cookie verified via JWT
        ├── Room Membership: Scoped to session & campaign
        └── Bi-directional JSON Events:
              - chat_message, roll_dice, delete_message, set_status
              - presence_update, dice_roll, message_deleted
```

## 2. Data Model (append to `server/prisma/schema.prisma`)

```prisma
model GameSession {
  id          String   @id @default(cuid())
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  name        String
  description String   @default("")
  status      String   @default("SCHEDULED") // "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED"
  startedAt   DateTime?
  endedAt     DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  messages    SessionMessage[]
}

model SessionMessage {
  id         String      @id @default(cuid())
  sessionId  String
  session    GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId     String?
  user       User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  type       String      @default("TEXT") // "TEXT" | "DICE" | "SYSTEM"
  content    String      // plain text for TEXT/SYSTEM; JSON string for DICE
  deleted    Boolean     @default(false)
  createdAt  DateTime    @default(now())
}
```

Campaign model appends: `sessions GameSession[]`.
User model appends: `messages SessionMessage[]`.

## 3. REST API

All routes require authentication (`requireAuth`). Non-members get 404.

| Method & Path | Authz | Request & Response |
|---|---|---|
| `GET /api/campaigns/:id/sessions` | Campaign participant | → 200 `{ sessions: SessionSummary[] }` |
| `POST /api/campaigns/:id/sessions` | GM only | `{ name: string, description?: string }` → 201 `{ session: SessionDetail }` |
| `GET /api/sessions/:id` | Campaign participant | → 200 `{ session: SessionDetail }` |
| `PATCH /api/sessions/:id` | GM only | `{ name?, description?, status? }` → 200 `{ session: SessionDetail }` |
| `DELETE /api/sessions/:id` | GM only | → 204 |
| `GET /api/sessions/:id/messages` | Campaign participant | `?limit=50` → 200 `{ messages: MessageItem[] }` |

## 4. WebSocket Protocol Specification

WebSocket Endpoint: `/ws/sessions/:id`

### Handshake & Authentication
1. Connection request sends session cookie (`rpg_session`).
2. Server validates JWT with `verifySessionToken(token)`.
3. Server checks that user is a member or owner of the session's campaign. If invalid or unauthenticated, server terminates connection with code 4401 or 4404.

### Client-to-Server Event Schema
Every frame is valid JSON with `type` and payload:
- `chat_message`: `{ type: "chat_message", content: string }`
- `roll_dice`: `{ type: "roll_dice", formula: string, label?: string }`
- `delete_message`: `{ type: "delete_message", messageId: string }` (GM only)
- `set_status`: `{ type: "set_status", status: "ACTIVE" | "PAUSED" | "ENDED" }` (GM only)

### Server-to-Client Event Schema
- `session_state`: Sent immediately on join:
  ```json
  {
    "type": "session_state",
    "session": { "id": "...", "name": "...", "status": "ACTIVE", "campaignId": "..." },
    "presence": [{ "userId": "...", "displayName": "...", "role": "GM" }],
    "messages": [...]
  }
  ```
- `presence_update`: `{ type: "presence_update", presence: [...] }`
- `chat_message`: `{ type: "chat_message", message: { id, sessionId, userId, userName, type, content, createdAt, deleted } }`
- `dice_roll`:
  ```json
  {
    "type": "dice_roll",
    "roll": {
      "id": "...",
      "userId": "...",
      "userName": "...",
      "formula": "2d6+3",
      "dice": [4, 5],
      "modifier": 3,
      "total": 12,
      "label": "Damage",
      "createdAt": "..."
    }
  }
  ```
- `message_deleted`: `{ type: "message_deleted", messageId: "..." }`
- `status_changed`: `{ type: "status_changed", status: "PAUSED" }`
- `error`: `{ type: "error", code: "...", message: "..." }`

## 5. Dice Parser & RNG Engine

Formula regular expression:
`/^(?:([1-9][0-9]*)?d(4|6|8|10|12|20|100))([+-][0-9]{1,3})?$/i`

- Count: 1 to 100 (default 1)
- Sides: 4, 6, 8, 10, 12, 20, 100
- Modifier: optional integer between -999 and +999
- RNG: `crypto.randomInt(1, sides + 1)`
- Pure unit-tested module in `server/src/modules/dice/dice.ts`.

## 6. UI Testability Contract (data-testid additions)

| testid | Element |
|---|---|
| `session-section`, `session-list`, `session-item`, `session-status-badge` | Campaign detail sessions list & items |
| `session-create-button`, `session-create-form`, `session-name-input`, `session-create-submit` | GM create session panel |
| `page-session`, `session-title`, `session-status` | Session room view |
| `session-start-button`, `session-pause-button`, `session-resume-button`, `session-end-button` | GM lifecycle control buttons |
| `presence-list`, `presence-user` | Connected participant presence roster |
| `chat-stream`, `chat-message`, `chat-author`, `chat-content`, `chat-delete-button` | Chat panel and items |
| `chat-input`, `chat-send-button` | Chat input bar |
| `dice-roller-tray`, `dice-formula-input`, `dice-roll-button`, `dice-button-<sides>` | Interactive dice roller tray (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) |
| `dice-animation-overlay`, `dice-roll-total`, `dice-roll-breakdown` | Shared roll animation and result badge |
