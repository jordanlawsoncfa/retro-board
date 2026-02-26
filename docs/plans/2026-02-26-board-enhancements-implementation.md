# Board Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four enhancements to the retro board: prominent share button, complete/read-only mode, card color picker, and multiple board views (grid, swimlane, list, timeline).

**Architecture:** Each enhancement is implemented as an independent task group. No database schema changes are needed — all features use existing fields (`archived_at`, `color`). New view components are added alongside the existing grid layout, toggled via URL query params. The store gets one new method (`completeBoard`) and one update to `updateCard` to support color changes.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS 4, Supabase, React Router, lucide-react

---

## Task 1: Prominent Share Button

**Files:**
- Modify: `src/pages/BoardPage.tsx:209-232` (board header section)
- Modify: `src/components/Board/FacilitatorToolbar.tsx:98-108` (remove share button)

**Step 1: Add share button to BoardPage header**

In `src/pages/BoardPage.tsx`, add a `useState` for the copied feedback and a share button in the board header. Add to the imports at line 1:

```tsx
import { useEffect, useState, useCallback } from 'react';
```

Already has `useState`. Add `Link2, Check` to a new import:

```tsx
import { Link2, Check } from 'lucide-react';
```

Add state after line 49:

```tsx
const [linkCopied, setLinkCopied] = useState(false);
```

Add handler after the `handleExportCsv` callback (after line 153):

```tsx
const handleCopyLink = useCallback(async () => {
  await navigator.clipboard.writeText(window.location.href);
  setLinkCopied(true);
  setTimeout(() => setLinkCopied(false), 2000);
}, []);
```

Replace the board header `<div>` at lines 219-229 with:

```tsx
<div className="flex items-center gap-3">
  <button
    onClick={handleCopyLink}
    className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-1.5 text-sm text-[var(--color-gray-6)] transition-colors hover:border-[var(--color-gray-3)] hover:text-[var(--color-gray-8)]"
  >
    {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
    {linkCopied ? 'Copied!' : 'Share'}
  </button>
  {isJoined && timer.status !== 'idle' && (
    <TimerDisplay timer={timer} />
  )}
  {isJoined && board.settings.voting_enabled && (
    <VoteStatus
      votesUsed={votes.filter((v) => v.voter_id === currentParticipantId).length}
      maxVotes={board.settings.max_votes_per_participant}
    />
  )}
</div>
```

**Step 2: Remove share button from FacilitatorToolbar**

In `src/components/Board/FacilitatorToolbar.tsx`:

- Remove `Share2` from the lucide-react import at line 1
- Delete lines 37-40 (the `handleCopyLink` function)
- Delete lines 98-108 (the divider and share button)
- Remove `boardId` from the props interface (line 9) and destructured params (line 23)

**Step 3: Remove boardId prop from BoardPage**

In `src/pages/BoardPage.tsx`, remove `boardId={board.id}` from the `<FacilitatorToolbar>` usage at line 196.

**Step 4: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

**Step 5: Commit**

```bash
git add src/pages/BoardPage.tsx src/components/Board/FacilitatorToolbar.tsx
git commit -m "feat: move share button to board header for all participants"
```

---

## Task 2: Complete Retro (Read-only Mode)

**Files:**
- Modify: `src/stores/boardStore.ts:8-48` (add `completeBoard` method)
- Modify: `src/components/Board/FacilitatorToolbar.tsx` (add Complete Retro button)
- Modify: `src/pages/BoardPage.tsx` (add completed badge, pass `isCompleted` flag down)
- Modify: `src/components/Board/BoardColumn.tsx` (respect `isCompleted`)
- Modify: `src/components/Board/RetroCard.tsx` (hide edit/delete/vote when completed)
- Modify: `src/components/ActionItems/ActionItemsPanel.tsx` (read-only when completed)

### Step 1: Add `completeBoard` to the store

In `src/stores/boardStore.ts`, add to the `BoardState` interface (after line 23):

```tsx
completeBoard: () => Promise<void>;
```

Add the implementation after the `updateSettings` method (after line 148):

