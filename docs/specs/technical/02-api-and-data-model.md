# Technical Specification — Data Model & API Contract

| | |
|---|---|
| Phase | 1 |
| Status | Approved for implementation |
| Companion | `01-architecture.md` |

## 1. Data Model (Prisma schema — single source of truth)

```prisma
datasource db {
  provider = "sqlite" // swapped to "postgresql" in PG environments by scripts/prisma-provider.sh
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  displayName  String
  role         String   // "GM" | "PLAYER" — validated in app layer (D-3/D-4: no enums for provider portability)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  ownedCampaigns Campaign[]
  memberships    CampaignMember[]
  createdInvites CampaignInvite[]
}

model Campaign {
  id          String   @id @default(cuid())
  name        String
  description String   @default("")
  system      String   @default("generic")
  archived    Boolean  @default(false)
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members CampaignMember[]
  invites CampaignInvite[]
}

model CampaignMember {
  id         String   @id @default(cuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt   DateTime @default(now())

  @@unique([campaignId, userId])
}

model CampaignInvite {
  id          String    @id @default(cuid())
  campaignId  String
  campaign    Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  createdById String
  createdBy   User      @relation(fields: [createdById], references: [id], onDelete: Cascade)
  token       String    @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())
}
```

Deleting a campaign cascades to memberships and invites (BR-3/UC-10).
Deleting a user cascades to owned campaigns and memberships.

## 2. Conventions

- Base URL: `/api`. Request/response bodies are JSON. Dates are ISO-8601 strings.
- Auth cookie: `rpg_session` (see 01-architecture.md §6), sent automatically.
- Success status codes: 200, 201, 204 (logout, delete).
- Error body (all non-2xx):
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Human-readable summary", "details": [ { "path": "email", "message": "Invalid email" } ] } }
  ```
  `details` is present for 400 validation errors, otherwise omitted.
- Error codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `EMAIL_TAKEN` (409), `ALREADY_MEMBER` (409), `INVITE_EXPIRED` (410), `INTERNAL_ERROR` (500).

### DTOs

```jsonc
// User
{ "id": "cuid", "email": "...", "displayName": "...", "role": "GM" | "PLAYER" }

// CampaignListItem
{ "id", "name", "system", "archived": false, "relationship": "OWNER" | "PLAYER", "updatedAt" }

