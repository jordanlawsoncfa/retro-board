# Phases 3-5 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Also use `frontend-ux-design` and `full-stack-developer` skills for implementation guidance.

**Goal:** Implement card obfuscation polish + voting simplification (Phase 3), synced countdown timer (Phase 4), and action items panel with board export (Phase 5).

**Architecture:** Zustand store handles all client state with optimistic updates. Supabase Postgres Changes provides realtime sync for persistent data (cards, votes, action items). Supabase Broadcast provides ephemeral sync for the timer. All UI uses the existing design token system (CSS custom properties + Tailwind v4 @theme).

**Tech Stack:** React 19, TypeScript 5.9 (strict), Vite 7.3, Zustand 5, Supabase (supabase-js 2.97), @dnd-kit, Tailwind CSS v4, lucide-react icons.

---

## Phase 3: Voting Simplification + Card Polish

### Task 1: Simplify BoardSettings type and defaults

**Files:**
- Modify: `src/types/index.ts:20-33`
- Modify: `src/utils/constants.ts:3-16`

**Step 1: Remove unused fields from BoardSettings interface**

In `src/types/index.ts`, replace the `BoardSettings` interface (lines 20-33) with:

```typescript
export interface BoardSettings {
  card_visibility: 'hidden' | 'visible';
  voting_enabled: boolean;
  max_votes_per_participant: number;
  secret_voting: boolean;
  board_locked: boolean;
  card_creation_disabled: boolean;
  anonymous_cards: boolean;
  timer: TimerState;
  highlighted_card_id: string | null;
}
```

Removed: `max_votes_per_column`, `max_votes_per_card`, `revealed_columns`.

**Step 2: Update DEFAULT_BOARD_SETTINGS**

In `src/utils/constants.ts`, replace lines 3-16 with:

```typescript
export const DEFAULT_BOARD_SETTINGS: import('@/types').BoardSettings = {
  card_visibility: 'hidden',
  voting_enabled: false,
  max_votes_per_participant: 5,
  secret_voting: false,
  board_locked: false,
  card_creation_disabled: false,
  anonymous_cards: false,
  highlighted_card_id: null,
  timer: { duration: 0, remaining: 0, status: 'idle', started_at: null },
};
```

