# Technical Specification — Architecture & Environments

| | |
|---|---|
| Phase | 1 |
| Status | Approved for implementation |

## 1. Goals

- Running skeleton of the VTT: user accounts (GM/Player) and campaign CRUD.
- Strict TDD: failing tests first on both back-end (unit/integration) and front-end (Robot Framework E2E).
- One codebase deployable to dev, test, and prod environments.
- Architecture that Phase 2 (real-time sessions over WebSockets) plugs into without rework.

## 2. Technology Choices and Justification

| Layer | Choice | Justification |
|---|---|---|
| Front-end | **React 18 + TypeScript + Vite 5** | Component model fits a highly interactive game UI; TypeScript gives shared-type safety with the back-end; Vite provides fast dev server with an API proxy. Alternatives considered: Vue/Svelte (smaller ecosystems for complex SPA patterns we will need later), plain JS (loses type safety across the API boundary). |
| Back-end | **Node.js 18 + TypeScript + Express 4** | Same language as the front-end (one toolchain, shared types); Express is the most battle-tested Node HTTP framework; in-process testing of the whole app with Supertest. |
| Real-time (Phase 2) | **Socket.IO** (decided now, integrated in Phase 2) | First-class *rooms* map 1:1 onto campaigns (broadcast per room, ack-based RPC for rolls/turn order); automatic fallback transports; mature client. Alternatives considered: raw `ws` (we would rebuild rooms/reconnect ourselves), Phoenix/Elixir and FastAPI (split the stack into a second language/ecosystem for marginal gain at our scale). |
| ORM / DB | **Prisma 5** | Type-safe generated client; schema as single source of truth; provider-portable schema lets dev run on SQLite with zero install while test/prod use PostgreSQL. |
| DB engines | **SQLite (dev) / PostgreSQL 16 (CI test + prod)** | No Docker/root on dev machines; SQLite needs no server. Test runs against real PostgreSQL in CI for prod parity. |
| Auth | **JWT (jose) in httpOnly cookie + bcryptjs** | Stateless sessions that also work for the Socket.IO handshake in Phase 2 (cookie is sent with the WS handshake); bcryptjs avoids native build toolchain fragility at a negligible cost at this scale. |
| Validation | **Zod** | One schema language shared between routes and tests; precise, machine-readable validation errors for the UI. |
| Back-end tests | **Vitest + Supertest** | Vitest runs TS/ESM natively and fast; Supertest exercises the real Express app in-process over HTTP. |
| Front-end tests | **Robot Framework + Browser library (Playwright)** | Mandated by the project requirements; Browser library drives Chromium headless against the real built app. |
| CI | **GitHub Actions** | Free for public repos; native postgres service containers for the test environment. |
| Runtime pin | **Node 18.19 LTS** (Vite 5 / Vitest 2 / Prisma 5 line) | The development machine has Node 18 and no Docker/root; all pinned major versions support Node 18. Upgrade path: Node 20+ unlocks Vite 7 — recorded, not blocking. |

## 3. System Overview

```
Browser (React SPA)
   │  HTTP /api/*  (same-origin: Vite dev proxy in dev, Express static in prod)
   ▼
Express app (server/)
   ├── modules/auth        (register/login/logout/me)
   ├── modules/campaigns   (CRUD + invites)
   ├── middleware          (authN, error normalization)
   └── PrismaClient ──► SQLite (dev) / PostgreSQL (test CI, prod)
```

Phase 2 adds a Socket.IO server alongside Express (same HTTP server, `/socket.io`
path), consuming the same auth middleware and campaign membership service —
domain services are kept free of HTTP/WebSocket framework types on purpose.

## 4. Repository Layout (npm workspaces monorepo)

```
├── .github/workflows/ci.yml     # CI: server tests (postgres), client build, E2E
├── docs/specs/                  # functional + technical specs (this file etc.)
├── e2e/                         # Robot Framework suite (front-end acceptance tests)
│   ├── requirements.txt
│   └── tests/*.robot
├── scripts/
│   ├── run-e2e.sh               # builds client, starts server on :3100, runs robot
│   └── prisma-provider.sh       # swaps Prisma provider sqlite <-> postgres
├── server/
│   ├── prisma/schema.prisma     # single source of truth (provider swapped per env)
│   ├── src/ (config, app, db, lib, middleware, modules/*)
│   └── tests/ (unit + integration)
├── client/
│   └── src/ (api, auth context, pages, components)
├── package.json                 # workspaces + orchestration scripts
└── README.md
```

## 5. Environments and Configuration

