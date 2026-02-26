# Bugfixes & Realtime Sync Design

**Date:** 2026-02-26
**Status:** Approved

## Issues Addressed

1. Timer causes header scrolling — needs popover dropdown
2. Color picker hidden behind cards below — z-index fix
3. Icons invisible on colored cards — luminance-based text contrast
4. Board settings not syncing to other users — owner/facilitator model + subscription fix
5. No realtime presence — Supabase Presence channel
6. Can't see who's online — participant popover with names/roles/status
7. Events not syncing in realtime — full subscription architecture audit

## 1. Timer Popover

**Current:** Timer preset buttons render inline in facilitator toolbar, causing horizontal scroll.

**Fix:**
- Single clock icon button in toolbar opens a popover dropdown (`absolute`, `z-50`)
- Popover contains:
  - **Preset row:** 5 pill buttons — 1, 2, 3, 5, 10 min
  - **Custom row:** Text input labeled "Custom min" + "Start" button
- When timer is active, toolbar shows compact countdown + pause/resume/reset (no popover needed)
- Popover closes on selection or click-outside

## 2. Color Picker Z-Index

**Current:** `CardColorPicker` dropdown has `z-10`, gets hidden behind cards rendered below in DOM.

**Fix:**
- Bump dropdown to `z-30`
- When picker is open, elevate parent card's z-index above siblings
- Ensure card container has `position: relative` for proper stacking context

## 3. Card Text Contrast

**Current:** All text/icons use fixed dark gray regardless of card background color.

**Fix:** Implement `getCardTextColor(bgColor)` utility using relative luminance:

| Color | Background | Text/Icons |
|-------|-----------|------------|
| Default (null) | white | dark gray |
| `#FFB549` (amber) | amber | dark navy |
| `#3EB1C8` (teal) | teal | white |
| `#249E6B` (green) | green | white |
| `#FBC1B8` (light pink) | pink | dark navy |
| `#FA937D` (salmon) | salmon | white |
| `#F5E3CC` (cream) | cream | dark navy |

Apply to: card text, author name, edit/delete/palette icons, vote button.

## 4. Board Owner & Facilitator Model

**Board creation:**
- Creator's participant ID stored as `boards.created_by`
- Creator's `participants.is_admin` set to `true`

**Permission enforcement:**
- Facilitator toolbar only renders when `currentParticipant.is_admin === true`
- Non-admins see read-only header — no settings controls
- `is_admin` changes propagate via `participants` UPDATE realtime events

**Facilitator promotion:**
- From participant popover, facilitator can "Promote to facilitator" any participant
- Updates `is_admin` to `true` in Supabase, propagates via realtime
- Can also "Demote" others (not themselves; original creator always stays admin)

**Database change:**
- Add `participants` UPDATE to realtime subscriptions (currently only INSERT)

## 5. Realtime Presence & Participant Popover

**Supabase Presence channel:** `presence:{boardId}`
- Each client tracks: `{ participant_id, display_name, is_admin, online_at }`
- Presence handles join/leave/heartbeat automatically
- State synced via `presenceState`

**Participant popover** (click user count icon):
- List of all participants:
  - Green dot = online (in presence), Gray dot = offline
  - Display name
  - Role badge: "Facilitator" / "Participant"
- Facilitator-only actions per participant:
  - "Promote to facilitator" / "Demote to participant"
  - "Remove" participant
- Online participants sorted first

## 6. Full Realtime Sync Architecture

**Channel 1: `board:{boardId}` (postgres_changes)** — existing, enhanced
- `cards` INSERT/UPDATE/DELETE
- `columns` INSERT/UPDATE/DELETE
- `votes` INSERT/DELETE
- `participants` INSERT/UPDATE (UPDATE is new)
- `boards` UPDATE
- `action_items` INSERT/UPDATE/DELETE

**Channel 2: `presence:{boardId}` (Supabase Presence)** — new
- `.track()` for online status
- `sync`, `join`, `leave` events
- Updates `onlineParticipants` in store

**Channel 3: `timer:{boardId}` (Broadcast)** — existing, unchanged

**Key fixes:**
- Ensure `boards` UPDATE handler properly merges incoming settings into store
- Ensure `participants` INSERT handler adds to local store immediately
- Presence join/leave updates participant count in real time
- Participant count derived from DB records (persists across refreshes), online status from Presence