**Step 3: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS (no references to the removed fields should exist outside the store's toggleVote)

**Step 4: Commit**

```bash
git add src/types/index.ts src/utils/constants.ts
git commit -m "refactor: simplify BoardSettings — remove unused voting/reveal fields"
```

---

### Task 2: Simplify toggleVote in the store

**Files:**
- Modify: `src/stores/boardStore.ts:313-346`

**Step 1: Simplify toggleVote to single-vote-per-card**

Replace the `toggleVote` method (lines 313-346) with:

```typescript
  toggleVote: async (cardId) => {
    const { board, votes, currentParticipantId } = get();
    if (!board || !currentParticipantId) return;

    const existingVote = votes.find(
      (v) => v.card_id === cardId && v.voter_id === currentParticipantId
    );

    if (existingVote) {
      // Remove vote
      const { error } = await supabase.from('votes').delete().eq('id', existingVote.id);
      if (error) throw error;
      set((state) => ({ votes: state.votes.filter((v) => v.id !== existingVote.id) }));
    } else {
      // Check global vote limit
      const myVoteCount = votes.filter((v) => v.voter_id === currentParticipantId).length;
      if (myVoteCount >= board.settings.max_votes_per_participant) return;

      // Add vote (DB UNIQUE constraint enforces one-per-card)
      const newVote = {
        id: crypto.randomUUID(),
        card_id: cardId,
        board_id: board.id,
        voter_id: currentParticipantId,
      };

      const { error } = await supabase.from('votes').insert(newVote);
      if (error) throw error;

      set((state) => ({
        votes: [...state.votes, { ...newVote, created_at: new Date().toISOString() }],
      }));
    }
  },
```

**Step 2: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/stores/boardStore.ts
git commit -m "refactor: simplify toggleVote to one-vote-per-card model"
```

---

### Task 3: Add reveal animation to RetroCard

**Files:**
- Modify: `src/components/Board/RetroCard.tsx:57-67`

**Step 1: Replace inline filter style with CSS transition**

In `RetroCard.tsx`, change the card's outer `<div>` (lines 57-67) to use a transition on the filter property:

```typescript
    <div
      className={cn(
        'group relative rounded-[var(--radius-md)] border border-[var(--color-gray-1)] bg-white p-3 shadow-sm',
        'transition-[filter] duration-400 ease-out',
        isObscured && !isAuthor && 'select-none'
      )}
      style={{
        backgroundColor: color || undefined,
        filter: isObscured && !isAuthor ? 'blur(6px)' : 'blur(0px)',
      }}
    >
```

Key changes:
- Added `transition-[filter] duration-400 ease-out` for smooth unblur animation.
- Changed filter to always output a `blur()` value (`blur(0px)` when visible) so the transition has start/end values.

**Step 2: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/Board/RetroCard.tsx
git commit -m "feat: add smooth reveal animation when cards are unblurred"
```

---

### Task 4: Add vote count badge to column headers

**Files:**
- Modify: `src/components/Board/BoardColumn.tsx:52-64`

**Step 1: Add vote count computation and badge**

In `BoardColumn.tsx`, add a `columnVoteCount` computation after the existing `cardIds` memo (after line 43):

```typescript
  const columnVoteCount = useMemo(
    () => votes.filter((v) => cards.some((c) => c.id === v.card_id)).length,
    [votes, cards]
  );
```

Then update the column header section (lines 52-64). Replace the existing card count badge span (line 61-63) with both a card count and a vote count badge:

```typescript
      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-[var(--color-gray-1)] px-4 py-3">
        <div
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: column.color }}
        />
        <h3 className="flex-1 text-base font-semibold text-[var(--color-gray-8)]">
          {column.title}
        </h3>
        <span className="rounded-[var(--radius-full)] bg-[var(--color-gray-1)] px-2 py-0.5 text-xs font-medium text-[var(--color-gray-5)]">
          {cards.length}
        </span>
        {votingEnabled && columnVoteCount > 0 && (
          <span className="flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-navy)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-navy)]">
            <ThumbsUp size={10} />
            {columnVoteCount}
          </span>
        )}
      </div>
```

Add the `ThumbsUp` import at the top of the file:

```typescript
import { ThumbsUp } from 'lucide-react';
```

**Step 2: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/Board/BoardColumn.tsx
git commit -m "feat: add vote count badge to column headers"
```

---

### Task 5: Add "votes remaining" indicator + vote limit feedback

**Files:**
- Create: `src/components/Board/VoteStatus.tsx`
- Modify: `src/pages/BoardPage.tsx:165-173`
- Modify: `src/components/Board/index.ts`
- Modify: `src/components/Board/RetroCard.tsx:5-19` (add `voteLimitReached` prop)

**Step 1: Create VoteStatus component**

Create `src/components/Board/VoteStatus.tsx`:

```typescript
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/utils/cn';

interface VoteStatusProps {
  votesUsed: number;
  maxVotes: number;
}

export function VoteStatus({ votesUsed, maxVotes }: VoteStatusProps) {
  const remaining = maxVotes - votesUsed;
  const isExhausted = remaining <= 0;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm',
        isExhausted
          ? 'bg-[var(--color-error)]/10 text-[var(--color-error)] font-medium'
          : 'bg-[var(--color-navy)]/10 text-[var(--color-navy)]'
      )}
    >
      <ThumbsUp size={14} />
      <span>
        {remaining} of {maxVotes} vote{maxVotes !== 1 ? 's' : ''} remaining
      </span>
    </div>
  );
}
```

**Step 2: Add VoteStatus to barrel export**

In `src/components/Board/index.ts`, add:

```typescript
export { VoteStatus } from './VoteStatus';
```

**Step 3: Render VoteStatus in BoardPage header**

In `src/pages/BoardPage.tsx`, add the import:

```typescript
import { BoardColumn, FacilitatorToolbar, VoteStatus } from '@/components/Board';
```

Then in the board header section (after line 172, inside the `mx-auto max-w-[1400px]` div), add the VoteStatus:

```typescript
      <div className="border-b border-[var(--color-gray-1)] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl text-[var(--color-gray-8)]">{board.title}</h2>
              {board.description && (
                <p className="mt-1 text-sm text-[var(--color-gray-5)]">{board.description}</p>
              )}
            </div>
            {isJoined && board.settings.voting_enabled && (
              <VoteStatus
                votesUsed={votes.filter((v) => v.voter_id === currentParticipantId).length}
                maxVotes={board.settings.max_votes_per_participant}
              />
            )}
          </div>
        </div>
      </div>
```

**Step 4: Add voteLimitReached prop to RetroCard**

In `src/components/Board/RetroCard.tsx`, add `voteLimitReached` to the props interface:

```typescript
interface RetroCardProps {
  id: string;
  text: string;
  authorName: string;
  authorId: string;
  color: string | null;
  voteCount: number;
  hasVoted: boolean;
  isAuthor: boolean;
  isObscured: boolean;
  votingEnabled: boolean;
  voteLimitReached: boolean;
  onUpdate: (cardId: string, text: string) => void;
  onDelete: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
}
```

Add `voteLimitReached` to the destructured props. Then update the vote button (lines 112-126):

```typescript
              {votingEnabled && (
                <button
                  onClick={() => onToggleVote(id)}
                  disabled={!hasVoted && voteLimitReached}
                  className={cn(
                    'flex items-center gap-1 rounded-[var(--radius-full)] px-2 py-0.5 text-xs transition-colors',
                    hasVoted
                      ? 'bg-[var(--color-navy)]/10 text-[var(--color-navy)] font-medium'
                      : voteLimitReached
                        ? 'cursor-not-allowed text-[var(--color-gray-3)]'
                        : 'text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]'
                  )}
                  aria-label={hasVoted ? 'Remove vote' : voteLimitReached ? 'Vote limit reached' : 'Vote for this card'}
                  title={voteLimitReached && !hasVoted ? 'No votes remaining' : undefined}
                >
                  <ThumbsUp size={12} />
                  {voteCount > 0 && <span>{voteCount}</span>}
                </button>
              )}
```

**Step 5: Pass voteLimitReached in BoardColumn**

In `src/components/Board/BoardColumn.tsx`, compute the vote limit and pass it down. After the `columnVoteCount` memo, add:

```typescript
  const voteLimitReached = useMemo(() => {
    if (!currentParticipantId) return false;
    const myVoteCount = votes.filter((v) => v.voter_id === currentParticipantId).length;
    return myVoteCount >= (maxVotesPerParticipant ?? 5);
  }, [votes, currentParticipantId, maxVotesPerParticipant]);
