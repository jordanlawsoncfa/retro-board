# Board History Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sidebar panel on the home page showing recently visited boards, tracked via localStorage.

**Architecture:** A `boardHistory` utility module handles localStorage read/write/clear. The boardStore calls these helpers on create, fetch, and complete. A new `BoardHistorySidebar` component renders the list on the home page.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, localStorage

**Design doc:** `docs/plans/2026-02-27-board-history-sidebar-design.md`

---

### Task 1: Add BoardHistoryEntry type

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add the interface**

Append to the end of `src/types/index.ts` (after the `TemplateDefinition` interface, around line 109):

```typescript
// Board history (localStorage)
export interface BoardHistoryEntry {
  boardId: string;
  title: string;
  createdAt: string;
  lastVisited: string;
  isCompleted: boolean;
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add BoardHistoryEntry type"
```

---

### Task 2: Create boardHistory utility module

**Files:**
- Create: `src/utils/boardHistory.ts`
- Modify: `src/utils/index.ts` (add export)

**Step 1: Create the utility**

Create `src/utils/boardHistory.ts` with these functions:

```typescript
import type { BoardHistoryEntry } from '@/types';

const STORAGE_KEY = 'retro-board-history';
const MAX_ENTRIES = 50;

export function getBoardHistory(): BoardHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: BoardHistoryEntry[] = JSON.parse(raw);
    return entries.sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime());
  } catch {
    return [];
  }
}

export function saveBoardToHistory(entry: BoardHistoryEntry): void {
  try {
    const entries = getBoardHistory();
    const existingIndex = entries.findIndex((e) => e.boardId === entry.boardId);

    if (existingIndex >= 0) {
      entries[existingIndex] = { ...entries[existingIndex], ...entry };
    } else {
      entries.unshift(entry);
    }

    // Cap at MAX_ENTRIES, drop oldest
    const trimmed = entries
      .sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime())
      .slice(0, MAX_ENTRIES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function clearBoardHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}
```

**Step 2: Add export to barrel**

In `src/utils/index.ts`, add this line:

```typescript
export { getBoardHistory, saveBoardToHistory, clearBoardHistory } from './boardHistory';
```

**Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/utils/boardHistory.ts src/utils/index.ts
git commit -m "feat: add boardHistory localStorage utility"
```

---

### Task 3: Integrate history tracking into boardStore

**Files:**
- Modify: `src/stores/boardStore.ts`

Three integration points. The import and each call site:

**Step 1: Add import**

At the top of `src/stores/boardStore.ts`, add to the existing imports from `@/utils`:

```typescript
import { saveBoardToHistory } from '@/utils/boardHistory';
```

**Step 2: Track board creation**

In the `createBoard` method, just before the `return boardId;` line (around line 134), add:

```typescript
    saveBoardToHistory({
      boardId,
      title,
      createdAt: new Date().toISOString(),
      lastVisited: new Date().toISOString(),
      isCompleted: false,
    });
```

**Step 3: Track board fetch/join**

In the `fetchBoard` method, just before the closing `set({...})` call (around line 165, after `const stored = ...`), add:

```typescript
    saveBoardToHistory({
      boardId,
      title: board.title,
      createdAt: board.created_at,
      lastVisited: new Date().toISOString(),
      isCompleted: !!board.archived_at,
    });
```

**Step 4: Track board completion**

In the `completeBoard` method, after the `set({...})` call (around line 214, after the set block closes), add:

```typescript
    saveBoardToHistory({
      boardId: board.id,
      title: board.title,
      createdAt: board.created_at,
      lastVisited: new Date().toISOString(),
      isCompleted: true,
    });
```

**Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/stores/boardStore.ts
git commit -m "feat: track board visits in localStorage history"
```

---

### Task 4: Create BoardHistorySidebar component

**Files:**
- Create: `src/components/Board/BoardHistorySidebar.tsx`
- Modify: `src/components/Board/index.ts` (add export)

**Step 1: Create the component**