// CampaignDetail
{
  "id", "name", "description", "system", "archived", "createdAt", "updatedAt",
  "members": [ { "userId", "displayName", "role": "OWNER" | "PLAYER", "joinedAt" } ],
  "invites": [ { "id", "token", "expiresAt", "createdAt" } ]        // owner only; [] for non-owners
}
```

## 3. Endpoints

### Auth

| Method & path | Auth | Request → Response |
|---|---|---|
| `POST /api/auth/register` | none | `{email, password, displayName, role}` → 201 `{user}` + session cookie. 400 validation; 409 `EMAIL_TAKEN`. |
| `POST /api/auth/login` | none | `{email, password}` → 200 `{user}` + cookie. 401 `INVALID_CREDENTIALS` "Invalid email or password" (same for unknown email and wrong password). |
| `POST /api/auth/logout` | none (idempotent) | → 204, cookie cleared. |
| `GET /api/auth/me` | session | → 200 `{user}`; 401 `UNAUTHENTICATED`. |

Validation: email format; password ≥ 8 chars; displayName 2–40 chars; role ∈ {`GM`,`PLAYER`}. Email normalized to lowercase before uniqueness check and lookup.

### Campaigns

All require a session (else 401).

| Method & path | Authz | Request → Response |
|---|---|---|
| `GET /api/campaigns` | any | → 200 `{campaigns: CampaignListItem[]}` — owned ∪ member-of, `updatedAt` desc. |
| `POST /api/campaigns` | GM | `{name, description?, system?}` → 201 `{campaign: CampaignDetail}`. 403 `FORBIDDEN` for players. 400 per BR-9. |
| `GET /api/campaigns/:id` | owner/member | → 200 `{campaign: CampaignDetail}`. Non-participant → 404 `NOT_FOUND`. |
| `PATCH /api/campaigns/:id` | owner | `{name?, description?, system?, archived?}` (all optional, partial) → 200 `{campaign: CampaignDetail}`. Non-owner member → 403; non-participant → 404. |
| `DELETE /api/campaigns/:id` | owner | → 204. Non-owner member → 403; non-participant → 404. |
| `POST /api/campaigns/:id/invites` | owner | → 201 `{invite: {id, token, expiresAt, createdAt}}` — single-use, `expiresAt = now + 7 days`, token 24-char URL-safe random. Non-owner member → 403; non-participant → 404. |
| `POST /api/campaigns/join` | any | `{token}` → 200 `{campaign: CampaignDetail}` (membership created). Unknown token → 404 `NOT_FOUND` ("Invalid invite code"); used/expired → 410 `INVITE_EXPIRED`; user already owner/member of that campaign → 409 `ALREADY_MEMBER`. |

Joining consumes the invite atomically (`usedAt` set in the same transaction as membership creation).

## 4. Permissions Matrix (integration-test checklist)

| Action | Guest | Player (non-member) | Player (member) | Owner GM |
|---|---|---|---|---|
| register/login | ✔ | n/a | n/a | n/a |
| list campaigns | 401 | own ∪ joined only | own ∪ joined only | own ∪ joined only |
| create campaign | 401 | 403 | 403 | ✔ 201 |
| read campaign | 401 | 404 | ✔ | ✔ |
| edit/archive | 401 | 404 | 403 | ✔ |
| delete | 401 | 404 | 403 | ✔ 204 |
| create invite | 401 | 404 | 403 | ✔ 201 |
| join via invite | 401 | ✔ 200 | 409 if same campaign | 409 if own campaign |

## 5. Cookie Contract

`Set-Cookie: rpg_session=<jwt>; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400` (+ `Secure` behind HTTPS). Logout: expired cookie, `Max-Age=0`.

## 6. Socket.IO Readiness (Phase 2)

No WebSocket code ships in Phase 1. The JWT cookie is the handshake credential;
`modules/campaigns` service functions take `(prisma, userId, …)` — no Express
types — so the Socket.IO layer can reuse membership checks verbatim.

## 7. Database Provisioning

- dev: `DATABASE_URL=file:./dev.db` + `npx prisma db push` (+ optional `npm run db:seed`).
- test (local): `file:./test.db`, recreated by `vitest.globalSetup` each run.
- CI test: postgres service + `scripts/prisma-provider.sh postgres` + `db push`.
- prod: host-provided `DATABASE_URL` (postgres) + `db push` at release (migrate baseline in Phase 2, D-4).

## 8. UI Testability Contract (`data-testid` attributes)

The React app MUST expose these stable hooks for the Robot suite (copy/ styling
may change freely):

| testid | Element |
|---|---|
| `page-login`, `page-register`, `page-dashboard`, `page-campaign-detail` | Root container of each page |
| `login-form`, `register-form`, `campaign-create-form`, `campaign-edit-form`, `join-form` | Forms |
| `email-input`, `password-input`, `display-name-input`, `campaign-name-input`, `description-input`, `system-input`, `token-input` | Form inputs |
| `role-gm`, `role-player` | Role radio buttons (register) |
| `register-submit`, `login-submit`, `campaign-create-submit`, `save-button`, `join-button` | Form submit buttons |
| `nav-user` | Nav area showing `<displayName> (<ROLE>)` |
| `logout-button` | Log out |
| `create-campaign-button` | Dashboard "New campaign" (GM only) |
| `campaign-list`, `campaign-item` | Dashboard list and its items (item text = campaign name) |
| `empty-campaigns` | Empty-state message on dashboard |
| `campaign-name`, `campaign-description`, `campaign-system` | Detail page heading and fields |
| `archived-badge` | Marker on archived campaign (list + detail) |
| `edit-button`, `save-button`, `cancel-button` | Detail/edit actions |
| `archive-button`, `unarchive-button`, `delete-button` | Owner actions |
| `invite-generate-button`, `invite-code`, `invite-list` | Invite section (owner) |
| `member-list`, `member-item` | Members (item text = `<displayName> (<ROLE>)`) |
| `form-error` | Per-form error banner (shows the server's error message) |