```tsx
completeBoard: async () => {
  const { board } = get();
  if (!board) return;

  const archivedAt = new Date().toISOString();
  const { error } = await supabase
    .from('boards')
    .update({
      archived_at: archivedAt,
      settings: { ...board.settings, card_visibility: 'visible', board_locked: true },
    })
    .eq('id', board.id);

  if (error) throw error;

  set({
    board: {
      ...board,
      archived_at: archivedAt,
      settings: { ...board.settings, card_visibility: 'visible', board_locked: true },
    },
  });
},
```

### Step 2: Add Complete Retro button to FacilitatorToolbar

In `src/components/Board/FacilitatorToolbar.tsx`:

Add `CheckCircle2` to the lucide-react import.

Add new props to the interface:

```tsx
isCompleted: boolean;
onCompleteRetro: () => void;
```

Add these to the destructured params.

Before the divider (the `<div className="mx-1 h-6 w-px ...` line), add:

```tsx
{/* Complete Retro */}
{!isCompleted && (
  <ToolbarButton
    icon={CheckCircle2}
    label="Complete Retro"
    onClick={onCompleteRetro}
  />
)}
```

When `isCompleted` is true, hide all toolbar controls except participant count. Wrap the existing toolbar buttons (reveal, lock, voting, secret voting, timer, action items, complete retro) in:

```tsx
{!isCompleted && (
  <>
    {/* ...existing buttons... */}
  </>
)}
```

Keep the divider and participant count visible always.

### Step 3: Add confirmation modal and completed badge to BoardPage

In `src/pages/BoardPage.tsx`:

Add state:

```tsx
const [showCompleteModal, setShowCompleteModal] = useState(false);
```

Destructure `completeBoard` from `useBoardStore`.

Add handler:

```tsx
const handleCompleteRetro = useCallback(async () => {
  await completeBoard();
  setShowCompleteModal(false);
}, [completeBoard]);
```

Derive `isCompleted`:

```tsx
const isCompleted = !!board.archived_at;
```

Add a "Completed" badge next to the board title:

```tsx
<h2 className="text-xl text-[var(--color-gray-8)]">
  {board.title}
  {isCompleted && (
    <span className="ml-2 inline-flex items-center rounded-[var(--radius-full)] bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
      Completed
    </span>
  )}
</h2>
```

Pass `isCompleted` and `onCompleteRetro={() => setShowCompleteModal(true)}` to `FacilitatorToolbar`.

Pass `isCompleted` to `BoardColumn`.

Add the confirmation modal:

```tsx
<Modal
  open={showCompleteModal}
  onClose={() => setShowCompleteModal(false)}
  title="Complete Retrospective"
>
  <div className="flex flex-col gap-4">
    <p className="text-[var(--color-gray-5)]">
      The board will become read-only. This cannot be undone.
    </p>
    <div className="flex justify-end gap-3">
      <Button variant="ghost" onClick={() => setShowCompleteModal(false)}>
        Cancel
      </Button>
      <Button onClick={handleCompleteRetro}>
        Complete
      </Button>
    </div>
  </div>
</Modal>
```

Pass `isCompleted` to `ActionItemsPanel` as a new `readOnly` prop.

### Step 4: Make BoardColumn respect `isCompleted`

In `src/components/Board/BoardColumn.tsx`:

Add `isCompleted` boolean to `BoardColumnProps`.

Pass `isCompleted` to `RetroCard`.

When `isCompleted`, pass `disabled={true}` to `AddCardForm` (or the existing `cardCreationDisabled` already handles this since we set `board_locked: true` in the store).

### Step 5: Make RetroCard respect `isCompleted`

In `src/components/Board/RetroCard.tsx`:

Add `isCompleted?: boolean` to `RetroCardProps`.

When `isCompleted` is true:
- Hide the edit/delete buttons (the `isAuthor && (...)` block)
- Hide the vote button (the `votingEnabled && (...)` block)

Simplest approach: replace `isAuthor` check with `isAuthor && !isCompleted` and `votingEnabled` with `votingEnabled && !isCompleted`.

### Step 6: Make ActionItemsPanel read-only when completed

In `src/components/ActionItems/ActionItemsPanel.tsx`:

