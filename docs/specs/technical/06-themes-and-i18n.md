# Technical Specification: Themes & Internationalization

**Document ID:** SPEC-T-06  
**Module:** Visual Themes & Internationalization (Phase 5)  
**Status:** Approved  
**Related Specs:** SPEC-F-09, SPEC-F-10  

---

## 1. Data Model & Prisma Schema Extensions

### 1.1 `User` Model Preferences
Add `preferredTheme` and `preferredLocale` fields to the `User` model:
```prisma
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  passwordHash    String
  displayName     String
  role            String   // "GM" | "PLAYER"
  preferredTheme  String   @default("medieval")
  preferredLocale String   @default("en")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  ownedCampaigns  Campaign[]
  memberships     CampaignMember[]
  createdInvites  CampaignInvite[]
  sheets          CharacterSheet[]
  messages        SessionMessage[]
  tokens          MapToken[]       @relation("TokenOwner")
}
```

### 1.2 `ThemeConfig` Model
Add a model to persist built-in and imported theme JSON configurations:
```prisma
model ThemeConfig {
  key         String   @id
  name        String
  description String   @default("")
  builtin     Boolean  @default(false)
  config      String   // Serialized JSON Theme document
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 2. Theme JSON Schema & Validation (Ajv)

Themes are defined as JSON documents conforming to draft 2020-12:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["key", "name", "colors", "typography", "borderRadius"],
  "additionalProperties": false,
  "properties": {
    "key": {
      "type": "string",
      "pattern": "^[a-z0-9_-]{2,50}$"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 60
    },
    "description": {
      "type": "string",
      "maxLength": 200
    },
    "colors": {
      "type": "object",
      "required": [
        "bgPrimary",
        "bgSecondary",
        "bgPanel",
        "textPrimary",
        "textSecondary",
        "accent",
        "accentHover",
        "border",
        "danger"
      ],
      "additionalProperties": false,
      "properties": {
        "bgPrimary": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        "bgSecondary": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        "bgPanel": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        "textPrimary": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        "textSecondary": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        "accent": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        "accentHover": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        "border": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        "danger": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" }
      }
    },
    "typography": {
      "type": "object",
      "required": ["fontFamilySans", "fontFamilyHeading", "fontFamilyMono"],
      "additionalProperties": false,
      "properties": {
        "fontFamilySans": { "type": "string", "minLength": 1 },
        "fontFamilyHeading": { "type": "string", "minLength": 1 },
        "fontFamilyMono": { "type": "string", "minLength": 1 }
      }
    },
    "borderRadius": {
      "type": "string",
      "pattern": "^[0-9]+(px|rem|em|%)$"
    },
    "customProperties": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    }
  }
}
```

---

## 3. REST API Endpoints

### 3.1 Themes API (`/api/themes`)
- `GET /api/themes`: Returns summary list of all installed themes (`key`, `name`, `description`, `builtin`).
- `GET /api/themes/:key`: Returns full theme configuration JSON.
- `GET /api/themes/:key/export`: Sends theme JSON attachment as `<key>-theme.json`.
- `POST /api/themes/import`:
  - Body: Raw theme JSON object.
  - Validates payload against JSON Schema with Ajv.
  - Rejects overwriting built-in themes (`medieval`, `cyberpunk`) with HTTP 409.
  - Upserts custom theme in `ThemeConfig` table.
  - Returns `201 Created` on new, `200 OK` on update with theme document.

### 3.2 User Preferences API (`/api/users/me/preferences`)
- `PATCH /api/users/me/preferences`:
  - Protected endpoint requiring authentication.
  - Body: `{ preferredTheme?: string, preferredLocale?: "en" | "pt-BR" }`.
  - Validates theme existence and supported locale.
  - Updates `User` record and returns updated preferences `{ preferredTheme, preferredLocale }`.
- `GET /api/auth/me` & `POST /api/auth/login` & `POST /api/auth/register`:
  - Returns `preferredTheme` and `preferredLocale` in the user payload.

---

## 4. CSS Custom Property Bindings & Document Attributes

When active theme changes:
1. `document.documentElement.setAttribute("data-theme", theme.key)`
2. The root element style properties are updated:
   - `--theme-bg-primary`: `colors.bgPrimary`
   - `--theme-bg-secondary`: `colors.bgSecondary`
   - `--theme-bg-panel`: `colors.bgPanel`
   - `--theme-text-primary`: `colors.textPrimary`
   - `--theme-text-secondary`: `colors.textSecondary`
   - `--theme-accent`: `colors.accent`
   - `--theme-accent-hover`: `colors.accentHover`
   - `--theme-border`: `colors.border`
   - `--theme-danger`: `colors.danger`
   - `--theme-font-sans`: `typography.fontFamilySans`
   - `--theme-font-heading`: `typography.fontFamilyHeading`
   - `--theme-font-mono`: `typography.fontFamilyMono`
   - `--theme-border-radius`: `borderRadius`
   - Any extra `customProperties` are set as `--theme-<key>`.

Existing global CSS styles map their variables to these `--theme-*` custom properties with fallback defaults.

---

## 5. Internationalization (i18n) Architecture

### 5.1 Locale Files
Resource files located in `client/src/locales/`:
- `en.json`: English dictionary
- `pt-BR.json`: Brazilian Portuguese dictionary

Dictionary structure:
```json
{
  "nav": {
    "dashboard": "Dashboard",
    "systems": "Systems",
    "themes": "Themes",
    "logout": "Logout",
    "login": "Login",
    "register": "Register"
  },
  "dashboard": {
    "title": "Campaigns",
    "createCampaign": "Create Campaign",
    "joinCampaign": "Join Campaign"
  },
  "themes": {
    "title": "Visual Themes",
    "export": "Export",
    "import": "Import Theme",
    "importPlaceholder": "Paste theme JSON here..."
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading..."
  }
}
```

### 5.2 `I18nProvider` & `useI18n` Hook
- Supports dot-delimited key lookups (e.g., `t("nav.dashboard")`).
- Parameter substitution: `t("dashboard.welcome", { name: "User" })` replaces `{{name}}` with `"User"`.
- Default fallback to English if key missing in `pt-BR`.
- Syncs preference changes with backend when logged in.

---

## 6. Required `data-testid` Contracts

| Element | `data-testid` | Description |
| :--- | :--- | :--- |
| Theme Selector Dropdown | `theme-select` | Selects current visual theme in navigation header |
| Language Selector Dropdown | `locale-select` | Selects current language (`en`, `pt-BR`) in navigation header |
| Theme Manager Link / Button | `nav-themes-link` / `theme-manager-button` | Opens themes management view / modal |
| Theme Item Card | `theme-card` | Theme card in theme list |
| Theme Export Button | `theme-export-button` | Downloads the theme JSON |
| Theme Import Textarea | `theme-import-input` | Textarea for importing theme JSON |
| Theme Import Submit | `theme-import-submit` | Button submitting the theme import form |
| Page Themes Container | `page-themes` | Main container of the themes page |