Create `src/components/Board/BoardHistorySidebar.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trash2 } from 'lucide-react';
import { getBoardHistory, clearBoardHistory } from '@/utils/boardHistory';
import type { BoardHistoryEntry } from '@/types';

function formatRelativeDate(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function BoardHistorySidebar() {
  const [entries, setEntries] = useState<BoardHistoryEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setEntries(getBoardHistory());
  }, []);

  if (entries.length === 0) return null;

  const handleClear = () => {
    clearBoardHistory();
    setEntries([]);
  };

  return (
    <div className="w-72 rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 text-[var(--color-gray-6)]">
        <Clock size={16} />
        <h3 className="text-sm font-semibold">Recent Boards</h3>
      </div>

      {/* List */}
      <div className="mt-3 flex max-h-80 flex-col gap-1 overflow-y-auto">
        {entries.map((entry) => (
          <button
            key={entry.boardId}
            onClick={() => navigate(`/board/${entry.boardId}`)}
            className="flex flex-col gap-1 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-gray-1)]"
          >
            <span className="text-sm font-medium text-[var(--color-gray-8)] truncate">
              {entry.title}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-gray-4)]">
                {formatRelativeDate(entry.lastVisited)}
              </span>
              <span
                className={`inline-flex rounded-[var(--radius-full)] px-1.5 py-0.5 text-[10px] font-medium ${
                  entry.isCompleted
                    ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                    : 'bg-[var(--color-gray-1)] text-[var(--color-gray-5)]'
                }`}
              >
                {entry.isCompleted ? 'Completed' : 'Active'}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 border-t border-[var(--color-gray-1)] pt-2">
        <button
          onClick={handleClear}
          className="flex items-center gap-1 text-xs text-[var(--color-gray-4)] transition-colors hover:text-[var(--color-gray-6)]"
        >
          <Trash2 size={12} />
          Clear history
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Add export to barrel**

In `src/components/Board/index.ts`, add:

```typescript
export { BoardHistorySidebar } from './BoardHistorySidebar';
```

**Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/Board/BoardHistorySidebar.tsx src/components/Board/index.ts
git commit -m "feat: add BoardHistorySidebar component"
```

---

### Task 5: Integrate sidebar into HomePage

**Files:**
- Modify: `src/pages/HomePage.tsx`

**Step 1: Update the home page layout**

Import the sidebar at the top of `src/pages/HomePage.tsx`:

```typescript
import { BoardHistorySidebar } from '@/components/Board';
```

Replace the outer layout `<div>` (the one with `flex min-h-[calc(100vh-4rem)] items-center justify-center`) with a two-panel flex layout. The full return JSX becomes:

```tsx
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 sm:px-6">
        <div className="flex items-center gap-12">
          {/* Hero */}
          <div className="text-center">
            <h1 className="text-[var(--color-gray-8)]">
              Run better retros with{' '}
              <span className="text-[var(--color-primary)]">{APP_NAME}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--color-gray-5)]">
              A real-time retrospective board for teams. Create columns, add cards,
              vote, and turn insights into action items — all in one place.
            </p>
            <div className="mt-8">
              <Button size="lg" onClick={() => setShowCreateModal(true)}>
                <Plus size={20} />
                Create a Retro Board
              </Button>
            </div>
          </div>

          {/* History sidebar */}
          <div className="hidden lg:block">
            <BoardHistorySidebar />
          </div>
        </div>
      </div>

      {/* Create Board Modal — unchanged */}
```

Key points:
- The sidebar is wrapped in `hidden lg:block` so it only shows on large viewports
- `gap-12` provides spacing between hero and sidebar
- `BoardHistorySidebar` returns `null` when empty, so the layout naturally centers just the hero when there's no history

**Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Visual verification**

Open `http://localhost:5173/`. Confirm:
- With no history: Hero is centered, no sidebar
- Create a board, navigate back to home: Sidebar appears on the right with the board listed
- Entry shows title, relative date, "Active" badge
- Clicking entry navigates to the board
- "Clear history" removes all entries and hides sidebar

**Step 4: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: integrate BoardHistorySidebar into HomePage"
```