Add `readOnly?: boolean` to `ActionItemsPanelProps`.

When `readOnly` is true:
- Hide the add item form (lines 77-94)
- Pass `readOnly` to `ActionItemRow` to hide edit/delete controls

### Step 7: Verify the app builds

Run: `npm run build`
Expected: Build succeeds.

### Step 8: Commit

```bash
git add src/stores/boardStore.ts src/components/Board/FacilitatorToolbar.tsx src/pages/BoardPage.tsx src/components/Board/BoardColumn.tsx src/components/Board/RetroCard.tsx src/components/ActionItems/ActionItemsPanel.tsx
git commit -m "feat: add complete retro with read-only mode and completed badge"
```

---

## Task 3: Card Color Picker

**Files:**
- Create: `src/components/Board/CardColorPicker.tsx`
- Modify: `src/components/Board/RetroCard.tsx` (add color trigger + apply background)
- Modify: `src/components/Board/index.ts` (export new component)
- Modify: `src/stores/boardStore.ts:254-263` (update `updateCard` to accept color)
- Modify: `src/components/Board/BoardColumn.tsx` (pass `onUpdateCardColor` callback)
- Modify: `src/pages/BoardPage.tsx` (add `updateCardColor` handler)

### Step 1: Update the store's updateCard to accept partial updates

In `src/stores/boardStore.ts`, change the `updateCard` signature and implementation.

Current (line 35):
```tsx
updateCard: (cardId: string, text: string) => Promise<void>;
```

Change to:
```tsx
updateCard: (cardId: string, updates: Partial<Pick<Card, 'text' | 'color'>>) => Promise<void>;
```

Update the implementation (lines 254-263):
```tsx
updateCard: async (cardId, updates) => {
  const { error } = await supabase.from('cards').update(updates).eq('id', cardId);
  if (error) throw error;

  set((state) => ({
    cards: state.cards.map((c) =>
      c.id === cardId ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
    ),
  }));
},
```

### Step 2: Update all existing callers of `updateCard`

In `src/pages/BoardPage.tsx`, the `updateCard` is passed directly to `BoardColumn`. The call site in `RetroCard` calls `onUpdate(id, trimmed)` which passes `(cardId, text)`. Update `RetroCard`'s `handleSave`:

```tsx
const handleSave = () => {
  const trimmed = editText.trim();
  if (trimmed && trimmed !== text) {
    onUpdate(id, { text: trimmed });
  }
  setIsEditing(false);
};
```

Update `RetroCardProps.onUpdate`:
```tsx
onUpdate: (cardId: string, updates: Partial<{ text: string; color: string | null }>) => void;
```

Update `BoardColumn` to match:
```tsx
onUpdateCard: (cardId: string, updates: Partial<{ text: string; color: string | null }>) => void;
```

### Step 3: Create CardColorPicker component

