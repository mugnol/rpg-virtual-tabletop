# Functional Specification: Internationalization (i18n)

**Document ID:** SPEC-F-10  
**Module:** Internationalization & Localization (Phase 5)  
**Status:** Approved  
**Related Requirements:** BR-59..BR-66, UC-52..UC-56  

---

## 1. Overview & Objective
This specification defines the multi-language localization subsystem for the RPG Virtual Tabletop. All visible UI text, labels, button actions, status indicators, and headers across the application are externalized into structured JSON resource bundles. The system supports runtime language selection without page reloads and persists language preferences per user.

---

## 2. Business Rules (BR)

### BR-59: Supported Locales & Resource Bundles
The system ships with two first-class locale resource bundles:
1. `en`: English (Default).
2. `pt-BR`: Brazilian Portuguese (Português Brasileiro).

Locale bundles are stored as static JSON files in the frontend repository (`client/src/locales/en.json` and `client/src/locales/pt-BR.json`).

### BR-60: Translation Key Parity & Completeness
- Every key defined in `en.json` MUST exist in `pt-BR.json`, and vice versa.
- Automated tests enforce 100% key parity between locale files to prevent missing translations.
- If a key is missing or undefined at runtime, the translation helper falls back to the English (`en`) equivalent, and finally to the key string itself.

### BR-61: Default Language & Test Compatibility
- The default language for all unauthenticated sessions and newly registered users is `en` (English).
- This ensures full backward compatibility with all acceptance tests from Phases 1 through 4.

### BR-62: Dynamic Runtime Language Switching
- Changing language via the locale switcher takes effect instantly across all rendered components without reloading the browser page.
- Translation lookups are provided via a React Context hook `useI18n()` exporting:
  - `locale`: Active locale code (`"en"` | `"pt-BR"`).
  - `setLocale`: Function to update the active locale.
  - `t(key, params?)`: Translation function with optional interpolation (e.g. `t("common.welcome", { name: "Alice" })`).

### BR-63: Per-User Preference Persistence
- Authenticated users have a `preferredLocale` setting stored on their `User` record in the database.
- When an authenticated user switches language, their preference is saved to the server via `PATCH /api/users/me/preferences` (or `/api/auth/preferences`).
- When logging in, the user's stored `preferredLocale` is loaded and applied.
- Unauthenticated users store their language preference in `localStorage` so it persists within the browser session.

### BR-64: Interpolation & Formatting
- The `t` function supports dynamic token substitution using double braces: `{{param}}`.
- Numbers and dates adapt appropriately to the active locale standard where necessary.

---

## 3. Use Cases (UC)

### UC-52: User Switches Language via Header Selector
1. User clicks the language selector dropdown in the navigation header.
2. User selects "Português (BR)" (`pt-BR`).
3. All visible navigation links, page titles, action buttons, and form labels immediately update to Brazilian Portuguese without refreshing the page.
4. If authenticated, the preference is saved to the server.

### UC-53: User Switches Language Back to English
1. User clicks the language selector dropdown and selects "English" (`en`).
2. All UI labels immediately revert to English.
3. Server updates the user's `preferredLocale` to `en`.

### UC-54: Per-User Language Isolation Across Sessions
1. User A logs in and selects `pt-BR`.
2. User A logs out.
3. User B logs in; User B's preferred language is `en`, so the application renders in English.
4. When User A logs in again, the application automatically switches to `pt-BR`.

### UC-55: Unauthenticated User Language Preference
1. A guest visits the landing/login page.
2. The guest switches language to `pt-BR`.
3. The login/register views and navigation update to Brazilian Portuguese.
4. The preference is preserved across page reloads via local browser storage.

### UC-56: Fallback for Missing Translation
1. A component requests a key that does not exist in the active locale bundle.
2. The translation resolver falls back to the default English bundle.
3. If not found in English, it gracefully returns the key string rather than throwing a runtime error.
