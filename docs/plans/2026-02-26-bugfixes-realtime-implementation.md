# Bugfixes & Realtime Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 bugs: timer popover, color picker z-index, card text contrast, board owner model, realtime presence, participant popover, and full event sync.

**Architecture:** Refactor timer into popover dropdown. Fix z-index stacking. Add luminance-based contrast utility. Introduce board owner/facilitator model with Supabase Presence for live online status. Build participant popover with role management. Audit all realtime subscriptions.

**Tech Stack:** React 19, TypeScript, Zustand 5, Supabase Realtime (Presence + postgres_changes + Broadcast), Tailwind CSS 4, lucide-react

---

### Task 1: Update Timer Presets in Constants

**Files:**
- Modify: `src/utils/constants.ts:11-15`

**Step 1: Update TIMER_PRESETS to include 1, 2, 3, 5, 10 min**

Current presets are `[2min, 5min, 10min]`. Replace with:

```typescript
export const TIMER_PRESETS = [
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
];
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```
feat: add 1min and 3min timer presets
```

---

### Task 2: Refactor TimerControls into Popover

**Files:**
- Modify: `src/components/Timer/TimerControls.tsx`

**Step 1: Rewrite TimerControls as a popover**

Replace the entire component. The new version:
- Shows a single clock icon button in the toolbar (when idle/expired)
- Clicking opens a popover with preset pills + custom input + Start button
- When running/paused, shows compact countdown + pause/resume/reset inline (no popover)
- Popover positioned `absolute right-0 top-full z-50` with click-outside close

```tsx
import { useState, useRef, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { TIMER_PRESETS } from '../../utils/constants';
import type { TimerState } from '../../types';

interface TimerControlsProps {
  timer: TimerState;
  onStart: (duration: number) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

export function TimerControls({ timer, onStart, onPause, onResume, onReset }: TimerControlsProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isExpired = timer.status === 'expired';
  const isActive = isRunning || isPaused;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPopover]);

  const handleStartCustom = () => {
    const mins = parseFloat(customMinutes);
    if (mins > 0 && mins <= 60) {
      onStart(mins * 60);
      setCustomMinutes('');
      setShowPopover(false);
    }
  };

  const handlePresetClick = (seconds: number) => {
    onStart(seconds);
    setShowPopover(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Active timer: show compact inline controls
  if (isActive) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm font-mono font-semibold tabular-nums" style={{ color: timer.remaining <= 10 ? '#DD0031' : 'var(--color-navy)' }}>
          {formatTime(timer.remaining)}
        </span>
        {isRunning ? (
          <button onClick={onPause} className="p-1 rounded hover:bg-[var(--color-gray-1)]" title="Pause">
            <Pause size={14} />
          </button>
        ) : (
          <button onClick={onResume} className="p-1 rounded hover:bg-[var(--color-gray-1)]" title="Resume">
            <Play size={14} />
          </button>
        )}
        <button onClick={onReset} className="p-1 rounded hover:bg-[var(--color-gray-1)]" title="Reset">
          <RotateCcw size={14} />
        </button>
      </div>
    );
  }

  // Idle/expired: show clock button + popover
  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors ${
          isExpired
            ? 'text-[#DD0031] hover:bg-red-50'
            : 'text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]'
        }`}
        title="Set timer"
      >
        <Clock size={14} />
        <span>{isExpired ? "Time's up!" : 'Timer'}</span>
      </button>

      {showPopover && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-[var(--color-gray-2)] p-3 z-50 w-56">
          <p className="text-xs font-medium text-[var(--color-gray-5)] mb-2">Quick start</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TIMER_PRESETS.map((preset) => (
              <button
                key={preset.seconds}
                onClick={() => handlePresetClick(preset.seconds)}
                className="px-2.5 py-1 text-xs rounded-full border border-[var(--color-gray-2)] hover:bg-[var(--color-navy)] hover:text-white hover:border-[var(--color-navy)] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="border-t border-[var(--color-gray-1)] pt-2">
            <p className="text-xs font-medium text-[var(--color-gray-5)] mb-1.5">Custom</p>
            <div className="flex gap-1.5">
              <input
                type="number"
                min="1"
                max="60"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartCustom()}
                placeholder="Minutes"
                className="flex-1 px-2 py-1 text-xs border border-[var(--color-gray-2)] rounded-md focus:outline-none focus:border-[var(--color-navy)]"
              />
              <button
                onClick={handleStartCustom}
                disabled={!customMinutes || parseFloat(customMinutes) <= 0 || parseFloat(customMinutes) > 60}
                className="px-3 py-1 text-xs bg-[var(--color-navy)] text-white rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors

**Step 3: Verify in browser**

- Clock button visible in toolbar (not causing scroll)
- Click opens popover with 5 presets + custom input
- Selecting a preset starts timer and closes popover
- Running timer shows compact countdown inline

**Step 4: Commit**

```
fix: refactor timer into popover dropdown to prevent header scroll
```

---

### Task 3: Fix Color Picker Z-Index

**Files:**
- Modify: `src/components/Board/CardColorPicker.tsx:37` — bump `z-10` to `z-30`
- Modify: `src/components/Board/RetroCard.tsx` — elevate card z-index when picker open

**Step 1: Bump CardColorPicker dropdown z-index**

In `CardColorPicker.tsx`, change line 37:
```
z-10 → z-30
```

**Step 2: Add state to elevate RetroCard when color picker is open**

In `RetroCard.tsx`, add a `colorPickerOpen` state and pass an `onOpenChange` callback to `CardColorPicker`. When open, add `z-20` to the card's className.

In RetroCard, add state:
```typescript
const [colorPickerOpen, setColorPickerOpen] = useState(false);
```

On the card container div (line ~68), add conditional z-index:
```tsx
className={`... ${colorPickerOpen ? 'z-20 relative' : 'relative'}`}
```

Update `CardColorPicker` to accept and call `onOpenChange`:

In `CardColorPicker.tsx`, add `onOpenChange?: (open: boolean) => void` to props. Call it when `showPicker` changes.

In `RetroCard.tsx`, pass `onOpenChange={setColorPickerOpen}` to `<CardColorPicker>`.

**Step 3: Verify build**

Run: `npx tsc --noEmit && npm run lint`

**Step 4: Verify in browser**

- Open color picker on a card that has cards below it
- Picker should float above all other cards

**Step 5: Commit**

```
fix: color picker z-index so it renders above other cards
```

---

### Task 4: Add Card Text Contrast Utility

**Files:**
- Create: `src/utils/cardColors.ts`

**Step 1: Create getCardTextColor utility**

```typescript
/**
 * Returns appropriate text color (dark or light) based on card background color.
 * Uses relative luminance calculation per WCAG 2.0.
 */
export function getCardTextColor(bgColor: string | null): 'dark' | 'light' {
  if (!bgColor) return 'dark';

  // Parse hex color
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // sRGB to linear
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // Threshold: 0.4 gives good results for our palette
  return luminance > 0.4 ? 'dark' : 'light';
}

/** CSS class names for card text based on contrast mode */
export const CARD_TEXT_CLASSES = {
  dark: {
    text: 'text-[var(--color-gray-8)]',
    subtext: 'text-[var(--color-gray-4)]',
    icon: 'text-[var(--color-gray-4)]',
    iconHover: 'hover:text-[var(--color-gray-6)]',
  },
  light: {
    text: 'text-white',
    subtext: 'text-white/70',
    icon: 'text-white/70',
    iconHover: 'hover:text-white',
  },
} as const;
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
feat: add luminance-based card text contrast utility
```

---

### Task 5: Apply Contrast to RetroCard

**Files:**
- Modify: `src/components/Board/RetroCard.tsx`

**Step 1: Import and use contrast utility**

Add imports:
```typescript
import { getCardTextColor, CARD_TEXT_CLASSES } from '../../utils/cardColors';
```

Add at the top of the component body:
```typescript
const contrast = CARD_TEXT_CLASSES[getCardTextColor(color)];
```

**Step 2: Replace hardcoded text colors**

Replace all fixed color classes on the card with `contrast.*` values:

- Card text (line ~88): replace `text-[var(--color-gray-8)]` with `${contrast.text}`
- Author name (line ~115): replace `text-[var(--color-gray-4)]` with `${contrast.subtext}`
- Edit icon button: replace `text-[var(--color-gray-3)]` with `${contrast.icon} ${contrast.iconHover}`
- Delete icon button: same treatment
- Palette icon button: same treatment
- Vote button text: replace `text-[var(--color-gray-4)]` and `text-[var(--color-navy)]` with contrast equivalents

**Step 3: Verify build**

Run: `npx tsc --noEmit && npm run lint`

**Step 4: Verify in browser**

- Apply each of the 7 colors to a card
- Confirm text is readable on every color
- Confirm icons (edit, delete, palette, vote) are visible on every color

**Step 5: Commit**

```
fix: adapt card text and icon colors based on background luminance
```

---

### Task 6: Board Owner Model — Update Store & Types

**Files:**
- Modify: `src/stores/boardStore.ts`
- Modify: `src/types/index.ts` (if needed)

**Step 1: Set board creator as admin**

In `boardStore.ts`, in `createBoard` (around line 76), the `created_by` is currently a placeholder UUID. After the board is created and the creator joins, their `is_admin` should be `true`.

In `joinBoard` (around line 177), add logic: if this participant's ID matches `board.created_by`, set `is_admin: true`. Otherwise `is_admin: false`.

Actually, better approach: in `createBoard`, after inserting the board row, also insert the creator as a participant with `is_admin: true` and store their participant ID in `created_by`. Then in `joinBoard`, check if a participant record already exists (the creator) and skip re-inserting.

Detailed changes:

In `createBoard` (~line 70-100):
- After board insert, also insert a participant record with `is_admin: true`
- Store the participant ID in sessionStorage
- Update `created_by` on the board row to be the participant ID
- Set `currentParticipantId` in state

In `joinBoard` (~line 175-200):
- First check if participant already exists (sessionStorage has ID and it's in the participants table)
- If exists, just set `currentParticipantId` and return
- If new joiner, insert with `is_admin: false` as before

**Step 2: Add `updateParticipant` action to store**

Add a new store action for promoting/demoting participants:

```typescript
updateParticipant: async (participantId: string, updates: Partial<Pick<Participant, 'is_admin'>>) => {
  const { error } = await supabase
    .from('participants')
    .update(updates)
    .eq('id', participantId);
  if (error) throw error;
  // Optimistic update
  set((state) => ({
    participants: state.participants.map((p) =>
      p.id === participantId ? { ...p, ...updates } : p
    ),
  }));
},
```

**Step 3: Add `removeParticipant` action to store**

```typescript
removeParticipant: async (participantId: string) => {
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participantId);
  if (error) throw error;
  set((state) => ({
    participants: state.participants.filter((p) => p.id !== participantId),
  }));
},
```

**Step 4: Add participants UPDATE subscription**

In `subscribeToBoard` (~line 490), add a handler for `participants` UPDATE events alongside the existing INSERT:

```typescript
.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'participants', filter: `board_id=eq.${boardId}` },
  (payload) => {
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === payload.new.id ? { ...payload.new as Participant } : p
      ),
    }));
  }
)
```

Also add `participants` DELETE handler:

```typescript
.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'participants', filter: `board_id=eq.${boardId}` },
  (payload) => {
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== payload.old.id),
    }));
  }
)
```

**Step 5: Verify build**

Run: `npx tsc --noEmit && npm run lint`

**Step 6: Commit**

```
feat: add board owner model with facilitator promotion/demotion
```

---

### Task 7: Conditionally Render Facilitator Toolbar

**Files:**
- Modify: `src/pages/BoardPage.tsx`

**Step 1: Derive `isAdmin` from current participant**

Add near the existing derived state:
```typescript
const currentParticipant = participants.find((p) => p.id === currentParticipantId);
const isAdmin = currentParticipant?.is_admin ?? false;
```

**Step 2: Gate FacilitatorToolbar on `isAdmin`**

Change the condition that renders `<FacilitatorToolbar>` from checking if `currentParticipantId` exists to checking `isAdmin`:

```tsx
{isAdmin && !isCompleted && (
  <FacilitatorToolbar ... />
)}
```

Non-admin users will see the header without facilitator controls.

**Step 3: Verify build**

Run: `npx tsc --noEmit && npm run lint`

**Step 4: Verify in browser**

- Board creator sees facilitator toolbar
- Incognito joiner does NOT see facilitator toolbar
- When promoted (after Task 9), joiner gains toolbar

**Step 5: Commit**

```
fix: only show facilitator toolbar to admin participants
```

---

### Task 8: Add Supabase Presence Channel

**Files:**
- Create: `src/hooks/usePresence.ts`
- Modify: `src/stores/boardStore.ts` — add `onlineParticipantIds` state

**Step 1: Add `onlineParticipantIds` to store state**

In `boardStore.ts`, add to state interface and initial state:
```typescript
onlineParticipantIds: string[];
```

Initialize as `[]`. Add a setter:
```typescript
setOnlineParticipantIds: (ids: string[]) => void;
```

Implementation:
```typescript
setOnlineParticipantIds: (ids) => set({ onlineParticipantIds: ids }),
```

Also reset it in `reset()`.

**Step 2: Create usePresence hook**

```typescript
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useBoardStore } from '../stores/boardStore';

