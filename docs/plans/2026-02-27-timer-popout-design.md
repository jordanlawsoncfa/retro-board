# Timer Pop-out Design

**Date:** 2026-02-27
**Status:** Approved

## Problem

The timer controls render inline in the header toolbar, consuming horizontal space and appearing cramped—especially on narrower viewports. The "Minutes" input + "Start" button sit awkwardly alongside other toolbar icons.

## Solution

Replace the inline timer with a **popover** anchored to a clock icon button in the facilitator toolbar. The icon stays compact; clicking it opens a self-contained panel with timer presets and active countdown controls.

Non-admin participants keep the existing inline `TimerDisplay` badge in the board sub-header (no change).

## Design

### Trigger — Clock icon in toolbar

- Renders as a standard `ToolbarButton` (clock icon + "Timer" label) in the `FacilitatorToolbar`.
- When the timer is active (running/paused/expired), the button gets a **colored status indicator**:
  - Running: navy background tint (matches existing active toolbar button style)
  - Paused: gray tint
  - Expired: red/error tint with pulse
- Clicking toggles the popover open/closed.

### Popover panel (admin only)

Anchored below-right of the clock icon. Width: ~240px. White background, border, shadow-lg, rounded-lg. z-index: 50.

**Idle state (no active timer):**
- "Quick start" label
- Preset buttons: 1 min, 2 min, 3 min, 5 min, 10 min (pill buttons, same as current)
- Divider
- "Custom" label
- Minutes input + Start button (same as current)
- Clicking a preset or Start immediately starts the timer and closes the popover

**Active state (running/paused/expired):**
- Large countdown display: `3:42` — monospace, ~24px, centered
  - Navy text when running, gray when paused, red + pulse when expired
  - Expired shows "Time's up!" instead of numbers
- Control buttons below countdown, centered:
  - Running: Pause + Reset
  - Paused: Resume + Reset
  - Expired: Reset only
- Subtle divider
- "New timer" text link — resets and switches to idle/preset view

### Dismiss behavior

- Click outside popover closes it
- Escape key closes it
- Timer continues running regardless of popover state (open or closed)

### Non-admin view (unchanged)

Participants who are not admins see the existing `TimerDisplay` component in the board sub-header — a compact badge showing the countdown when the timer is active. No popover for non-admins.

## Files affected

| File | Change |
|------|--------|
| `src/components/Timer/TimerControls.tsx` | Rewrite — unified popover with idle + active states |
| `src/components/Board/FacilitatorToolbar.tsx` | Replace inline `TimerControls` with clock `ToolbarButton` + popover |
| `src/components/Timer/TimerDisplay.tsx` | No change (non-admin badge) |
| `src/pages/BoardPage.tsx` | No change (timer props already passed through) |

## Accessibility

- Popover receives `role="dialog"` and `aria-label="Timer controls"`
- Clock button gets `aria-expanded` and `aria-haspopup="dialog"`
- Focus moves into popover on open, returns to trigger on close
- Escape key closes popover
- All buttons have accessible labels

## Out of scope

- Draggable/floating timer window
- Timer sounds or visual notifications beyond existing behavior
- Changes to non-admin timer display
- Timer duration limits or validation changes