Create `src/components/Board/CardColorPicker.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import { Palette, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { CARD_COLORS } from '@/utils/constants';

interface CardColorPickerProps {
  currentColor: string | null;
  onSelectColor: (color: string | null) => void;
}

export function CardColorPicker({ currentColor, onSelectColor }: CardColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-[var(--radius-sm)] p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]"
        aria-label="Change card color"
      >
        <Palette size={12} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-10 mt-1 flex gap-1 rounded-[var(--radius-md)] border border-[var(--color-gray-1)] bg-white p-2 shadow-lg">
          {CARD_COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => {
                onSelectColor(c.value);
                setIsOpen(false);
              }}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                currentColor === c.value
                  ? 'border-[var(--color-navy)]'
                  : 'border-[var(--color-gray-2)]'
              )}
              style={{ backgroundColor: c.value || '#ffffff' }}
              title={c.name}
              aria-label={`Set color to ${c.name}`}
            >
              {c.value === null && (
                <X size={14} className="mx-auto text-[var(--color-gray-4)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 4: Add CardColorPicker to RetroCard

In `src/components/Board/RetroCard.tsx`:

Import the component:
```tsx
import { CardColorPicker } from './CardColorPicker';
```

In the author actions section (the `isAuthor && (...)` block at line 140), add the color picker before the edit button:

```tsx
{isAuthor && !isCompleted && (
  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
    <CardColorPicker
      currentColor={color}
      onSelectColor={(newColor) => onUpdate(id, { color: newColor })}
    />
    <button
      onClick={() => { setEditText(text); setIsEditing(true); }}
      ...
    />
    <button onClick={() => onDelete(id)} ... />
  </div>
)}
```

### Step 5: Export CardColorPicker

In `src/components/Board/index.ts`, add:
```tsx
export { CardColorPicker } from './CardColorPicker';
```

### Step 6: Verify the app builds

Run: `npm run build`
Expected: Build succeeds.

### Step 7: Commit

```bash
git add src/components/Board/CardColorPicker.tsx src/components/Board/RetroCard.tsx src/components/Board/index.ts src/stores/boardStore.ts src/components/Board/BoardColumn.tsx src/pages/BoardPage.tsx
git commit -m "feat: add card color picker with 7-color palette"
```

---

## Task 4: Multiple Board Views

This is the largest task, broken into sub-tasks.

**Files:**
- Create: `src/components/Board/ViewToggle.tsx`
- Create: `src/components/Board/SwimlaneView.tsx`
- Create: `src/components/Board/ListView.tsx`
- Create: `src/components/Board/TimelineView.tsx`
- Modify: `src/pages/BoardPage.tsx` (add view toggle and conditional rendering)
- Modify: `src/components/Board/index.ts` (export new components)
- Modify: `src/types/index.ts` (add BoardView type)

### Step 1: Add BoardView type

In `src/types/index.ts`, add after the `BoardTemplate` type (after line 18):

```tsx
export type BoardView = 'grid' | 'swimlane' | 'list' | 'timeline';
export type SwimlaneGroupBy = 'author' | 'votes' | 'time';
```

### Step 2: Create ViewToggle component

Create `src/components/Board/ViewToggle.tsx`:

```tsx
import { LayoutGrid, Rows3, List, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { BoardView } from '@/types';

interface ViewToggleProps {
  currentView: BoardView;
  onChangeView: (view: BoardView) => void;
}

const views: { id: BoardView; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { id: 'grid', icon: LayoutGrid, label: 'Grid' },
  { id: 'swimlane', icon: Rows3, label: 'Swimlane' },
  { id: 'list', icon: List, label: 'List' },
  { id: 'timeline', icon: Clock, label: 'Timeline' },
];

export function ViewToggle({ currentView, onChangeView }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-white p-0.5">
      {views.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChangeView(id)}
          className={cn(
            'flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm transition-colors',
            currentView === id
              ? 'bg-[var(--color-navy)] text-white'
              : 'text-[var(--color-gray-5)] hover:text-[var(--color-gray-7)]'
          )}
          title={label}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
```

### Step 3: Create SwimlaneView component

Create `src/components/Board/SwimlaneView.tsx`:

```tsx
import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { RetroCard } from './RetroCard';
import type { Column, Card, Vote, Participant, SwimlaneGroupBy } from '@/types';

interface SwimlaneViewProps {
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  participants: Participant[];
  currentParticipantId: string | null;
  isObscured: boolean;
  isCompleted: boolean;
  votingEnabled: boolean;
  secretVoting: boolean;
  maxVotesPerParticipant: number;
  boardCreatedAt: string;
  onUpdateCard: (cardId: string, updates: Partial<{ text: string; color: string | null }>) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
}

export function SwimlaneView({
  columns,
  cards,
  votes,
  participants,
  currentParticipantId,
  isObscured,
  isCompleted,
  votingEnabled,
  secretVoting,
  maxVotesPerParticipant,
  boardCreatedAt,
  onUpdateCard,
  onDeleteCard,
  onToggleVote,
}: SwimlaneViewProps) {
  const [groupBy, setGroupBy] = useState<SwimlaneGroupBy>('author');
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns]
  );

  const voteLimitReached = useMemo(() => {
    if (!currentParticipantId) return false;
    const myVoteCount = votes.filter((v) => v.voter_id === currentParticipantId).length;
    return myVoteCount >= maxVotesPerParticipant;
  }, [votes, currentParticipantId, maxVotesPerParticipant]);

  const rows = useMemo(() => {
    if (groupBy === 'author') {
      const authorMap = new Map<string, { label: string; cards: Card[] }>();
      for (const card of cards) {
        const key = card.author_id;
        if (!authorMap.has(key)) {
          authorMap.set(key, { label: card.author_name, cards: [] });
        }
        authorMap.get(key)!.cards.push(card);
      }
      return Array.from(authorMap.entries()).map(([key, val]) => ({
        id: key,
        label: val.label,
        cards: val.cards,
      }));
    }

    if (groupBy === 'votes') {
      const getVoteCount = (card: Card) =>
        votes.filter((v) => v.card_id === card.id).length;
      return [
        { id: 'high', label: 'High votes (3+)', cards: cards.filter((c) => getVoteCount(c) >= 3) },
        { id: 'some', label: 'Some votes (1-2)', cards: cards.filter((c) => { const v = getVoteCount(c); return v >= 1 && v < 3; }) },
        { id: 'none', label: 'No votes', cards: cards.filter((c) => getVoteCount(c) === 0) },
      ].filter((r) => r.cards.length > 0);
    }

    // groupBy === 'time'
    const boardStart = new Date(boardCreatedAt).getTime();
    return [
      { id: 'first5', label: 'First 5 min', cards: cards.filter((c) => (new Date(c.created_at).getTime() - boardStart) < 5 * 60 * 1000) },
      { id: '5to10', label: '5-10 min', cards: cards.filter((c) => { const d = new Date(c.created_at).getTime() - boardStart; return d >= 5 * 60 * 1000 && d < 10 * 60 * 1000; }) },
      { id: '10plus', label: '10+ min', cards: cards.filter((c) => (new Date(c.created_at).getTime() - boardStart) >= 10 * 60 * 1000) },
    ].filter((r) => r.cards.length > 0);
  }, [groupBy, cards, votes, boardCreatedAt]);

  const toggleRow = (rowId: string) => {
    setCollapsedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Group-by selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--color-gray-5)]">Group by:</span>
        {(['author', 'votes', 'time'] as SwimlaneGroupBy[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={cn(
              'rounded-[var(--radius-md)] px-2.5 py-1 text-sm transition-colors',
              groupBy === g
                ? 'bg-[var(--color-navy)]/10 text-[var(--color-navy)] font-medium'
                : 'text-[var(--color-gray-5)] hover:text-[var(--color-gray-7)]'
            )}
          >
            {g === 'author' ? 'Author' : g === 'votes' ? 'Votes' : 'Time'}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `200px repeat(${sortedColumns.length}, minmax(200px, 1fr))` }}>
        <div />
        {sortedColumns.map((col) => (
          <div key={col.id} className="flex items-center gap-2 px-2 py-1">
            <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
            <span className="text-sm font-semibold text-[var(--color-gray-8)]">{col.title}</span>
          </div>
        ))}
      </div>

      {/* Swimlane rows */}
      {rows.map((row) => (
        <div key={row.id} className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-white/80">
          <button
            onClick={() => toggleRow(row.id)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-[var(--color-gray-7)] hover:bg-[var(--color-gray-1)]/50"
          >
            {collapsedRows.has(row.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            {row.label}
            <span className="text-xs text-[var(--color-gray-4)]">({row.cards.length})</span>
          </button>

          {!collapsedRows.has(row.id) && (
            <div
              className="grid gap-2 border-t border-[var(--color-gray-1)] p-3"
              style={{ gridTemplateColumns: `200px repeat(${sortedColumns.length}, minmax(200px, 1fr))` }}
            >
              <div />
              {sortedColumns.map((col) => {
                const colCards = row.cards
                  .filter((c) => c.column_id === col.id)
                  .sort((a, b) => a.position - b.position);
                return (
                  <div key={col.id} className="flex flex-col gap-2">
                    {colCards.map((card) => {
                      const cardVotes = votes.filter((v) => v.card_id === card.id);
                      const hasVoted = cardVotes.some((v) => v.voter_id === currentParticipantId);
                      return (
                        <RetroCard
                          key={card.id}
                          id={card.id}
                          text={card.text}
                          authorName={card.author_name}
                          authorId={card.author_id}
                          color={card.color}
                          voteCount={cardVotes.length}
                          hasVoted={hasVoted}
                          isAuthor={card.author_id === currentParticipantId}
                          isObscured={isObscured}
                          isCompleted={isCompleted}
                          votingEnabled={votingEnabled}
                          secretVoting={secretVoting}
                          voteLimitReached={voteLimitReached}
                          onUpdate={onUpdateCard}
                          onDelete={onDeleteCard}
                          onToggleVote={onToggleVote}
                        />
                      );
                    })}
                    {colCards.length === 0 && (
                      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-gray-2)] p-3 text-center text-xs text-[var(--color-gray-3)]">
                        —
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Step 4: Create ListView component

Create `src/components/Board/ListView.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Column, Card, Vote } from '@/types';

interface ListViewProps {
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  isCompleted: boolean;
  votingEnabled: boolean;
  onToggleVote: (cardId: string) => void;
}

type SortKey = 'column' | 'text' | 'author' | 'votes';
type SortDir = 'asc' | 'desc';

export function ListView({
  columns,
  cards,
  votes,
  currentParticipantId,
  isObscured,
  isCompleted,
  votingEnabled,
  onToggleVote,
}: ListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('column');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const columnMap = useMemo(
    () => new Map(columns.map((c) => [c.id, c])),
    [columns]
  );

  const getVoteCount = (cardId: string) =>
    votes.filter((v) => v.card_id === cardId).length;

  const sortedCards = useMemo(() => {
    const sorted = [...cards].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'column': {
          const colA = columnMap.get(a.column_id);
          const colB = columnMap.get(b.column_id);
          cmp = (colA?.position ?? 0) - (colB?.position ?? 0);
          break;
        }
        case 'text':
          cmp = a.text.localeCompare(b.text);
          break;
        case 'author':
          cmp = a.author_name.localeCompare(b.author_name);
          break;
        case 'votes':
          cmp = getVoteCount(a.id) - getVoteCount(b.id);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [cards, sortKey, sortDir, columnMap, votes]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ label, sortKeyId }: { label: string; sortKeyId: SortKey }) => (
    <button
      onClick={() => handleSort(sortKeyId)}
      className={cn(
        'flex items-center gap-1 text-xs font-semibold uppercase tracking-wider',
        sortKey === sortKeyId ? 'text-[var(--color-navy)]' : 'text-[var(--color-gray-5)]'
      )}
    >
      {label}
      <ArrowUpDown size={12} />
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-gray-1)] bg-[var(--color-gray-1)]/30">
            <th className="px-4 py-3 text-left"><SortHeader label="Column" sortKeyId="column" /></th>
            <th className="px-4 py-3 text-left"><SortHeader label="Card" sortKeyId="text" /></th>
            <th className="px-4 py-3 text-left"><SortHeader label="Author" sortKeyId="author" /></th>
            {votingEnabled && (
              <th className="px-4 py-3 text-left"><SortHeader label="Votes" sortKeyId="votes" /></th>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedCards.map((card) => {
            const col = columnMap.get(card.column_id);
            const voteCount = getVoteCount(card.id);
            const shouldBlur = isObscured && card.author_id !== currentParticipantId;

            return (
              <tr
                key={card.id}
                className="border-b border-[var(--color-gray-1)] last:border-b-0 hover:bg-[var(--color-gray-1)]/20"
                style={{ backgroundColor: card.color || undefined }}
              >
                <td className="px-4 py-3">
                  {col && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: col.color }}
                    >
                      {col.title}
                    </span>
                  )}
                </td>
                <td className={cn('px-4 py-3 text-sm text-[var(--color-gray-8)]', shouldBlur && 'blur-sm select-none')}>
                  {card.text}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-gray-5)]">{card.author_name}</td>
                {votingEnabled && (
                  <td className="px-4 py-3 text-sm text-[var(--color-gray-6)]">{voteCount}</td>
                )}
              </tr>
            );
          })}
          {sortedCards.length === 0 && (
            <tr>
              <td colSpan={votingEnabled ? 4 : 3} className="px-4 py-8 text-center text-sm text-[var(--color-gray-4)]">
                No cards yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

### Step 5: Create TimelineView component

Create `src/components/Board/TimelineView.tsx`:

```tsx
import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import type { Column, Card, Vote } from '@/types';

interface TimelineViewProps {
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  isCompleted: boolean;
  votingEnabled: boolean;
}

export function TimelineView({
  columns,
  cards,
  votes,
  currentParticipantId,
  isObscured,
  votingEnabled,
}: TimelineViewProps) {
  const columnMap = useMemo(
    () => new Map(columns.map((c) => [c.id, c])),
    [columns]
  );

  const groups = useMemo(() => {
    const sorted = [...cards].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const result: { time: string; cards: Card[] }[] = [];
    for (const card of sorted) {
      const cardTime = new Date(card.created_at);
      const timeLabel = cardTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const lastGroup = result[result.length - 1];
      if (
        lastGroup &&
        Math.abs(cardTime.getTime() - new Date(lastGroup.cards[0].created_at).getTime()) < 60 * 1000
      ) {
        lastGroup.cards.push(card);
      } else {
        result.push({ time: timeLabel, cards: [card] });
      }
    }
    return result;
  }, [cards]);

  const getVoteCount = (cardId: string) =>
    votes.filter((v) => v.card_id === cardId).length;

  return (
    <div className="relative flex flex-col gap-0 pl-8">
      {/* Timeline line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-[var(--color-gray-2)]" />

      {groups.map((group, i) => (
        <div key={i} className="relative pb-6">
          {/* Timeline dot */}
          <div className="absolute left-[-21px] top-1 h-3 w-3 rounded-full border-2 border-[var(--color-navy)] bg-white" />

          {/* Timestamp */}
          <div className="mb-2 text-xs font-medium text-[var(--color-gray-4)]">{group.time}</div>

          {/* Cards in this time cluster */}
          <div className="flex flex-col gap-2">
            {group.cards.map((card) => {
              const col = columnMap.get(card.column_id);
              const voteCount = getVoteCount(card.id);
              const shouldBlur = isObscured && card.author_id !== currentParticipantId;

              return (
                <div
                  key={card.id}
                  className={cn(
                    'rounded-[var(--radius-md)] border border-[var(--color-gray-1)] bg-white p-3 shadow-sm',
                    shouldBlur && 'blur-sm select-none'
                  )}
                  style={{ backgroundColor: card.color || undefined }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-[var(--color-gray-8)]">{card.text}</p>
                    {col && (
                      <span
                        className="shrink-0 inline-flex rounded-[var(--radius-full)] px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: col.color }}
                      >
                        {col.title}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-gray-4)]">
                    <span>{card.author_name}</span>
                    {votingEnabled && voteCount > 0 && (
                      <span className="font-medium text-[var(--color-navy)]">{voteCount} vote{voteCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <div className="py-8 text-center text-sm text-[var(--color-gray-4)]">No cards yet</div>
      )}
    </div>
  );
}
```

### Step 6: Export new components

In `src/components/Board/index.ts`, add:

```tsx
export { ViewToggle } from './ViewToggle';
export { SwimlaneView } from './SwimlaneView';
export { ListView } from './ListView';
export { TimelineView } from './TimelineView';
```

### Step 7: Integrate views into BoardPage

In `src/pages/BoardPage.tsx`:

Add imports:
```tsx
import { useSearchParams } from 'react-router-dom';
import { ViewToggle, SwimlaneView, ListView, TimelineView } from '@/components/Board';
import type { BoardView } from '@/types';
```

Note: `useSearchParams` is from react-router-dom (already imported).

Add view state from URL:
```tsx
const [searchParams, setSearchParams] = useSearchParams();
const currentView = (searchParams.get('view') as BoardView) || 'grid';

const handleChangeView = useCallback((view: BoardView) => {
  setSearchParams(view === 'grid' ? {} : { view });
}, [setSearchParams]);
```

Add the ViewToggle between the board header and the board content area (after line 232, before the board columns `<div>`):

```tsx
{isJoined && (
  <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6">
    <ViewToggle currentView={currentView} onChangeView={handleChangeView} />
  </div>
)}
```

Replace the board columns section (lines 234-286) with conditional rendering:

```tsx
<div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
  {isJoined ? (
    columns.length > 0 ? (
      <>
        {currentView === 'grid' && (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(280px, 1fr))` }}>
              {[...columns].sort((a, b) => a.position - b.position).map((col) => (
                <BoardColumn key={col.id} column={col} cards={cards.filter((c) => c.column_id === col.id)} votes={votes} currentParticipantId={currentParticipantId} isObscured={isObscured} isCompleted={isCompleted} votingEnabled={board.settings.voting_enabled} secretVoting={board.settings.secret_voting} cardCreationDisabled={board.settings.card_creation_disabled || board.settings.board_locked} maxVotesPerParticipant={board.settings.max_votes_per_participant} onAddCard={handleAddCard} onUpdateCard={updateCard} onDeleteCard={deleteCard} onToggleVote={toggleVote} />
              ))}
            </div>
          </DndContext>
        )}
        {currentView === 'swimlane' && (
          <SwimlaneView columns={columns} cards={cards} votes={votes} participants={participants} currentParticipantId={currentParticipantId} isObscured={isObscured} isCompleted={isCompleted} votingEnabled={board.settings.voting_enabled} secretVoting={board.settings.secret_voting} maxVotesPerParticipant={board.settings.max_votes_per_participant} boardCreatedAt={board.created_at} onUpdateCard={updateCard} onDeleteCard={deleteCard} onToggleVote={toggleVote} />
        )}
        {currentView === 'list' && (
          <ListView columns={columns} cards={cards} votes={votes} currentParticipantId={currentParticipantId} isObscured={isObscured} isCompleted={isCompleted} votingEnabled={board.settings.voting_enabled} onToggleVote={toggleVote} />
        )}
        {currentView === 'timeline' && (
          <TimelineView columns={columns} cards={cards} votes={votes} currentParticipantId={currentParticipantId} isObscured={isObscured} isCompleted={isCompleted} votingEnabled={board.settings.voting_enabled} />
        )}
      </>
    ) : (
      <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-gray-2)] bg-white/50 p-12 text-center">
        <p className="text-lg font-medium text-[var(--color-gray-5)]">No columns yet</p>
        <p className="mt-2 text-sm text-[var(--color-gray-4)]">The board admin can add columns to get started.</p>
      </div>
    )
  ) : (
    <div className="py-12 text-center">
      <p className="text-[var(--color-gray-5)]">Join the board to participate</p>
    </div>
  )}
</div>
```

### Step 8: Verify the app builds

Run: `npm run build`
Expected: Build succeeds.

### Step 9: Commit

```bash
git add src/types/index.ts src/components/Board/ViewToggle.tsx src/components/Board/SwimlaneView.tsx src/components/Board/ListView.tsx src/components/Board/TimelineView.tsx src/components/Board/index.ts src/pages/BoardPage.tsx
git commit -m "feat: add multiple board views (grid, swimlane, list, timeline)"
```

---

## Task 5: Final Verification

### Step 1: Run full build

Run: `npm run build`
Expected: Build succeeds with zero errors.

### Step 2: Run lint

Run: `npm run lint`
Expected: No lint errors.

### Step 3: Manual smoke test

Start dev server (`npm run dev`) and verify:
1. Share button visible in board header, copies URL, shows "Copied!" feedback
2. Complete Retro button in toolbar, confirmation modal, read-only state with badge
3. Color picker on card hover (author only), colors apply, persist on reload
4. View toggle switches between Grid, Swimlane, List, Timeline
5. URL updates with `?view=` param
6. Swimlane group-by toggle works (author/votes/time)
7. List view sorts by clicking column headers
8. Timeline shows cards chronologically with time clusters

### Step 4: Commit any fixes

If any issues found, fix and commit with descriptive message.
