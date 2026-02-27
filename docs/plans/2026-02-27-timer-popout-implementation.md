# Timer Pop-out Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the inline timer in the header toolbar with a popover that opens from a compact clock icon button.

**Architecture:** Rewrite `TimerControls` as a self-contained popover component with idle (presets) and active (countdown + controls) states. `FacilitatorToolbar` renders a `ToolbarButton` that the popover anchors to. Non-admin `TimerDisplay` stays unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, lucide-react icons

**Design doc:** `docs/plans/2026-02-27-timer-popout-design.md`

---

### Task 1: Rewrite TimerControls as a unified popover

**Files:**
- Modify: `src/components/Timer/TimerControls.tsx` (full rewrite)

**Step 1: Rewrite the component**

Replace the entire contents of `TimerControls.tsx` with:

```tsx
import { useState, useRef, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TIMER_PRESETS } from '@/utils/constants';
import type { TimerState } from '@/types';

interface TimerControlsProps {
  timer: TimerState;
  onStart: (duration: number) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TimerControls({ timer, onStart, onPause, onResume, onReset }: TimerControlsProps) {
  const [open, setOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isExpired = timer.status === 'expired';
  const isActive = isRunning || isPaused;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const handlePresetClick = (seconds: number) => {
    onStart(seconds);
    setOpen(false);
  };

  const handleStartCustom = () => {
    const mins = parseFloat(customMinutes);
    if (mins > 0 && mins <= 60) {
      onStart(mins * 60);
      setCustomMinutes('');
      setOpen(false);
    }
  };

  const handleReset = () => {
    onReset();
  };

  // Determine trigger button style based on timer state
  const triggerActive = isActive || isExpired;
  const triggerClassName = cn(
    'flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm transition-colors',
    isRunning && 'bg-[var(--color-navy)]/10 text-[var(--color-navy)] font-medium',
    isPaused && 'bg-[var(--color-gray-1)] text-[var(--color-gray-6)] font-medium',
    isExpired && 'bg-[var(--color-error)]/10 text-[var(--color-error)] font-medium animate-pulse',
    !triggerActive && 'text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)]'
  );

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={triggerClassName}
        title="Timer"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Clock size={14} />
        <span className="hidden sm:inline">Timer</span>
      </button>

      {/* Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Timer controls"
          className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-[var(--color-gray-2)] bg-white p-3 shadow-lg z-50"
        >
          {isActive || isExpired ? (
            /* Active / expired state */
            <div className="flex flex-col items-center gap-3">
              {/* Countdown or expired message */}
              {isExpired ? (
                <span className="text-lg font-semibold text-[var(--color-error)] animate-pulse">
                  Time&apos;s up!
                </span>
              ) : (
                <span
                  className="text-2xl font-mono font-bold tabular-nums"
                  style={{
                    color: timer.remaining <= 10 ? 'var(--color-error)' : 'var(--color-navy)',
                  }}
                >
                  {formatTime(timer.remaining)}
                </span>
              )}

              {/* Controls */}
              <div className="flex items-center gap-2">
                {isRunning && (
                  <button
                    onClick={onPause}
                    className="flex items-center gap-1 rounded-md border border-[var(--color-gray-2)] px-3 py-1.5 text-xs hover:bg-[var(--color-gray-1)] transition-colors"
                    title="Pause"
                  >
                    <Pause size={12} />
                    Pause
                  </button>
                )}
                {isPaused && (
                  <button
                    onClick={onResume}
                    className="flex items-center gap-1 rounded-md bg-[var(--color-navy)] px-3 py-1.5 text-xs text-white hover:opacity-90 transition-opacity"
                    title="Resume"
                  >
                    <Play size={12} />
                    Resume
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 rounded-md border border-[var(--color-gray-2)] px-3 py-1.5 text-xs hover:bg-[var(--color-gray-1)] transition-colors"
                  title="Reset"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              </div>

              {/* New timer link */}
              <div className="w-full border-t border-[var(--color-gray-1)] pt-2 text-center">
                <button
                  onClick={handleReset}
                  className="text-xs text-[var(--color-navy)] hover:underline"
                >
                  New timer
                </button>
              </div>
            </div>
          ) : (
            /* Idle state — presets + custom */
            <>
              <p className="mb-2 text-xs font-medium text-[var(--color-gray-5)]">Quick start</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {TIMER_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    onClick={() => handlePresetClick(preset.seconds)}
                    className="rounded-full border border-[var(--color-gray-2)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--color-navy)] hover:bg-[var(--color-navy)] hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--color-gray-1)] pt-2">
                <p className="mb-1.5 text-xs font-medium text-[var(--color-gray-5)]">Custom</p>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartCustom()}
                    placeholder="Minutes"
                    className="flex-1 rounded-md border border-[var(--color-gray-2)] px-2 py-1 text-xs focus:border-[var(--color-navy)] focus:outline-none"
                  />
                  <button
                    onClick={handleStartCustom}
                    disabled={!customMinutes || parseFloat(customMinutes) <= 0 || parseFloat(customMinutes) > 60}
                    className="rounded-md bg-[var(--color-navy)] px-3 py-1 text-xs text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Start
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors from `TimerControls.tsx`

**Step 3: Commit**

```bash
git add src/components/Timer/TimerControls.tsx
git commit -m "feat: rewrite TimerControls as unified popover with idle and active states"
```

---

### Task 2: Update FacilitatorToolbar to use the popover naturally

**Files:**
- Modify: `src/components/Board/FacilitatorToolbar.tsx`

The `TimerControls` component now renders its own trigger button styled to match the toolbar. The existing `<TimerControls>` call in the toolbar already passes all the right props — no changes needed to the toolbar itself.

**Step 1: Verify visually**

Open the app at `http://localhost:5173`, join a board as admin. Confirm:
- Clock icon appears in toolbar row, styled consistently with other toolbar buttons
- Clicking it opens the popover below with presets
- Selecting a preset starts the timer and closes the popover
- Re-opening shows the countdown + pause/reset controls
- "Time's up!" shows in red when expired
- "New timer" resets and returns to presets
- Clicking outside or pressing Escape closes the popover

**Step 2: Verify non-admin view**

Open a second browser tab, join the same board as a non-admin. Confirm:
- No timer popover visible (no clock icon in header — they don't have the toolbar)
- The `TimerDisplay` badge appears in the board sub-header when the timer is running
- Badge shows countdown, pulses red on expiry

**Step 3: Commit (if any toolbar adjustments were needed)**

```bash
git add src/components/Board/FacilitatorToolbar.tsx
git commit -m "fix: adjust toolbar for popover timer integration"
```

If no changes were needed, skip this commit.

---

### Task 3: Clean up unused TimerDisplay inline from board sub-header (optional)

**Files:**
- Review: `src/pages/BoardPage.tsx:277-279`

The `TimerDisplay` in the board sub-header (line 277-279) still shows for all joined participants when the timer is active. This is the **non-admin view** and should remain. No changes needed.

**Step 1: Confirm no dead code**

Verify `TimerDisplay` is still exported and used:
- `src/components/Timer/TimerDisplay.tsx` — still needed
- `src/components/Timer/index.ts` — still exports both
- `src/pages/BoardPage.tsx:278` — still renders `<TimerDisplay timer={timer} />`

No action needed. This task is confirmation only.
