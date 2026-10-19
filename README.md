# RPG Virtual Tabletop (VTT)

A modern, web-based Virtual Tabletop for tabletop roleplaying games (TTRPGs), supporting grid-based tactical maps, server-authoritative turn-based combat, real-time chat with 3D-ready dice mechanics, system-agnostic character sheets, and customizable themes and localization.

---

## 1. System Overview & Architecture

RPG Virtual Tabletop is structured as a TypeScript monorepo using npm workspaces:

```
rpg-virtual-tabletop/
├── docs/specs/                  # Complete functional and technical specifications
│   ├── functional/              # Specs 01 through 10
│   └── technical/               # Specs 01 through 06
├── server/                      # Express 4 + WebSocket backend
│   ├── src/
│   │   ├── modules/             # Auth, Campaigns, Systems, Sheets, Sessions, Maps, Themes, Users
│   │   ├── rules/               # System-agnostic rules engine & expression evaluator
│   │   ├── websocket/           # WebSocket server, rooms, and event dispatcher
│   │   ├── middleware/          # JWT auth, error normalization, schema validation
│   │   └── config.ts            # Environment-driven configuration
│   ├── prisma/                  # Prisma schema, migrations, and seed scripts
│   └── tests/                   # Vitest unit & integration test suites
├── client/                      # React 18 + Vite 5 frontend
│   ├── src/
│   │   ├── components/          # Reusable UI (Navigation, ThemeSelector, DiceRoller, Modals)
│   │   ├── pages/               # Auth, Campaigns, Sheets, Session Room (Maps & Combat)
│   │   ├── i18n/                # Internationalization context & locale resource bundles
│   │   ├── themes/              # Built-in themes (Medieval, Cyberpunk) & schema validation
│   │   └── api/                 # Typed API client & WebSocket client
├── e2e/                         # Robot Framework + Playwright acceptance test suites
│   ├── tests/                   # 01 through 08 .robot test suites
│   └── resources/               # Shared keywords and data-testid selectors
├── scripts/                     # Operational scripts (prisma-provider.sh, run-e2e.sh)
├── Dockerfile                   # Multi-stage production container build
└── docker-compose.yml           # App + PostgreSQL orchestration
```

---

## 2. Technology Choices & Justification

| Layer | Technology | Justification |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite 5 | Fast HMR development, component hierarchy suited for real-time tactical UI, shared TypeScript types with backend. |
| **Backend** | Node.js 18/20 + Express 4 + TypeScript | Unified language across the stack, battle-tested HTTP middleware pipeline, zero-overhead type sharing. |
| **Real-Time** | WebSockets (`ws`) | Low-latency bi-directional messaging for room presence, chat, dice rolls, token movements, and combat updates. |
| **Database & ORM** | Prisma 5 with SQLite & PostgreSQL | Single schema definition as source of truth; zero-install SQLite for local development and PostgreSQL for CI/production. |
| **Authentication** | JWT (`jose`) in `httpOnly` Cookies | Secure from XSS token theft; credentials automatically attach to HTTP requests and WebSocket handshakes. |
| **Validation** | Zod & Ajv (JSON Schema) | Runtime input validation with Zod for API endpoints; Ajv for user-extensible game systems and theme packages. |
| **Backend Testing** | Vitest + Supertest | Blazing fast ESM-native test runner with in-process HTTP integration testing. |
| **E2E Testing** | Robot Framework + Browser (Playwright) | Human-readable acceptance test specifications driving headless Chromium against real builds. |

---

## 3. Implemented Capabilities by Phase

### Phase 1: Authentication & Campaign Management
- User registration, login, logout, and persistent session verification via `httpOnly` cookies.
- Role-based authorization (`GM` and `PLAYER`).
- Campaign lifecycle: create, list, view, update, and delete campaigns.
- Secure, single-use invite link generation with expiration handling.

### Phase 2: Rules Engine & Character Sheets
- System-agnostic rules engine executing JSON Schema-validated rulesets.
- Built-in systems: **Shadowdark RPG** and **D&D 5e (2024)** (mechanics-as-data).
- Deterministic formula evaluation for derived stats, ability modifiers, HP, and armor class.
- Dynamic character sheet creation, editing, inventory tracking, and stat calculation.

### Phase 3: Real-Time Sessions, Chat & Dice Roller
- Game session rooms with active presence tracking and GM/Player status badges.
- Real-time room chat with server-validated markdown/text formatting.
- Deterministic dice roller (`/roll 2d20kh1+5`, `/roll 1d6`, etc.) with natural 20 critical and natural 1 fumble callouts.
- GM-secret rolls (`/gmroll 1d20+4`) visible only to Game Masters.

### Phase 4: Maps & Turn-Based Combat
- Tactical grid map creation and management with configurable dimensions and placeholder visual themes.
- Token placement, permission enforcement (GM moves any; Player moves their character only when movement is unlocked).
- Server-authoritative turn-based combat:
  - Initiative rolling (`1d20 + modifier`) and sorted initiative tracker.
  - Turn advancement (`Next Turn`) and round counter.
  - Combat attack resolution: `1d20 + attackBonus` vs target Armor Class (AC).
  - Automatic hit/miss/crit detection and damage deduction synchronized with character sheets.

### Phase 5: Themes & Internationalization
- **UI Themes**:
  - Built-in **Medieval** (warm parchment, gold accents, serif typography) and **Cyberpunk** (neon cyan & magenta, monospace typography).
  - Full theme export (`GET /api/themes/:key/export`) and theme import (`POST /api/themes/import`) validated via JSON Schema.
