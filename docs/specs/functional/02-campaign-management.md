# Functional Specification — Campaign Management

| | |
|---|---|
| Feature ID | CAMP |
| Phase | 1 |
| Status | Approved for implementation |
| Depends on | AUTH |

## 1. Overview

This feature lets Game Masters create and manage campaigns and invite
players to join them. A *campaign* is a persistent container owned by a GM;
in later phases it will host live game sessions. A *membership* links a
player account to a campaign.

## 2. Business Rules

| ID | Rule |
|---|---|
| BR-1 | Campaigns are created and owned by GM accounts only. Player accounts cannot create campaigns. |
| BR-2 | A campaign has exactly one owner (its creator). Ownership cannot be transferred in Phase 1. |
| BR-3 | Only the owner may edit, archive, delete a campaign, or generate invite codes for it. |
| BR-4 | A user sees in "My campaigns" exactly the campaigns they own plus the campaigns they are a member of. |
| BR-5 | Archived campaigns remain visible in the list (marked archived) but are considered inactive; any member can still view them. |
| BR-6 | Joining happens only via an invite code created by the owner. There is no open "join by search" in Phase 1. |
| BR-7 | An invite code is single-use and expires 7 days after creation. No emails are sent — the GM shares the code out of band. |
| BR-8 | A user who already belongs to a campaign (owner or member) cannot redeem another invite for the same campaign. |
| BR-9 | Campaign names: 3–80 characters. Description: optional, ≤ 500 characters. Game system: optional free text, ≤ 40 characters, defaults to `generic`. |

## 3. Use Cases

### UC-05 Create a campaign (GM only)

- **Actor:** GM
- **Preconditions:** Logged in as GM.
- **Main flow:**
  1. GM opens the dashboard and clicks "New campaign".
  2. GM enters a name (and optionally description and game system) and submits.
  3. System creates the campaign, adds the GM as owner, and shows the campaign detail page.
- **Exception flow EF-5.1 — Not a GM:** A logged-in Player attempting to create (via UI or API) is refused with a "not allowed" error.
- **Exception flow EF-5.2 — Validation failure:** Name missing/too short/too long, or description/system too long. System shows field errors; nothing is created.

### UC-06 List my campaigns

- **Actor:** Any logged-in user
- **Main flow:**
  1. User opens the dashboard.
  2. System shows all campaigns the user owns or belongs to, most recently updated first, each showing name, system, archived marker, and the user's relationship (Owner / Player).
  3. For GMs the dashboard additionally shows "New campaign"; for players it shows a "Join with invite code" box instead.
- **Alternative flow AF-6.1 — No campaigns:** An empty-state message is shown ("No campaigns yet").

### UC-07 View campaign details

- **Actor:** Owner or member of the campaign
- **Main flow:**
  1. User opens a campaign from the list.
  2. System shows name, description, system, archived status, and the member list (display names, marked Owner/Player).
  3. The owner additionally sees edit/archive/delete actions and the invite-code section (see UC-11). Members do not.
- **Exception flow EF-7.1 — Not a participant:** A logged-in user who is neither owner nor member gets a "not found" response (existence of the campaign is not revealed to non-participants).

### UC-08 Edit a campaign (owner only)

- **Actor:** Owner
- **Main flow:**
  1. Owner clicks "Edit", changes name/description/system, and saves.
  2. System persists the changes and shows the updated detail page.
- **Exception flow EF-8.1 — Not the owner:** A member (non-owner) attempting to edit is refused with a "forbidden" error; a non-participant gets "not found" (as EF-7.1).

### UC-09 Archive / unarchive a campaign (owner only)

- **Actor:** Owner
- **Main flow:**
  1. Owner clicks "Archive" on a campaign; system marks it archived, the list and detail page show the archived marker, and the action changes to "Unarchive".
  2. Owner clicks "Unarchive"; system restores the campaign to active status.
- **Exception flow EF-9.1:** As EF-8.1 (non-owner refused).

### UC-10 Delete a campaign (owner only)

- **Actor:** Owner
- **Main flow:**
  1. Owner clicks "Delete" and confirms the action.
  2. System permanently deletes the campaign together with its memberships and invite codes, and returns the owner to the dashboard, where the campaign no longer appears.
- **Exception flow EF-10.1:** As EF-8.1 (non-owner refused).

### UC-11 Generate an invite code (owner only)

- **Actor:** Owner
- **Main flow:**
  1. Owner opens the campaign detail page and clicks "Generate invite code".
  2. System creates a single-use invite code valid for 7 days and displays it so the owner can copy and share it.
  3. The detail page lists all active (unused, unexpired) invite codes for the campaign.
- **Exception flow EF-11.1:** As EF-8.1 (non-owner refused).

### UC-12 Join a campaign with an invite code (Player or GM)

- **Actor:** Any logged-in user
- **Preconditions:** Valid, unused, unexpired invite code obtained from a GM.
- **Main flow:**
  1. User enters the invite code on the dashboard ("Join with invite code") and submits.
  2. System validates the code, adds the user as a member of the campaign, and shows the campaign detail page.
- **Alternative flow AF-12.1 — Already a member:** System shows "You are already a member of this campaign"; no duplicate membership is created.
- **Exception flow EF-12.1 — Unknown code:** System shows "Invalid invite code".
- **Exception flow EF-12.2 — Expired or already-used code:** System shows "This invite code has expired or already been used".

## 4. Out of Scope (Phase 1)

- Transferring ownership, removing members, member roles beyond Owner/Player.
- Sending invite emails (codes are copied by the GM).
- Campaign-level game content (maps, characters, sessions) — later phases.