```

Add `maxVotesPerParticipant` to `BoardColumnProps`:

```typescript
interface BoardColumnProps {
  column: Column;
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  votingEnabled: boolean;
  cardCreationDisabled: boolean;
  maxVotesPerParticipant: number;
  onAddCard: (columnId: string, text: string) => void;
  onUpdateCard: (cardId: string, text: string) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
}
```

Add `maxVotesPerParticipant` to the destructured props. Then pass `voteLimitReached` to RetroCard (inside the map, add the prop):

```typescript
                <RetroCard
                  id={card.id}
                  text={card.text}
                  authorName={card.author_name}
                  authorId={card.author_id}
                  color={card.color}
                  voteCount={cardVotes.length}
                  hasVoted={hasVoted}
                  isAuthor={card.author_id === currentParticipantId}
                  isObscured={isObscured}
                  votingEnabled={votingEnabled}
                  voteLimitReached={voteLimitReached}
                  onUpdate={onUpdateCard}
                  onDelete={onDeleteCard}
                  onToggleVote={onToggleVote}
                />
```

**Step 6: Pass maxVotesPerParticipant in BoardPage**

In `src/pages/BoardPage.tsx`, add the prop to each `<BoardColumn>`:

```typescript
                      maxVotesPerParticipant={board.settings.max_votes_per_participant}
```

**Step 7: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 8: Commit**

```bash
git add src/components/Board/VoteStatus.tsx src/components/Board/index.ts src/components/Board/RetroCard.tsx src/components/Board/BoardColumn.tsx src/pages/BoardPage.tsx
git commit -m "feat: add votes-remaining indicator and disable buttons at vote limit"
```

---

### Task 6: Secret voting mode

**Files:**
- Modify: `src/components/Board/RetroCard.tsx` (add `secretVoting` prop)
- Modify: `src/components/Board/BoardColumn.tsx` (pass through)
- Modify: `src/pages/BoardPage.tsx` (pass through)
- Modify: `src/components/Board/FacilitatorToolbar.tsx` (add toggle)

**Step 1: Add secretVoting prop to RetroCard**

Add `secretVoting: boolean` to `RetroCardProps`. Add to destructured props. Then update the vote button display logic:

```typescript
              {votingEnabled && (
                <button
                  onClick={() => onToggleVote(id)}
                  disabled={!hasVoted && voteLimitReached}
                  className={cn(
                    'flex items-center gap-1 rounded-[var(--radius-full)] px-2 py-0.5 text-xs transition-colors',
                    hasVoted
                      ? 'bg-[var(--color-navy)]/10 text-[var(--color-navy)] font-medium'
                      : voteLimitReached
                        ? 'cursor-not-allowed text-[var(--color-gray-3)]'
                        : 'text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]'
                  )}
                  aria-label={hasVoted ? 'Remove vote' : voteLimitReached ? 'Vote limit reached' : 'Vote for this card'}
                  title={voteLimitReached && !hasVoted ? 'No votes remaining' : undefined}
                >
                  <ThumbsUp size={12} />
                  {secretVoting
                    ? (hasVoted && <span className="text-[10px]">Voted</span>)
                    : (voteCount > 0 && <span>{voteCount}</span>)
                  }
                </button>
              )}