interface PresenceState {
  participant_id: string;
  display_name: string;
  is_admin: boolean;
  online_at: string;
}

export function usePresence(boardId: string | undefined, participantId: string | null) {
  const setOnlineParticipantIds = useBoardStore((s) => s.setOnlineParticipantIds);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!boardId || !participantId) return;

    const participant = useBoardStore.getState().participants.find((p) => p.id === participantId);
    if (!participant) return;

    const channel = supabase.channel(`presence:${boardId}`, {
      config: { presence: { key: participantId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const ids = Object.keys(state);
        setOnlineParticipantIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            participant_id: participantId,
            display_name: participant.display_name,
            is_admin: participant.is_admin,
            online_at: new Date().toISOString(),
          } satisfies PresenceState);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, participantId, setOnlineParticipantIds]);
}
```

**Step 3: Wire usePresence into BoardPage**

In `BoardPage.tsx`, import and call:
```typescript
import { usePresence } from '../hooks/usePresence';
// In component body:
usePresence(boardId, currentParticipantId);
```

**Step 4: Verify build**

Run: `npx tsc --noEmit && npm run lint`

**Step 5: Verify in browser**

- Open board in two tabs
- Check that `onlineParticipantIds` updates (inspect via React DevTools or console)

**Step 6: Commit**

```
feat: add Supabase Presence channel for live online tracking
```

---

### Task 9: Build Participant Popover Component

**Files:**
- Create: `src/components/Board/ParticipantPopover.tsx`

**Step 1: Create ParticipantPopover**

```tsx
import { useState, useRef, useEffect } from 'react';
import { Users, Shield, ShieldOff, UserMinus } from 'lucide-react';
import type { Participant } from '../../types';

