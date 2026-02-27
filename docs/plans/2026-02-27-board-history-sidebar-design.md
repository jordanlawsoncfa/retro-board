# Board History Sidebar Design

**Date:** 2026-02-27
**Status:** Approved

## Problem

Users have no way to find or revisit past retrospective boards. There is no authentication, so there's no server-side user-to-board mapping. Board URLs are the only way back, and they're easily lost.

## Solution

Track board visits locally in `localStorage` and display a sidebar panel on the home page listing recent boards with title, date, and status.

## Data Layer

### BoardHistoryEntry

```ts
interface BoardHistoryEntry {
  boardId: string;
  title: string;
  createdAt: string;     // ISO timestamp
  lastVisited: string;   // ISO timestamp, updated on each visit
  isCompleted: boolean;  // synced from board.archived_at
}
```

### Storage

- **Key:** `retro-board-history`
- **Value:** JSON array of `BoardHistoryEntry`, sorted by `lastVisited` descending
- **Max entries:** 50 (drop oldest by `lastVisited` when exceeded)

### Write triggers

| Event | Action |
|-------|--------|
| Board created (`createBoard`) | Push new entry with current timestamp |
| Board joined/loaded (`fetchBoard`) | Push new entry or update existing (title, lastVisited, isCompleted) |
| Board completed (`completeBoard`) | Update entry's `isCompleted` to true |

### Read

On home page mount, load entries from localStorage and sort by `lastVisited` descending.

### Edge cases

- Board deleted server-side: Entry remains in history. Clicking navigates to `/board/{id}` which shows the join/error flow normally.
- localStorage unavailable: Sidebar simply doesn't render. No errors.
- Duplicate entries: Deduplicate by `boardId` on write (update existing rather than push duplicate).

## Sidebar UI

### Placement

Right side of the home page, adjacent to the centered hero. Only renders if there is at least 1 history entry. If no history, the hero stays fully centered.

### Layout

Home page shifts from single centered column to a flex layout:
- **Left/center area:** Hero content (title, subtitle, CTA) remains vertically centered
- **Right area:** Sidebar panel (~280px wide), vertically centered alongside the hero

### Panel content

- **Header:** "Recent Boards" with a Clock icon, styled as a subtle heading
- **List:** Scrollable (max-height capped), each entry is a clickable row:
  - Board title (truncated with ellipsis if long)
  - Relative date from `lastVisited` (e.g. "2 days ago", "just now")
  - Small badge: green "Completed" or gray "Active"
- **Footer:** "Clear history" text link — clears localStorage key, hides sidebar

### Styling

- White background, subtle border, rounded corners, light shadow — matches existing card/panel styling
- Uses existing design tokens (CSS custom properties)
- Responsive: On narrow viewports, sidebar moves below the hero or hides entirely

## Files affected

| File | Change |
|------|--------|
| `src/utils/boardHistory.ts` | **New** — localStorage read/write/clear helpers |
| `src/types/index.ts` | Add `BoardHistoryEntry` interface |
| `src/components/Board/BoardHistorySidebar.tsx` | **New** — sidebar panel component |
| `src/components/Board/index.ts` | Export new component |
| `src/pages/HomePage.tsx` | Import sidebar, adjust layout to flex |
| `src/stores/boardStore.ts` | Call history helpers on create/fetch/complete |

## Out of scope

- Cross-device sync (requires authentication)
- Server-side board listing API
- Search/filter within history
- Board thumbnails or preview