```

When `secretVoting` is true: show "Voted" text only if the current user voted, hide numeric counts.

**Step 2: Pass secretVoting through BoardColumn**

Add `secretVoting: boolean` to `BoardColumnProps`. Pass it to `RetroCard`. Also conditionally hide the column vote badge when secret voting is on:

```typescript
        {votingEnabled && !secretVoting && columnVoteCount > 0 && (
```

**Step 3: Pass secretVoting in BoardPage**

Add prop to each `<BoardColumn>`:

```typescript
                      secretVoting={board.settings.secret_voting}
```

**Step 4: Add secret voting toggle to FacilitatorToolbar**

In `FacilitatorToolbar.tsx`, add `EyeOff` usage (already imported) and a new toggle after the voting toggle (after line 55):

```typescript
      {/* Secret voting toggle — only show when voting is enabled */}
      {votingOn && (
        <ToolbarButton
          icon={settings.secret_voting ? EyeOff : Eye}
          label={settings.secret_voting ? 'Secret voting' : 'Open voting'}
          active={settings.secret_voting}
          onClick={() => onUpdateSettings({ secret_voting: !settings.secret_voting })}
        />
      )}
```

**Step 5: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/Board/RetroCard.tsx src/components/Board/BoardColumn.tsx src/pages/BoardPage.tsx src/components/Board/FacilitatorToolbar.tsx
git commit -m "feat: add secret voting mode — hides vote counts until facilitator reveals"
```

---

## Phase 4: Timer

### Task 7: Create Timer component

**Files:**
- Create: `src/components/Timer/TimerDisplay.tsx`
- Create: `src/components/Timer/TimerControls.tsx`
- Create: `src/components/Timer/index.ts`

**Step 1: Create TimerDisplay**

Create `src/components/Timer/TimerDisplay.tsx`:

```typescript
import { cn } from '@/utils/cn';
import { Clock } from 'lucide-react';
import type { TimerState } from '@/types';

interface TimerDisplayProps {
  timer: TimerState;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TimerDisplay({ timer }: TimerDisplayProps) {
  if (timer.status === 'idle') return null;

  const isExpired = timer.status === 'expired';
  const isRunning = timer.status === 'running';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium tabular-nums',
        isExpired && 'animate-pulse bg-[var(--color-error)]/10 text-[var(--color-error)]',
        isRunning && 'bg-[var(--color-navy)]/10 text-[var(--color-navy)]',
        timer.status === 'paused' && 'bg-[var(--color-gray-1)] text-[var(--color-gray-6)]'
      )}
    >
      <Clock size={14} />
      {isExpired ? (
        <span>Time&apos;s up!</span>
      ) : (
        <span>{formatTime(timer.remaining)}</span>
      )}
    </div>
  );
}
```

**Step 2: Create TimerControls**

Create `src/components/Timer/TimerControls.tsx`:

```typescript
import { useState } from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
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

export function TimerControls({ timer, onStart, onPause, onResume, onReset }: TimerControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');

  const isIdle = timer.status === 'idle';
  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isExpired = timer.status === 'expired';

  const handleCustomStart = () => {
    const mins = parseInt(customMinutes, 10);
    if (mins > 0 && mins <= 60) {
      onStart(mins * 60);
      setCustomMinutes('');
      setIsOpen(false);
    }
  };

  if (isRunning || isPaused) {
    return (
      <div className="flex items-center gap-1">
        {isRunning ? (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)] transition-colors"
            title="Pause timer"
          >
            <Pause size={14} />
            <span className="hidden sm:inline">Pause</span>
          </button>
        ) : (
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-navy)] hover:bg-[var(--color-navy)]/10 transition-colors"
            title="Resume timer"
          >
            <Play size={14} />
            <span className="hidden sm:inline">Resume</span>
          </button>
        )}
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)] transition-colors"
          title="Reset timer"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm transition-colors',
          isExpired
            ? 'text-[var(--color-error)] hover:bg-[var(--color-error)]/10'
            : 'text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)]'
        )}
        title="Timer"
      >
        <Clock size={14} />
        <span className="hidden sm:inline">{isExpired ? 'Restart' : 'Timer'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-white p-2 shadow-lg">
          {TIMER_PRESETS.map((preset) => (
            <button
              key={preset.seconds}
              onClick={() => {
                onStart(preset.seconds);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-1)] transition-colors"
            >
              <Play size={12} />
              {preset.label}
            </button>
          ))}

          <div className="mt-1 border-t border-[var(--color-gray-1)] pt-1">
            <div className="flex items-center gap-1 px-1">
              <input
                type="number"
                min="1"
                max="60"
                placeholder="min"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomStart()}
                className="w-16 rounded-[var(--radius-sm)] border border-[var(--color-gray-2)] px-2 py-1.5 text-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
              />
              <button
                onClick={handleCustomStart}
                disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
                className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-sm text-[var(--color-navy)] hover:bg-[var(--color-navy)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Play size={12} />
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

**Step 3: Create barrel export**

Create `src/components/Timer/index.ts`:

```typescript
export { TimerDisplay } from './TimerDisplay';
export { TimerControls } from './TimerControls';
```

**Step 4: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/Timer/
git commit -m "feat: add Timer UI components — TimerDisplay and TimerControls"
```

---

### Task 8: Create useTimer hook with Supabase Broadcast

**Files:**
- Create: `src/hooks/useTimer.ts`

**Step 1: Create the useTimer hook**

Create `src/hooks/useTimer.ts`:

```typescript
import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { playTimerDing, resumeAudioContext } from '@/lib/audio';
import type { TimerState } from '@/types';

const IDLE_TIMER: TimerState = { duration: 0, remaining: 0, status: 'idle', started_at: null };

interface UseTimerOptions {
  boardId: string;
  isFacilitator: boolean;
}

export function useTimer({ boardId, isFacilitator }: UseTimerOptions) {
  const [timer, setTimer] = useState<TimerState>(IDLE_TIMER);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Cleanup interval
  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start local countdown
  const startCountdown = useCallback((startedAt: string, duration: number) => {
    clearTick();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const remaining = Math.max(0, duration - elapsed);

      if (remaining <= 0) {
        clearTick();
        setTimer({ duration, remaining: 0, status: 'expired', started_at: startedAt });
        playTimerDing();
      } else {
        setTimer({ duration, remaining, status: 'running', started_at: startedAt });
      }
    }, 250); // Update 4x/sec for smooth display
  }, [clearTick]);

  // Broadcast actions (facilitator only)
  const broadcastEvent = useCallback((event: string, payload: Partial<TimerState>) => {
    channelRef.current?.send({
      type: 'broadcast',
      event,
      payload,
    });
  }, []);

  const start = useCallback((duration: number) => {
    resumeAudioContext();
    const startedAt = new Date().toISOString();
    const state = { duration, remaining: duration, status: 'running' as const, started_at: startedAt };
    setTimer(state);
    startCountdown(startedAt, duration);
    broadcastEvent('timer:start', state);
  }, [startCountdown, broadcastEvent]);

  const pause = useCallback(() => {
    clearTick();
    setTimer((prev) => {
      const paused = { ...prev, status: 'paused' as const };
      broadcastEvent('timer:pause', paused);
      return paused;
    });
  }, [clearTick, broadcastEvent]);

  const resume = useCallback(() => {
    resumeAudioContext();
    setTimer((prev) => {
      const startedAt = new Date(Date.now() - (prev.duration - prev.remaining) * 1000).toISOString();
      const resumed = { ...prev, status: 'running' as const, started_at: startedAt };
      startCountdown(startedAt, prev.duration);
      broadcastEvent('timer:resume', resumed);
      return resumed;
    });
  }, [startCountdown, broadcastEvent]);

  const reset = useCallback(() => {
    clearTick();
    setTimer(IDLE_TIMER);
    broadcastEvent('timer:reset', IDLE_TIMER);
  }, [clearTick, broadcastEvent]);

  // Subscribe to broadcast channel
  useEffect(() => {
    const channel = supabase.channel(`timer:${boardId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'timer:start' }, ({ payload }) => {
        if (!isFacilitator) {
          resumeAudioContext();
          setTimer(payload as TimerState);
          startCountdown(payload.started_at!, payload.duration);
        }
      })
      .on('broadcast', { event: 'timer:pause' }, ({ payload }) => {
        if (!isFacilitator) {
          clearTick();
          setTimer(payload as TimerState);
        }
      })
      .on('broadcast', { event: 'timer:resume' }, ({ payload }) => {
        if (!isFacilitator) {
          resumeAudioContext();
          setTimer(payload as TimerState);
          startCountdown(payload.started_at!, payload.duration);
        }
      })
      .on('broadcast', { event: 'timer:reset' }, () => {
        if (!isFacilitator) {
          clearTick();
          setTimer(IDLE_TIMER);
        }
      })
      .on('broadcast', { event: 'timer:sync-request' }, () => {
        // Facilitator responds to sync requests from late joiners
        if (isFacilitator) {
          broadcastEvent('timer:sync-response', timer);
        }
      })
      .on('broadcast', { event: 'timer:sync-response' }, ({ payload }) => {
        if (!isFacilitator) {
          const state = payload as TimerState;
          setTimer(state);
          if (state.status === 'running' && state.started_at) {
            startCountdown(state.started_at, state.duration);
          }
        }
      })
      .subscribe(() => {
        // Request sync on join (non-facilitators)
        if (!isFacilitator) {
          channel.send({ type: 'broadcast', event: 'timer:sync-request', payload: {} });
        }
      });

    return () => {
      clearTick();
      supabase.removeChannel(channel);
    };
  }, [boardId, isFacilitator, startCountdown, clearTick, broadcastEvent, timer]);

  return { timer, start, pause, resume, reset };
}
```

**Step 2: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/useTimer.ts
git commit -m "feat: add useTimer hook with Supabase Broadcast sync"
```

