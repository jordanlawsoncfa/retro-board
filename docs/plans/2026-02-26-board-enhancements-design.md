# Retro Board Enhancements Design

**Date:** 2026-02-26
**Status:** Approved

## Overview

Four enhancements to improve the retro board's usability, collaboration, and flexibility:

1. Prominent Share/Copy Link button
2. Complete Retro (read-only mode)
3. Card color picker
4. Multiple board views (Grid, Swimlane, List, Timeline)

---

## Enhancement A: Prominent Share/Copy Link Button

### Location
Board header, visible to all participants. Replaces the existing share button buried in the FacilitatorToolbar.

### Behavior
- Button displays a Link icon + "Share" label
- Click copies the full board URL (`window.location.href`) to clipboard
- Button text briefly changes to "Copied!" with a checkmark icon for ~2 seconds, then reverts
- Available to all participants, not just the facilitator

### Visual
Outlined/secondary button style so it doesn't compete with primary actions but is clearly clickable.

### Changes Required
- New `ShareButton` component (or inline in BoardPage header)
- Remove existing share button from `FacilitatorToolbar`
- Uses `navigator.clipboard.writeText()` API

---

## Enhancement B: Complete Retro (Read-only Mode)

### Trigger
New "Complete Retro" button in the `FacilitatorToolbar` with a CheckCircle icon. Only visible to the facilitator.

### Confirmation
Modal dialog: *"Complete this retrospective? The board will become read-only. This cannot be undone."* with Cancel / Complete buttons.

### Effects on Completion
Sets `archived_at` to the current timestamp in Supabase. The following UI changes apply:

**Hidden when completed:**
- `AddCardForm`
- Card edit/delete buttons
- Vote buttons
- FacilitatorToolbar controls (except participant count)
- Timer controls

**Disabled when completed:**
- Drag & drop reordering
- Action items add/edit/delete

**Unchanged when completed:**
- Cards fully visible (blur removed regardless of previous `card_visibility` setting)
- Action items panel viewable
- Export buttons (MD/CSV) still functional

**Header:** A "Completed" badge appears next to the board title.

### Data Model
Uses the existing `archived_at: string | null` field on the `Board` type. No schema changes needed.

### Realtime Sync
The `archived_at` change propagates via the existing board UPDATE subscription. All participants see the read-only state immediately.

### Irreversible
Once completed, the board stays completed. No undo.

---

## Enhancement C: Card Color Picker

### UI Trigger
A small color circle (12px) appears in the top-right corner of the card when hovering, next to the existing edit/delete icons. Shows the card's current color (neutral gray for "Default"). On mobile/touch, always visible on the author's own cards.

### Palette Popup
Clicking the circle opens a compact popover with 7 colors from `constants.ts`:

| Name    | Hex       |
|---------|-----------|
| Yellow  | `#FEF3C7` |
| Blue    | `#DBEAFE` |
| Green   | `#D1FAE5` |
| Pink    | `#FCE7F3` |
| Orange  | `#FFEDD5` |
| Cream   | `#FEF9EF` |
| Default | transparent (shown as circle with "x" or slash) |

### Permissions
Only the card author can see and use the color picker. Other users see the resulting color on the card.

### Card Styling
Selected color applies as the card's background color. Text remains dark for contrast. Column header colors are unaffected.

### Data Model
Uses the existing `color: string | null` field on the `Card` type. Updates via `updateCard(cardId, { color })`. No schema changes needed.

---

## Enhancement D: Multiple Board Views

### View Toggle
A segmented control in the board header (below the title, above the columns). Four icon buttons with tooltips:
- **Grid** (LayoutGrid icon) - default
- **Swimlane** (Rows icon)
- **List** (List icon)
- **Timeline** (Clock icon)

Active view is visually highlighted.

### View State
Stored in URL query param (`?view=swimlane`). Defaults to `grid` if no param present. Shareable and survives page refresh.

### Grid View
The existing column-based layout. No changes.

### Swimlane View
Rows grouped by a user-selectable criterion via a toggle above the swimlanes:

- **By Author** - One row per participant. Columns remain the same. Cards filtered to that author in each row.
- **By Vote Count** - Rows for "High votes (3+)", "Some votes (1-2)", "No votes".
- **By Time Added** - Rows for time buckets ("First 5 min", "5-10 min", "10+ min") based on `created_at` relative to board `created_at`.

Each row is collapsible. Horizontal scroll within rows if needed.

### List View
A compact flat table of all cards across all columns:

| Column (colored tag) | Card Text | Author | Votes |
|---|---|---|---|

Sortable by any column header (click to toggle asc/desc). Good for scanning and searching.

### Timeline View
Cards displayed chronologically (oldest to newest, top to bottom). Vertical timeline with timestamps on the left. Each card shows its column as a colored tag. Cards submitted within ~1 minute are grouped together.

### Interactions by View
| Feature | Grid | Swimlane | List | Timeline |
|---|---|---|---|---|
| Drag & drop | Yes | No | No | No |
| Vote | Yes | Yes | Yes | Yes |
| Edit/Delete | Yes | Yes | Yes | Yes |
| Color picker | Yes | Yes | Yes | Yes |
| Add card | Yes | No | No | No |

---

## Technical Notes

### No Schema Changes
All four enhancements use existing database fields (`archived_at`, `color`). No Supabase migrations required.

### New Components
- `ShareButton` (or inline)
- `CompleteRetroModal`
- `CardColorPicker`
- `ViewToggle`
- `SwimlaneView`
- `ListView`
- `TimelineView`
- `SwimlaneGroupToggle`

### Modified Components
- `BoardPage` - integrate share button, view toggle, completed state
- `FacilitatorToolbar` - add Complete Retro button, remove share button
- `RetroCard` - add color picker trigger, apply background color
- `BoardColumn` - conditional rendering based on completed state
- `AddCardForm` - hidden when completed
- `ActionItemsPanel` - read-only when completed
