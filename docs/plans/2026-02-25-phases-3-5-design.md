# Phases 3-5 Design — Card Polish, Timer, Action Items & Export

**Date**: 2026-02-25
**Status**: Approved

---

## Phase 3: Card Obfuscation + Voting Polish

### Obfuscation

- Keep all-at-once reveal via `card_visibility` toggle in FacilitatorToolbar (no per-column reveal).
- Remove `revealed_columns` from `BoardSettings` — unused.
- Add reveal animation: `transition: filter 0.4s ease-out` on RetroCard so cards smoothly unblur.

### Voting

- **One vote per card per user.** Keep the DB `UNIQUE(card_id, voter_id)` constraint.
- Remove `max_votes_per_card` from `BoardSettings` and store logic. Remove `max_votes_per_column` (never enforced).
- Keep `max_votes_per_participant` as the sole configurable limit (default 5).
- Add vote count badge on column headers (sum of all votes on cards in that column).
- Add "X of Y votes remaining" indicator in the board header area when voting is enabled.
- When vote limit is reached: disable vote buttons with a subtle visual cue (greyed out + tooltip).
- **Secret voting mode**: when `secret_voting` is true, hide vote counts on cards. Show only a "You voted" indicator for the current user. Facilitator can reveal vote counts by toggling secret voting off.

---

## Phase 4: Timer

### Architecture

- Use Supabase **Broadcast** channel (`timer:{boardId}`) — ephemeral, no DB writes for timer state.
- Facilitator sends events: `timer:start`, `timer:pause`, `timer:reset`.
- Payload: `{ duration, remaining, started_at }`.
- Each client runs its own `setInterval` countdown, synced by `started_at` ISO timestamp.
- Late joiners send a `timer:sync-request` event; facilitator's client responds with current state.

### UI

- Timer button in FacilitatorToolbar opens a dropdown/popover with:
  - Preset buttons: 2 min, 5 min, 10 min (from `TIMER_PRESETS`).
  - Custom duration input.
- Once started: countdown display visible to all participants in the board header area.
- Controls (facilitator only): start, pause, reset.
- Participants see the countdown but cannot control it.
- On expiry: `playTimerDing()` fires on all clients. Countdown shows "Time's up!" with a pulsing animation.
- `resumeAudioContext()` called on first user interaction (join button click) to satisfy browser autoplay policy.

---

## Phase 5: Action Items + Export

### Action Items

- Slide-in panel from the right side of the board (overlay, does not replace columns).
- Toggle button in FacilitatorToolbar to open/close the panel.
- Any participant can add action items.
- Fields per item:
  - `description` (required) — free text.
  - `assignee` (optional) — dropdown of current participants or free text.
  - `due_date` (optional) — date picker.
  - `status` — open / in_progress / done. Checkbox-style click to cycle.
- Inline editing: click description, assignee, or date to modify.
- Realtime sync via existing `postgres_changes` subscription (action_items table already in realtime publication).
- Drag a card into the action items panel to auto-create an action item from the card's text.

### Export

- Export button in the action items panel header. Exports the full board (not just action items).
- **Markdown**: board title, each column with its cards listed, vote counts, action items section at the end.
- **CSV**: flat table with one row per card (columns: column name, card text, author, vote count), then a separate section for action items.
- Both formats trigger a browser file download — no server-side generation.

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vote model | One vote per card per user | Simpler UX, matches DB UNIQUE constraint, standard for retros |
| Timer sync | Supabase Broadcast | Ephemeral, low latency, no schema changes, no DB writes per tick |
| Column reveal | All-at-once only | Simpler UX, remove unused `revealed_columns` field |
| Export formats | Markdown + CSV | Covers readable sharing and spreadsheet import |

---

## Settings Changes

### Fields to remove from `BoardSettings`

- `max_votes_per_card` — no longer needed (one vote per card per user).
- `max_votes_per_column` — never enforced, remove.
- `revealed_columns` — not needed with all-at-once reveal.

### Fields to keep

- `card_visibility` — 'hidden' | 'visible'.
- `voting_enabled` — boolean.
- `max_votes_per_participant` — number (default 5).
- `secret_voting` — boolean.
- `board_locked` — boolean.
- `card_creation_disabled` — boolean.
- `anonymous_cards` — boolean.
- `highlighted_card_id` — string | null.
- `timer` — `TimerState` (kept for initial state / fallback, actual sync via Broadcast).