---

### Task 9: Wire Timer into FacilitatorToolbar and BoardPage

**Files:**
- Modify: `src/components/Board/FacilitatorToolbar.tsx`
- Modify: `src/pages/BoardPage.tsx`

**Step 1: Update FacilitatorToolbar to accept timer props**

Replace the FacilitatorToolbar to include timer controls. Update the props interface and replace the timer placeholder:

In `FacilitatorToolbar.tsx`, add imports:

```typescript
import { TimerControls } from '@/components/Timer';
import type { BoardSettings, TimerState } from '@/types';
```

Update the props interface:

```typescript
interface FacilitatorToolbarProps {
  settings: BoardSettings;
  participantCount: number;
  boardId: string;
  timer: TimerState;
  onUpdateSettings: (settings: Partial<BoardSettings>) => void;
  onTimerStart: (duration: number) => void;
  onTimerPause: () => void;
  onTimerResume: () => void;
  onTimerReset: () => void;
}
```

Destructure the new props. Replace the timer placeholder (lines 57-64) with:

```typescript
      {/* Timer controls */}
      <TimerControls
        timer={timer}
        onStart={onTimerStart}
        onPause={onTimerPause}
        onResume={onTimerResume}
        onReset={onTimerReset}
      />
```

**Step 2: Wire useTimer into BoardPage**

In `BoardPage.tsx`, add imports:

```typescript
import { useTimer } from '@/hooks/useTimer';
import { TimerDisplay } from '@/components/Timer';
```

After the `sensors` setup (line 44), add the timer hook:

```typescript
  const isFacilitator = !!currentParticipantId && board?.created_by === currentParticipantId;
  const { timer, start: timerStart, pause: timerPause, resume: timerResume, reset: timerReset } = useTimer({
    boardId: boardId || '',
    isFacilitator,
  });
```

Note: Since we don't have auth yet and `created_by` is a random UUID, every participant will be treated as a facilitator. This is fine for Phase 4 — auth integration in a future phase will differentiate.

Update the FacilitatorToolbar render to pass timer props:

```typescript
          <FacilitatorToolbar
            settings={board.settings}
            participantCount={participants.length}
            boardId={board.id}
            timer={timer}
            onUpdateSettings={updateSettings}
            onTimerStart={timerStart}
            onTimerPause={timerPause}
            onTimerResume={timerResume}
            onTimerReset={timerReset}
          />
```

Add TimerDisplay in the board header, next to VoteStatus:

```typescript
            {isJoined && timer.status !== 'idle' && (
              <TimerDisplay timer={timer} />
            )}
```

**Step 3: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/Board/FacilitatorToolbar.tsx src/pages/BoardPage.tsx
git commit -m "feat: wire timer into facilitator toolbar and board page"
```

---

## Phase 5: Action Items + Export

### Task 10: Add action item CRUD methods to the store

**Files:**
- Modify: `src/stores/boardStore.ts`

**Step 1: Add action item methods to the BoardState interface**

In the `BoardState` interface (around line 44), add before the `// Realtime` comment:

```typescript
  // Action Items
  addActionItem: (description: string, assignee?: string, dueDate?: string) => Promise<void>;
  updateActionItem: (itemId: string, updates: Partial<Pick<ActionItem, 'description' | 'assignee' | 'due_date' | 'status'>>) => Promise<void>;
  deleteActionItem: (itemId: string) => Promise<void>;
```