interface ParticipantPopoverProps {
  participants: Participant[];
  onlineParticipantIds: string[];
  currentParticipantId: string | null;
  isAdmin: boolean;
  boardCreatorId: string;
  onPromote: (participantId: string) => void;
  onDemote: (participantId: string) => void;
  onRemove: (participantId: string) => void;
}

export function ParticipantPopover({
  participants,
  onlineParticipantIds,
  currentParticipantId,
  isAdmin,
  boardCreatorId,
  onPromote,
  onDemote,
  onRemove,
}: ParticipantPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Sort: online first, then alphabetical
  const sorted = [...participants].sort((a, b) => {
    const aOnline = onlineParticipantIds.includes(a.id) ? 0 : 1;
    const bOnline = onlineParticipantIds.includes(b.id) ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    return a.display_name.localeCompare(b.display_name);
  });

  const onlineCount = participants.filter((p) => onlineParticipantIds.includes(p.id)).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] rounded-md transition-colors"
        title="View participants"
      >
        <Users size={14} />
        <span>{onlineCount}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-[var(--color-gray-2)] z-50 w-72 max-h-80 overflow-y-auto">
          <div className="p-3 border-b border-[var(--color-gray-1)]">
            <p className="text-xs font-semibold text-[var(--color-gray-6)]">
              Participants ({participants.length})
            </p>
          </div>
          <ul className="py-1">
            {sorted.map((p) => {
              const isOnline = onlineParticipantIds.includes(p.id);
              const isCreator = p.id === boardCreatorId;
              const isSelf = p.id === currentParticipantId;

              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[var(--color-gray-0)]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isOnline ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm text-[var(--color-gray-7)] truncate">
                      {p.display_name}
                      {isSelf && <span className="text-[var(--color-gray-4)]"> (you)</span>}
                    </span>
                    {p.is_admin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-navy)] text-white flex-shrink-0">
                        Facilitator
                      </span>
                    )}
                  </div>

                  {isAdmin && !isSelf && !isCreator && (
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {p.is_admin ? (
                        <button
                          onClick={() => onDemote(p.id)}
                          className="p-1 text-[var(--color-gray-3)] hover:text-[var(--color-gray-6)] rounded"
                          title="Demote to participant"
                        >
                          <ShieldOff size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => onPromote(p.id)}
                          className="p-1 text-[var(--color-gray-3)] hover:text-[var(--color-navy)] rounded"
                          title="Promote to facilitator"
                        >
                          <Shield size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => onRemove(p.id)}
                        className="p-1 text-[var(--color-gray-3)] hover:text-red-500 rounded"
                        title="Remove participant"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit && npm run lint`

**Step 3: Commit**

```
feat: add participant popover with roles, online status, and admin actions
```

---

### Task 10: Wire ParticipantPopover into BoardPage

**Files:**
- Modify: `src/pages/BoardPage.tsx`

**Step 1: Import ParticipantPopover and store actions**

```typescript
import { ParticipantPopover } from '../components/Board/ParticipantPopover';
```

Add store selectors:
```typescript
const onlineParticipantIds = useBoardStore((s) => s.onlineParticipantIds);
const updateParticipant = useBoardStore((s) => s.updateParticipant);
const removeParticipant = useBoardStore((s) => s.removeParticipant);
```

**Step 2: Replace participant count display with ParticipantPopover**

Remove the old `<Users size={14} /> {participantCount}` from FacilitatorToolbar props (or keep the count display in FacilitatorToolbar but remove the user icon from there).

In the board header area (near Share button), add:
```tsx
<ParticipantPopover
  participants={participants}
  onlineParticipantIds={onlineParticipantIds}
  currentParticipantId={currentParticipantId}
  isAdmin={isAdmin}
  boardCreatorId={board.created_by}
  onPromote={(id) => updateParticipant(id, { is_admin: true })}
  onDemote={(id) => updateParticipant(id, { is_admin: false })}
  onRemove={(id) => removeParticipant(id)}
/>
```

This should be visible to ALL participants (not just admins), but the promote/demote/remove buttons are gated inside the component on `isAdmin`.

**Step 3: Remove participant count from FacilitatorToolbar**

Since the popover now shows participant info, remove the `participantCount` prop and its display from `FacilitatorToolbar.tsx` (lines 107-110).

**Step 4: Verify build**

Run: `npx tsc --noEmit && npm run lint`

**Step 5: Verify in browser**

- Click user count icon — popover opens with participant list
- Green dot for online users, gray for offline
- Facilitator badge shown for admins
- Admin sees promote/demote/remove buttons
- Non-admin sees view-only list

**Step 6: Commit**

```
feat: wire participant popover into board header for all users
```

---

### Task 11: Audit & Fix Realtime Sync

**Files:**
- Modify: `src/stores/boardStore.ts`

**Step 1: Verify boards UPDATE handler properly merges settings**

In `subscribeToBoard`, find the `boards` UPDATE handler. Ensure it does a deep merge of settings:

```typescript
.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'boards', filter: `id=eq.${boardId}` },
  (payload) => {
    const updated = payload.new;
    set((state) => ({
      board: state.board ? {
        ...state.board,
        ...updated,
        settings: { ...state.board.settings, ...(updated.settings as BoardSettings) },
      } : null,
    }));
  }
)
```

This ensures that when the facilitator toggles visibility/voting/lock, all connected clients immediately see the change.

**Step 2: Verify participant INSERT handler**

Ensure the existing INSERT handler adds the new participant to the store array properly. Check that it doesn't duplicate if the participant already exists:

```typescript
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `board_id=eq.${boardId}` },
  (payload) => {
    set((state) => {
      const exists = state.participants.some((p) => p.id === payload.new.id);
      if (exists) return state;
      return { participants: [...state.participants, payload.new as Participant] };
    });
  }
)
```

**Step 3: Verify all event types are covered**

Checklist of subscriptions that should exist:
- [ ] `cards` INSERT/UPDATE/DELETE
- [ ] `columns` INSERT/UPDATE/DELETE
- [ ] `votes` INSERT/DELETE
- [ ] `participants` INSERT/UPDATE/DELETE (UPDATE and DELETE are new from Task 6)
- [ ] `boards` UPDATE
- [ ] `action_items` INSERT/UPDATE/DELETE

Verify each handler exists. If any are missing, add them.

**Step 4: Verify build**

Run: `npx tsc --noEmit && npm run lint`

**Step 5: Full integration test in browser**

Open board in two browser windows (one normal, one incognito):

1. **Settings sync:** Toggle card visibility — both windows update
2. **Card sync:** Add card in one — appears in other
3. **Vote sync:** Vote in one — count updates in other
4. **Participant sync:** See both users in participant popover
5. **Presence sync:** Close incognito — green dot turns gray
6. **Role sync:** Promote incognito user — they gain facilitator toolbar
7. **Timer sync:** Start timer — both windows show countdown

**Step 6: Commit**

```
fix: audit and fix realtime subscriptions for full event sync
```

---

### Task 12: Final Cleanup & Lint

**Files:**
- All modified files

**Step 1: Run full build check**

Run: `npx tsc --noEmit && npm run lint`

Fix any remaining errors.

**Step 2: Run production build**

Run: `npm run build`

Verify no build errors (chunk size warning is pre-existing and acceptable).

**Step 3: Commit any cleanup**

```
chore: final cleanup and lint fixes
```
