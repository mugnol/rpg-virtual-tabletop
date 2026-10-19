# Functional Specification: Visual Themes

**Document ID:** SPEC-F-09  
**Module:** Visual Themes & Personalization (Phase 5)  
**Status:** Approved  
**Related Requirements:** BR-51..BR-58, UC-46..UC-51  

---

## 1. Overview & Objective
This specification defines the dynamic visual theming subsystem for the RPG Virtual Tabletop. Users can select and customize the visual aesthetic of the application according to their preferred genre or personal taste (e.g., fantasy/medieval parchment for classic dungeon crawls, high-contrast neon/dark matrix for cyberpunk games). Themes are defined as portable, validated JSON configuration packages that can be exported, shared, and imported into the application.

---

## 2. Business Rules (BR)

### BR-51: Built-in Themes
The application provides two immutable, built-in themes out of the box:
1. `medieval`: Warm parchment and dark tavern aesthetic with aged gold accents, rich brown/charcoal panels, and fantasy serif typography tokens. Default theme for all new accounts and unauthenticated views.
2. `cyberpunk`: High-contrast dark synth aesthetic with neon cyan and magenta accents, deep blue/black panels, and tech monospace typography tokens.

### BR-52: Theme Configuration Schema
Every theme is defined by a structured JSON document conforming to a strict JSON Schema:
- `key`: Unique lowercase alphanumeric slug (`[a-z0-9_-]+`) between 2 and 50 characters.
- `name`: Human-readable display title (1 to 60 characters).
- `description`: Optional descriptive text (up to 200 characters).
- `colors`: Required hex color tokens (`#rgb`, `#rrggbb`, or `#rrggbbaa`):
  - `bgPrimary`: Main page background color.
  - `bgSecondary`: Surface or container background color.
  - `bgPanel`: Card, dialog, and panel background color.
  - `textPrimary`: Primary text color.
  - `textSecondary`: Muted or auxiliary text color.
  - `accent`: Primary call-to-action and interactive highlight color.
  - `accentHover`: Interactive hover state color for primary elements.
  - `border`: Dividing border color.
  - `danger`: Destructive action and error state color.
- `typography`: Font family tokens:
  - `fontFamilySans`: Primary body sans-serif font stack.
  - `fontFamilyHeading`: Heading font stack.
  - `fontFamilyMono`: Code, dice breakdown, and tabular font stack.
- `borderRadius`: Common border radius token (e.g., `4px`, `8px`, `0px`).
- `customProperties`: Optional key-value dictionary of auxiliary CSS custom properties.

### BR-53: Real-Time DOM Application
- Activating a theme immediately updates the document root element (`<html>` or `document.documentElement`) with:
  1. `data-theme="<theme_key>"` attribute.
  2. CSS Custom Properties (`--theme-*`) mapped from the theme tokens.
- Theme switching occurs dynamically in the browser without requiring a full page refresh.

### BR-54: Per-User Preference Persistence
- Authenticated users have a `preferredTheme` setting stored in their database record.
- When an authenticated user switches themes, their preference is saved to the server via `PATCH /api/users/me/preferences` (or `/api/auth/preferences`).
- When a user logs in on any device, their stored `preferredTheme` is fetched and applied.
- Unauthenticated visitors or new users default to the `medieval` theme.

### BR-55: Theme Exporting
- Any user (GM or Player) can export any installed theme (built-in or imported) as a downloadable `.json` file (`GET /api/themes/:key/export`).
- Exported files are named `<theme_key>-theme.json`.

### BR-56: Theme Importing & Validation
- Any authenticated user can import custom themes (`POST /api/themes/import`).
- Payloads are validated against the theme JSON Schema using Ajv before database persistence.
- Importing a theme with an existing custom key updates that custom theme.
- Built-in theme keys (`medieval`, `cyberpunk`) are protected and cannot be overwritten by imports (returns 409 Conflict).
- Malformed JSON or schema validation failures return HTTP 422 with structured field error descriptions.

---

## 3. Use Cases (UC)

### UC-46: User Switches Active Theme via Header Selector
1. User clicks the theme selector dropdown in the navigation header.
2. User selects an available theme (e.g., "Cyberpunk").
3. The UI immediately transitions to the new color palette, borders, and typography.
4. If authenticated, the user's preference is saved to the backend database.

### UC-47: User Exports a Theme
1. User navigates to the Themes management view or opens the Theme Manager modal.
2. User clicks "Export" on the desired theme card.
3. The browser downloads the validated `<theme_key>-theme.json` file.

### UC-48: User Imports a Valid Custom Theme
1. User opens the Theme Manager and pastes or uploads a valid theme JSON payload.
2. User clicks "Import Theme".
3. Backend validates the schema and stores the new theme.
4. The new theme appears in the theme selection dropdown and can be activated immediately.

### UC-49: User Attempts to Import Invalid Theme JSON
1. User provides malformed JSON or a theme missing required tokens (e.g., invalid hex color `#xyz` or missing `accent`).
2. User clicks "Import Theme".
3. System rejects the payload with HTTP 422 and renders field-level validation errors.
4. No theme is created or updated.

### UC-50: User Attempts to Overwrite Built-in Theme
1. User attempts to import a theme with `key: "medieval"` or `key: "cyberpunk"`.
2. System rejects the request with HTTP 409 Conflict ("Built-in themes cannot be overwritten").
3. Built-in themes remain unchanged.

### UC-51: Multiple Users Maintain Isolated Theme Preferences
1. User A logs in, selects `cyberpunk`, and logs out.
2. User B logs in on the same browser; User B's preferred theme (`medieval`) is loaded.
3. When User A logs in again, `cyberpunk` is automatically restored.