**Step 2: Implement the methods**

Add the implementations before the `subscribeToBoard` method:

```typescript
  // --- Action Items ---

  addActionItem: async (description, assignee, dueDate) => {
    const { board } = get();
    if (!board) return;

    const newItem = {
      board_id: board.id,
      description,
      assignee: assignee || null,
      due_date: dueDate || null,
      status: 'open' as const,
    };

    const { data, error } = await supabase.from('action_items').insert(newItem).select().single();
    if (error) throw error;

    set((state) => ({
      actionItems: [...state.actionItems, data as ActionItem],
    }));
  },

  updateActionItem: async (itemId, updates) => {
    const { error } = await supabase.from('action_items').update(updates).eq('id', itemId);
    if (error) throw error;

    set((state) => ({
      actionItems: state.actionItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    }));
  },

  deleteActionItem: async (itemId) => {
    const { error } = await supabase.from('action_items').delete().eq('id', itemId);
    if (error) throw error;

    set((state) => ({
      actionItems: state.actionItems.filter((item) => item.id !== itemId),
    }));
  },
```

**Step 3: Add realtime subscription for action_items**

In `subscribeToBoard`, add three handlers before the `.subscribe()` call (around line 444):

```typescript
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'action_items', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.actionItems.some((a) => a.id === payload.new.id)) return state;
            return { actionItems: [...state.actionItems, payload.new as ActionItem] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'action_items', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            actionItems: state.actionItems.map((a) => (a.id === payload.new.id ? (payload.new as ActionItem) : a)),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'action_items', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            actionItems: state.actionItems.filter((a) => a.id !== payload.old.id),
          }));
        }
      )
```

**Step 4: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/stores/boardStore.ts
git commit -m "feat: add action item CRUD + realtime subscription to store"
```

---

### Task 11: Build ActionItems panel component

**Files:**
- Create: `src/components/ActionItems/ActionItemRow.tsx`
- Create: `src/components/ActionItems/ActionItemsPanel.tsx`
- Create: `src/components/ActionItems/index.ts`

**Step 1: Create ActionItemRow**

Create `src/components/ActionItems/ActionItemRow.tsx`:

```typescript
import { useState } from 'react';
import { Check, Circle, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ActionItem, ActionItemStatus, Participant } from '@/types';

interface ActionItemRowProps {
  item: ActionItem;
  participants: Participant[];
  onUpdate: (itemId: string, updates: Partial<Pick<ActionItem, 'description' | 'assignee' | 'due_date' | 'status'>>) => void;
  onDelete: (itemId: string) => void;
}

const STATUS_CYCLE: ActionItemStatus[] = ['open', 'in_progress', 'done'];

const STATUS_ICONS = {
  open: Circle,
  in_progress: Clock,
  done: Check,
} as const;

export function ActionItemRow({ item, participants, onUpdate, onDelete }: ActionItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.description);

  const StatusIcon = STATUS_ICONS[item.status];
  const nextStatus = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % STATUS_CYCLE.length];

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.description) {
      onUpdate(item.id, { description: trimmed });
    }
    setIsEditing(false);
  };

  return (
    <div className={cn(
      'group flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-gray-1)] bg-white p-3',
      item.status === 'done' && 'opacity-60'
    )}>
      {/* Status toggle */}
      <button
        onClick={() => onUpdate(item.id, { status: nextStatus })}
        className={cn(
          'mt-0.5 shrink-0 rounded-full p-0.5 transition-colors',
          item.status === 'done'
            ? 'text-[var(--color-success)]'
            : item.status === 'in_progress'
              ? 'text-[var(--color-navy)]'
              : 'text-[var(--color-gray-4)] hover:text-[var(--color-gray-6)]'
        )}
        title={`Mark as ${nextStatus.replace('_', ' ')}`}
      >
        <StatusIcon size={16} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setEditText(item.description); setIsEditing(false); }
            }}
            autoFocus
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-gray-2)] px-2 py-1 text-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
          />
        ) : (
          <p
            onClick={() => setIsEditing(true)}
            className={cn(
              'cursor-pointer text-sm text-[var(--color-gray-8)]',
              item.status === 'done' && 'line-through'
            )}
          >
            {item.description}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-gray-4)]">
          {/* Assignee */}
          <select
            value={item.assignee || ''}
            onChange={(e) => onUpdate(item.id, { assignee: e.target.value || null })}
            className="max-w-[120px] truncate rounded border-0 bg-transparent p-0 text-xs text-[var(--color-gray-4)] hover:text-[var(--color-gray-6)] focus:outline-none cursor-pointer"
          >
            <option value="">Unassigned</option>
            {participants.map((p) => (
              <option key={p.id} value={p.display_name}>
                {p.display_name}
              </option>
            ))}
          </select>

          {/* Due date */}
          <input
            type="date"
            value={item.due_date || ''}
            onChange={(e) => onUpdate(item.id, { due_date: e.target.value || null })}
            className="rounded border-0 bg-transparent p-0 text-xs text-[var(--color-gray-4)] hover:text-[var(--color-gray-6)] focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(item.id)}
        className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--color-gray-3)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
        title="Delete action item"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