- **Internationalization (i18n)**:
  - Complete resource bundles for **English (`en`)** and **Brazilian Portuguese (`pt-BR`)**.
  - Dynamic runtime language switching without page reloads.
- **Per-User Persistence**:
  - Saved theme and locale preferences per user profile, automatically loaded on login.

---

## 4. Multi-Environment Guide

### Development Environment (`dev`)
Zero-install setup using SQLite and hot-reloading:

```bash
# 1. Install dependencies
npm install

# 2. Push database schema and seed built-in systems & themes
npm run db:push
npm run db:seed

# 3. Start development servers (Vite on :5173, Express on :3001)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Test Environment (`test`)

#### Running Backend Unit & Integration Tests (Vitest)
```bash
npm test
```

#### Running End-to-End Acceptance Tests (Robot Framework + Playwright)
Prerequisites: Python 3.10+ virtualenv at `.venv` with `e2e/requirements.txt` installed.
```bash
# One-time setup
python3 -m venv .venv
. .venv/bin/activate
pip install -r e2e/requirements.txt
rfbrowser init

# Run the complete E2E test suite (01 through 08)
npm run test:e2e
```

#### Running TypeScript Typechecks
```bash
npm run typecheck
```

---

### Production Environment (`prod`)

#### Option A: Standalone Node.js Build
```bash
# 1. Build production bundles for client and server
npm run build

# 2. Configure production environment
export NODE_ENV=production
export PORT=3001
export JWT_SECRET="your-secure-random-secret-key-at-least-32-chars"
export DATABASE_URL="file:./prod.db" # or postgresql://user:pass@host:5432/vtt

# 3. Apply database schema and seed
npm run db:push
npm run db:seed

# 4. Start production server
npm start
```
The server serves both the REST API and the static React SPA on `http://localhost:3001`.

#### Option B: Docker & Docker Compose (PostgreSQL)
```bash
# 1. Copy and customize environment variables
cp .env.example .env

# 2. Build and launch services
docker-compose up -d --build

# 3. Check logs
docker-compose logs -f
```

---

## 5. Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `concurrently ...` | Runs Vite dev server and Express backend concurrently. |
| `npm run build` | `tsc && vite build` | Compiles server TypeScript and client production assets. |
| `npm start` | `node server/dist/index.js` | Runs production server. |
| `npm run typecheck` | `tsc --noEmit` | Runs TypeScript static type checking across all workspaces. |
| `npm test` | `vitest run` | Runs all backend unit and integration tests. |
| `npm run test:e2e` | `bash scripts/run-e2e.sh` | Launches production build and runs full Robot Framework E2E suite. |
| `npm run db:push` | `prisma db push` | Pushes Prisma schema changes to the configured database. |
| `npm run db:seed` | `tsx prisma/seed.ts` | Seeds built-in game systems (Shadowdark, D&D 5e) and default themes. |

---

## 6. Specifications & Documentation Index

For detailed functional requirements, mathematical formulas, and data contracts, refer to the documentation in `docs/specs/`:

- **Functional Specifications**:
  - [`01-authentication.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/01-authentication.md) — User registration, login, session management.
  - [`02-campaign-management.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/02-campaign-management.md) — Campaign CRUD and invite links.
  - [`03-rules-engine.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/03-rules-engine.md) — Rules configuration schemas and calculation models.
  - [`04-character-sheets.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/04-character-sheets.md) — Character sheet operations and inventory rules.
  - [`05-rooms-and-sessions.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/05-rooms-and-sessions.md) — Real-time game sessions and member presence.
  - [`06-chat-and-dice.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/06-chat-and-dice.md) — Room chat and dice rolling notations.
  - [`07-maps-and-tokens.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/07-maps-and-tokens.md) — Tactical grid maps and token movement rules.
  - [`08-turn-based-combat.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/08-turn-based-combat.md) — Turn order, initiative, and combat attack resolution.
  - [`09-themes.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/09-themes.md) — Visual themes, JSON import/export, and schema validation.
  - [`10-internationalization.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/functional/10-internationalization.md) — Multi-language resource files and user preference persistence.
- **Technical Specifications**:
  - [`01-architecture.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/technical/01-architecture.md) — Architecture, technology justification, environments.
  - [`02-api-and-data-model.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/technical/02-api-and-data-model.md) — Data schemas, REST endpoints, and `data-testid` contracts.
  - [`03-rules-engine-and-sheets.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/technical/03-rules-engine-and-sheets.md) — Formula grammar, evaluation engine, and sheet API.
  - [`04-rooms-chat-and-dice.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/technical/04-rooms-chat-and-dice.md) — WebSocket protocol, presence, and dice parser.
  - [`05-maps-and-combat.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/technical/05-maps-and-combat.md) — Map data model, token permissions, and combat engine.
  - [`06-themes-and-i18n.md`](file:///home/dev/projects/rpg-virtual-tabletop/docs/specs/technical/06-themes-and-i18n.md) — Theme schema, CSS variable mapping, and i18n dictionary.

---

## 7. License

This project is licensed under the MIT License.
Game system mechanics definitions adhere to their respective open licenses:
- Shadowdark RPG mechanics are used under the [Shadowdark RPG Third-Party License](https://www.thearcanelibrary.com/pages/shadowdark-rpg-third-party-license).
- System Reference Document 5.2.1 content is used under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).
