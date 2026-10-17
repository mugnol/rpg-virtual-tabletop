# Functional Specification — Authentication & User Roles

| | |
|---|---|
| Feature ID | AUTH |
| Phase | 1 |
| Status | Approved for implementation |

## 1. Overview

This feature provides user accounts for the virtual tabletop: registration,
login, logout, and session persistence, with role assignment at registration.
The role chosen at signup determines what the user may do in later features
(Phase 1: only Game Masters may create and own campaigns).

## 2. Roles

| Role | Description |
|---|---|
| **GM** (Game Master / Campaign Admin) | Creates and manages campaigns, invites players, will control sessions in later phases. |
| **Player** | Joins campaigns via invite, will create character sheets and roll dice in later phases. |

The role is selected at registration and is immutable per account in Phase 1
(changing roles would be an administrative operation in a later phase).

## 3. Registration and Login Fields

| Field | Rules |
|---|---|
| Email | Required, valid email format, case-insensitive, unique across all accounts. |
| Password | Required, minimum 8 characters. Stored only as a salted bcrypt hash — never retrievable. |
| Display name | Required, 2–40 characters, need not be unique. |
| Role | Required, one of `GM` or `PLAYER`. |

## 4. Use Cases

### UC-01 Register a new account

- **Actor:** Visitor (not logged in)
- **Preconditions:** None.
- **Main flow:**
  1. Visitor opens the registration page (`/register`).
  2. Visitor selects a role (GM or Player), and enters email, display name, and password.
  3. Visitor submits the form.
  4. System validates the input, creates the account, starts a session, and redirects the visitor to the dashboard (`/`).
  5. The navigation bar shows the visitor's display name and role.
- **Alternative flow AF-1.1 — Email already registered:** System displays an error ("An account with this email already exists") and remains on the form; no account is created. (Step 4 fails.)
- **Alternative flow AF-1.2 — Validation errors:** One or more fields fail validation. System highlights the offending fields with messages and does not create an account. (Step 4 fails.)
- **Exception flow EF-1.1 — Server failure:** System displays a generic "Something went wrong, please try again" message; no account is created.

### UC-02 Log in

- **Actor:** Registered user (not logged in)
- **Preconditions:** Account exists.
- **Main flow:**
  1. User opens the login page (`/login`).
  2. User enters email and password and submits.
  3. System verifies credentials, starts a session, and redirects to the dashboard.
  4. The navigation bar shows the user's display name and role.
- **Exception flow EF-2.1 — Invalid credentials:** Email unknown **or** password wrong. System displays "Invalid email or password" (identical message in both cases, so the site does not reveal which part failed) and remains on the form.

### UC-03 Log out

- **Actor:** Logged-in user
- **Preconditions:** Active session.
- **Main flow:**
  1. User clicks "Log out" in the navigation bar.
  2. System ends the session and returns the user to the login page.
  3. Any subsequent attempt to open a protected page (e.g., the dashboard) redirects to the login page (see UC-04).

### UC-04 Session persistence / protected pages

- **Actor:** Any user
- **Preconditions:** None.
- **Main flow:**
  1. A user with an active session revisits the application or reloads the page.
  2. System recognizes the session and keeps the user logged in (no new login required); protected pages load normally.
- **Alternative flow AF-4.1 — No/invalid session:** System treats the user as logged out. Attempts to open protected pages redirect to `/login`; after successful login the user lands on the dashboard.
- **Alternative flow AF-4.2 — Expired session:** Sessions expire 24 hours after login; afterwards AF-4.1 applies.

## 5. UI Summary (Phase 1)

- `/register` — registration form with role selection (radio: "Game Master" / "Player").
- `/login` — email + password form.
- Navigation bar (all protected pages) — display name + role, "Log out" button.
- Unauthenticated access to any protected page redirects to `/login`.

## 6. Out of Scope (Phase 1)

- Password reset / change, email verification, OAuth providers.
- Role change after registration, multiple roles per account.
- Rate limiting on login attempts (recorded as deferred hardening in the technical specification).