```

**Step 2: Create ActionItemsPanel**

Create `src/components/ActionItems/ActionItemsPanel.tsx`:

```typescript
import { useState } from 'react';
import { X, Plus, Download } from 'lucide-react';
import { cn } from '@/utils/cn';
import { ActionItemRow } from './ActionItemRow';
import type { ActionItem, Participant, Column, Card, Vote } from '@/types';

interface ActionItemsPanelProps {
  open: boolean;
  onClose: () => void;
  actionItems: ActionItem[];
  participants: Participant[];
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  boardTitle: string;
  onAddItem: (description: string, assignee?: string, dueDate?: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<Pick<ActionItem, 'description' | 'assignee' | 'due_date' | 'status'>>) => void;
  onDeleteItem: (itemId: string) => void;
  onExportMarkdown: () => void;
  onExportCsv: () => void;
}

export function ActionItemsPanel({
  open,
  onClose,
  actionItems,
  participants,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onExportMarkdown,
  onExportCsv,
}: ActionItemsPanelProps) {
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = () => {
    const trimmed = newDescription.trim();
    if (!trimmed) return;
    onAddItem(trimmed);
    setNewDescription('');
  };

  const openItems = actionItems.filter((i) => i.status !== 'done');
  const doneItems = actionItems.filter((i) => i.status === 'done');

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--color-gray-1)] bg-white shadow-xl transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-gray-1)] px-4 py-3">
        <h3 className="text-base font-semibold text-[var(--color-gray-8)]">Action Items</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onExportMarkdown}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)] transition-colors"
            title="Export as Markdown"
          >
            <Download size={16} />
          </button>
          <button
            onClick={onExportCsv}
            className="rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)] transition-colors"
            title="Export as CSV"
          >
            CSV
          </button>
          <button
            onClick={onClose}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Add item form */}
      <div className="border-b border-[var(--color-gray-1)] px-4 py-3">
        <div className="flex gap-2">
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add an action item..."
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-2 text-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
          />
          <button
            onClick={handleAdd}
            disabled={!newDescription.trim()}
            className="flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-navy)] px-3 py-2 text-sm text-white hover:bg-[var(--color-navy-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {actionItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-gray-4)]">
            No action items yet. Add one above or drag a card here.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {openItems.map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                participants={participants}
                onUpdate={onUpdateItem}
                onDelete={onDeleteItem}
              />
            ))}
            {doneItems.length > 0 && (
              <>
                <div className="mt-2 mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-gray-4)]">
                  Completed ({doneItems.length})
                </div>
                {doneItems.map((item) => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    participants={participants}
                    onUpdate={onUpdateItem}
                    onDelete={onDeleteItem}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create barrel export**

Create `src/components/ActionItems/index.ts`:

```typescript
export { ActionItemRow } from './ActionItemRow';
export { ActionItemsPanel } from './ActionItemsPanel';
```

**Step 4: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ActionItems/
git commit -m "feat: add ActionItemsPanel and ActionItemRow components"
```

---

### Task 12: Create export utilities

**Files:**
- Create: `src/utils/export.ts`
- Modify: `src/utils/index.ts` (add re-export)

**Step 1: Create export utility**

Create `src/utils/export.ts`:

```typescript
import type { Column, Card, Vote, ActionItem } from '@/types';

interface ExportData {
  boardTitle: string;
  boardDescription: string | null;
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  actionItems: ActionItem[];
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMarkdown(data: ExportData): void {
  const { boardTitle, boardDescription, columns, cards, votes, actionItems } = data;

  const lines: string[] = [];
  lines.push(`# ${boardTitle}`);
  if (boardDescription) lines.push(`\n${boardDescription}`);
  lines.push('');

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  for (const col of sortedColumns) {
    lines.push(`## ${col.title}`);
    if (col.description) lines.push(`*${col.description}*`);
    lines.push('');

    const colCards = cards
      .filter((c) => c.column_id === col.id)
      .sort((a, b) => a.position - b.position);

    if (colCards.length === 0) {
      lines.push('*No cards*');
    } else {
      for (const card of colCards) {
        const voteCount = votes.filter((v) => v.card_id === card.id).length;
        const voteSuffix = voteCount > 0 ? ` (${voteCount} vote${voteCount !== 1 ? 's' : ''})` : '';
        lines.push(`- ${card.text}${voteSuffix} — *${card.author_name}*`);
      }
    }
    lines.push('');
  }

  if (actionItems.length > 0) {
    lines.push('## Action Items');
    lines.push('');
    for (const item of actionItems) {
      const checkbox = item.status === 'done' ? '[x]' : '[ ]';
      const assignee = item.assignee ? ` @${item.assignee}` : '';
      const due = item.due_date ? ` (due: ${item.due_date})` : '';
      lines.push(`- ${checkbox} ${item.description}${assignee}${due}`);
    }
    lines.push('');
  }

  const slug = boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  triggerDownload(lines.join('\n'), `${slug}-retro.md`, 'text/markdown');
}

export function exportCsv(data: ExportData): void {
  const { boardTitle, columns, cards, votes, actionItems } = data;

  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const lines: string[] = [];

  // Cards section
  lines.push('Column,Card,Author,Votes');
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  for (const col of sortedColumns) {
    const colCards = cards
      .filter((c) => c.column_id === col.id)
      .sort((a, b) => a.position - b.position);

    for (const card of colCards) {
      const voteCount = votes.filter((v) => v.card_id === card.id).length;
      lines.push(`${escape(col.title)},${escape(card.text)},${escape(card.author_name)},${voteCount}`);
    }
  }

  // Action items section
  if (actionItems.length > 0) {
    lines.push('');
    lines.push('Action Item,Assignee,Due Date,Status');
    for (const item of actionItems) {
      lines.push(
        `${escape(item.description)},${escape(item.assignee || '')},${escape(item.due_date || '')},${escape(item.status)}`
      );
    }
  }

  const slug = boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  triggerDownload(lines.join('\n'), `${slug}-retro.csv`, 'text/csv');
}
```

**Step 2: Add re-export**

In `src/utils/index.ts`, add:

```typescript
export { exportMarkdown, exportCsv } from './export';
```

**Step 3: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/utils/export.ts src/utils/index.ts
git commit -m "feat: add Markdown and CSV export utilities"
```

---

### Task 13: Wire ActionItems panel and Export into BoardPage

**Files:**
- Modify: `src/pages/BoardPage.tsx`
- Modify: `src/components/Board/FacilitatorToolbar.tsx`

**Step 1: Add action items toggle to FacilitatorToolbar**

In `FacilitatorToolbar.tsx`, add `ClipboardList` to the lucide imports. Add new props:

```typescript
interface FacilitatorToolbarProps {
  settings: BoardSettings;
  participantCount: number;
  boardId: string;
  timer: TimerState;
  actionItemCount: number;
  onUpdateSettings: (settings: Partial<BoardSettings>) => void;
  onTimerStart: (duration: number) => void;
  onTimerPause: () => void;
  onTimerResume: () => void;
  onTimerReset: () => void;
  onToggleActionItems: () => void;
}
```

Add a button before the divider:

```typescript
      {/* Action Items */}
      <ToolbarButton
        icon={ClipboardList}
        label={`Actions${actionItemCount > 0 ? ` (${actionItemCount})` : ''}`}
        onClick={onToggleActionItems}
      />
```

**Step 2: Wire everything into BoardPage**

In `BoardPage.tsx`, add imports:

```typescript
import { ActionItemsPanel } from '@/components/ActionItems';
import { exportMarkdown, exportCsv } from '@/utils/export';
```

Add store methods to the destructured useBoardStore:

```typescript
    addActionItem,
    updateActionItem,
    deleteActionItem,
    actionItems,
```

Add panel state:

```typescript
  const [showActionItems, setShowActionItems] = useState(false);
```

Add export handlers:

```typescript
  const handleExportMarkdown = useCallback(() => {
    if (!board) return;
    exportMarkdown({
      boardTitle: board.title,
      boardDescription: board.description,
      columns,
      cards,
      votes,
      actionItems,
    });
  }, [board, columns, cards, votes, actionItems]);

  const handleExportCsv = useCallback(() => {
    if (!board) return;
    exportCsv({
      boardTitle: board.title,
      boardDescription: board.description,
      columns,
      cards,
      votes,
      actionItems,
    });
  }, [board, columns, cards, votes, actionItems]);
```

Pass new props to FacilitatorToolbar:

```typescript
          <FacilitatorToolbar
            settings={board.settings}
            participantCount={participants.length}
            boardId={board.id}
            timer={timer}
            actionItemCount={actionItems.length}
            onUpdateSettings={updateSettings}
            onTimerStart={timerStart}
            onTimerPause={timerPause}
            onTimerResume={timerResume}
            onTimerReset={timerReset}
            onToggleActionItems={() => setShowActionItems((v) => !v)}
          />
```

Render ActionItemsPanel before the closing `</AppShell>`:

```typescript
      {/* Action Items Panel */}
      {isJoined && (
        <ActionItemsPanel
          open={showActionItems}
          onClose={() => setShowActionItems(false)}
          actionItems={actionItems}
          participants={participants}
          columns={columns}
          cards={cards}
          votes={votes}
          boardTitle={board.title}
          onAddItem={addActionItem}
          onUpdateItem={updateActionItem}
          onDeleteItem={deleteActionItem}
          onExportMarkdown={handleExportMarkdown}
          onExportCsv={handleExportCsv}
        />
      )}
```

Also add an overlay behind the panel when open:

```typescript
      {/* Panel overlay */}
      {showActionItems && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={() => setShowActionItems(false)}
        />
      )}
```

**Step 3: Verify build**

Run: `npx tsc -b --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/pages/BoardPage.tsx src/components/Board/FacilitatorToolbar.tsx
git commit -m "feat: wire action items panel and export into board page"
```

---

### Task 14: Final build verification and push

**Step 1: Full build check**

Run: `npx tsc -b --noEmit && npx vite build`
Expected: Both pass cleanly.

**Step 2: Push to remote**

```bash
git push origin main
```

---

## Summary

| Task | Phase | What It Does |
|------|-------|-------------|
| 1 | 3 | Simplify BoardSettings type — remove unused fields |
| 2 | 3 | Simplify toggleVote to one-vote-per-card |
| 3 | 3 | Add smooth blur reveal animation |
| 4 | 3 | Add vote count badge on column headers |
| 5 | 3 | Add VoteStatus component + vote limit feedback on buttons |
| 6 | 3 | Add secret voting mode |
| 7 | 4 | Create Timer UI components |
| 8 | 4 | Create useTimer hook with Supabase Broadcast |
| 9 | 4 | Wire timer into toolbar and board page |
| 10 | 5 | Add action item CRUD to store + realtime |
| 11 | 5 | Build ActionItems panel UI |
| 12 | 5 | Create Markdown + CSV export utilities |
| 13 | 5 | Wire panel and export into board page |
| 14 | — | Final build verification and push |