| Env | Where | DB | How it runs |
|---|---|---|---|
| **dev** | developer machine | SQLite (`file:./dev.db`) | `npm run dev` → Vite (:5173, proxies `/api` → :3001) + tsx watch (:3001) |
| **test** | GitHub Actions CI | PostgreSQL 16 service container | `vitest run` against service DB; Robot E2E against built client + server on :3100 with fresh SQLite |
| **prod** | hosting TBD (deploy deferred by user decision) | PostgreSQL (host-provided) | `npm run build && npm start` — Express serves `client/dist` on `$PORT`; Dockerfile + docs included, deployment happens in a later phase |

Configuration is env-var only, validated at boot (`server/src/config.ts`):

| Variable | dev default | prod |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3001` | `$PORT` (host-provided) |
| `DATABASE_URL` | `file:./dev.db` | required |
| `JWT_SECRET` | built-in dev-only value (warns) | **required, boot fails without it** |
| `CLIENT_DIST` | `../client/dist` (served statically) | same, resolved relative to server |

`.env` files are gitignored; `server/.env.example` documents every variable.

### Multi-provider database strategy (known limitation, D-4)

The committed `schema.prisma` targets SQLite; `scripts/prisma-provider.sh postgres`
re-writes the provider line for PostgreSQL environments (official Prisma
workaround for multi-provider setups). Schema avoids provider-specific
features (no enums — roles are validated at app level with Zod; no native
DB defaults beyond Prisma's). Sync is done with `prisma db push` in Phase 1;
**committing a `prisma migrate` history is deferred to Phase 2** once the prod
provider is fixed, and will be baselined against PostgreSQL.

## 6. Authentication Design

- `POST /api/auth/register|login` → on success the server sets cookie
  `rpg_session` = signed JWT (`jose`, HS256, 24 h expiry, claims `{sub: userId}`),
  flags: `HttpOnly; Path=/; SameSite=Lax` (+ `Secure` when served over HTTPS).
- Every `/api/*` request passes `middleware/auth.ts`: cookie → verify JWT → load
  fresh user row → `req.user`. Stale/deleted users get 401.
- `requireRole("GM")` guards GM-only operations with 403.
- Passwords: bcryptjs, 10 rounds. Login failures return one generic message.
- Deferred hardening (documented, not built in Phase 1): rate limiting,
  refresh tokens, password reset.

## 7. API and Error Conventions

- Base path `/api`; JSON in/out; cookies for auth.
- Errors: `{ "error": { "code", "message", "details?" } }` with appropriate
  status (400 validation, 401 unauthenticated, 403 forbidden, 404 not found,
  409 conflict, 500 internal). Full contract: `02-api-and-data-model.md`.

## 8. Security Decisions

| Decision | Rationale |
|---|---|
| httpOnly SameSite=Lax cookie, not localStorage tokens | XSS cannot exfiltrate the token; cookie rides along the Phase 2 Socket.IO handshake automatically. |
| 404 (not 403) for non-participants reading a campaign | Does not reveal campaign existence to outsiders (BR-3, EF-7.1). |
| JWT 24 h, no refresh token | Skeleton-stage trade-off; recorded for Phase 2+ hardening. |
| Zod validation on every body/params input | No unvalidated data reaches the service layer. |
| Prisma parameterized queries throughout | No SQL injection surface. |

## 9. Testing Strategy

- **Back-end unit**: password hashing, JWT sign/verify, Zod schemas, invite token generation.
- **Back-end integration**: full HTTP flows via Supertest against a real SQLite
  file (fresh per run): auth lifecycle, campaign CRUD permissions matrix,
  invite lifecycle incl. expiry/single-use/already-member.
- **Back-end CI**: same suite against PostgreSQL 16 service (provider-parity check).
- **Front-end E2E (Robot Framework)**: Chromium via Browser library against the
  built app on :3100 — covers UC-01…UC-12 incl. error paths; selectors via a
  `data-testid` contract (see 02-api-and-data-model.md §8) so tests survive copy changes.

## 10. Decision Log

| ID | Decision | Consequence |
|---|---|---|
| D-1 | Monorepo with npm workspaces, one lockfile | Single `npm ci` in CI; atomic cross-package changes. |
| D-2 | Socket.IO chosen for Phase 2 now | Phase 2 needs no new ADR; server module layout already isolates the realtime boundary. |
| D-3 | SQLite dev / Postgres CI+prod | No Docker/root needed locally; prod parity kept in CI. |
| D-4 | `db push` + provider swap instead of migrations (Phase 1) | Zero-install dev DB; migration history baselined in Phase 2 (tech debt, tracked). |
| D-5 | JWT in cookie, no refresh token | Simplest secure skeleton; hardening listed in §6. |
| D-6 | Express serves the built client in prod | Same-origin prod (no CORS), single deployable unit. |
| D-7 | Robot selectors bound to `data-testid` contract | UI copy can change without breaking E2E. |
