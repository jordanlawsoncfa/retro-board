# RetroBoard — Context Snapshot

**Date**: 2026-02-25
**Working Directory**: `/Users/jordan.lawson/Projects/retro-board`
**Git Status**: All files untracked (no commits yet in this repo — git history is from parent Harman's Desserts repo)
**Build Status**: `tsc --noEmit` and `vite build` both pass with zero errors
**Supabase**: Not yet connected — `.env.local` does not exist (only `.env.example`)

---

## What This Project Is

A real-time retrospective board web app for team retros. Participants join via shareable link (no account required), add sticky-note cards to columns, vote, and collaborate in real time. The facilitator can reveal/hide cards, lock the board, toggle voting, and run a synced timer.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2 |
| Language | TypeScript | 5.9 (strict mode) |
| Bundler | Vite | 7.3.1 |
| Styling | Tailwind CSS v4 | 4.2.1 (`@tailwindcss/vite` plugin) |
| Backend/DB | Supabase (PostgreSQL + Realtime + Auth) | supabase-js 2.97 |
| State | Zustand | 5.0 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | 6.3 / 10.0 |
| Routing | react-router-dom | 7.13 |
| IDs | nanoid | 5.1 |
| Icons | lucide-react | 0.575 |
| CSS Utilities | clsx + tailwind-merge | via `cn()` helper |

**Path alias**: `@/*` → `./src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`)

**Local `.npmrc`**: `registry=https://registry.npmjs.org/` (bypasses corporate JFrog registry)

---

## Brand Design Tokens

Defined in `src/styles/index.css` as both CSS custom properties and Tailwind `@theme` tokens.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#DD0031` (CFA Red) | Primary buttons, brand accent |
| `--color-navy` | `#004F71` | Secondary actions, focus rings, links |
| `--color-warm-white` | `#F4F1EC` | Page background |
| `--color-gray-1` through `--color-gray-8` | Grayscale ramp | Borders, text hierarchy |
| `--color-error` | `#B8072F` | Error states |
| `--color-success` | `#077E4C` | Success states |
| `--font-primary` | Apercu Std → Inter → system-ui | Headings, body text |
| `--font-secondary` | Rooney → Inter → system-ui | Subtitles (uppercase bold) |

Typography scale: H1 (48px) → H4 (20px), S1-S3 (subtitles), body/caption sizes.
Spacing: 8pt grid (`--space-1` through `--space-24`).
Shadows: `--shadow-sm` through `--shadow-xl`.

---

## Project Structure

```
src/
├── main.tsx                     # StrictMode entry, imports global CSS
├── App.tsx                      # BrowserRouter + Routes
├── styles/
│   └── index.css                # All design tokens + Tailwind @theme + base styles
├── types/
│   └── index.ts                 # Board, Column, Card, Vote, ActionItem, Participant, BoardSettings, TimerState
├── lib/
│   ├── supabase.ts              # Supabase client (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
│   └── audio.ts                 # Web Audio API timer ding (800/1200/1600 Hz sine waves)
├── utils/
│   ├── cn.ts                    # clsx + tailwind-merge
│   ├── constants.ts             # APP_NAME, DEFAULT_BOARD_SETTINGS, TIMER_PRESETS, COLUMN_COLORS, CARD_COLORS
│   ├── templates.ts             # 5 board templates (mad-sad-glad, liked-learned-lacked, etc.)
│   └── index.ts                 # Barrel export
├── stores/
│   └── boardStore.ts            # Zustand store — full CRUD + voting + realtime subscriptions
├── components/
│   ├── common/                  # Button, Input, Textarea, Modal, Badge
│   ├── Layout/                  # AppShell, Header
│   ├── Board/                   # BoardColumn, RetroCard, SortableCard, AddCardForm, FacilitatorToolbar
│   ├── ActionItems/             # (empty — Phase 5)
│   ├── Admin/                   # (empty — future)
│   ├── Timer/                   # (empty — Phase 4)
│   └── Voting/                  # (empty — future)
├── pages/
│   ├── HomePage.tsx             # Hero + create board modal
│   ├── BoardPage.tsx            # Full board view with DnD, columns, cards, facilitator toolbar
│   ├── NotFoundPage.tsx         # 404
│   └── index.ts                 # Barrel: HomePage, BoardPage, NotFoundPage
├── hooks/                       # (empty — auth hook was removed)
└── assets/                      # (empty)

supabase/
└── migrations/
    └── 001_initial_schema.sql   # 6 tables, indexes, RLS, realtime publication
```

---

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | HomePage | Hero section + "Create a Retro Board" button → opens Modal |
| `/board/:boardId` | BoardPage | Full board view. Prompts join modal if not yet a participant. |
| `*` | NotFoundPage | 404 page |

---

## Database Schema

**6 tables** in `001_initial_schema.sql`:

| Table | PK Type | Key Columns |
|-------|---------|-------------|
| `boards` | TEXT (nanoid) | title, description, template (CHECK constraint), created_by, settings (JSONB), archived_at |
| `columns` | TEXT (nanoid) | board_id FK, title, description, color, position |
| `participants` | TEXT (UUID string) | board_id FK, display_name, is_admin, joined_at, last_seen |
| `cards` | TEXT (nanoid) | column_id FK, board_id FK, text, author_name, author_id, color, position, merged_with |
| `votes` | UUID (auto) | card_id FK, board_id FK, voter_id, UNIQUE(card_id, voter_id) |
| `action_items` | UUID (auto) | board_id FK, description, assignee, due_date, status CHECK(open/in_progress/done) |

**Indexes**: 16 indexes covering all FKs, ordering columns, and partial indexes.
**Trigger**: `update_updated_at()` on cards table.
**RLS**: Enabled on all 6 tables with fully permissive policies (Phase 1 — no auth).
**Realtime**: boards, columns, cards, votes, participants added to `supabase_realtime` publication.

### BoardSettings JSONB Structure

```typescript
interface BoardSettings {
  card_visibility: 'hidden' | 'visible';    // cards blurred until revealed
  voting_enabled: boolean;
  max_votes_per_participant: number;         // default 5
  max_votes_per_column: number;              // default 99
  max_votes_per_card: number;                // default 3
  secret_voting: boolean;
  board_locked: boolean;                     // prevents all changes
  card_creation_disabled: boolean;
  anonymous_cards: boolean;
  highlighted_card_id: string | null;
  timer: TimerState;                         // { duration, remaining, status, started_at }
  revealed_columns: string[];                // column IDs that have been revealed
}
```

---

## Zustand Store (`boardStore.ts`)

### State

```
board, columns, cards, votes, actionItems, participants, loading, error, currentParticipantId
```

### Methods

| Method | Description |
|--------|-------------|
| `createBoard(title, description, template)` | Creates board + template columns. Returns boardId. Uses `crypto.randomUUID()` placeholder for `created_by`. |
| `fetchBoard(boardId)` | Loads board + columns + cards + votes + actionItems + participants. Restores `currentParticipantId` from sessionStorage. |
| `updateSettings(Partial<BoardSettings>)` | Merges settings update and persists to Supabase. |
| `joinBoard(boardId, displayName)` | Creates participant, stores ID in sessionStorage. |
| `addColumn(title, color, description?)` | Appends column to board. |
| `updateColumn(columnId, updates)` | Updates column title/color/description. |
| `deleteColumn(columnId)` | Deletes column and its cards from state. |
| `addCard(columnId, text)` | Creates card with current participant as author. |
| `updateCard(cardId, text)` | Inline edit. |
| `deleteCard(cardId)` | Removes card and its votes. |
| `moveCard(cardId, targetColumnId, newPosition)` | Optimistic update with rollback on failure. |
| `toggleVote(cardId)` | Add or remove vote. Enforces `max_votes_per_participant` and `max_votes_per_card` limits. |
| `subscribeToBoard(boardId)` | Supabase Realtime subscription for INSERT/UPDATE/DELETE on cards, columns, votes, participants, and board settings. Returns cleanup function. |
| `reset()` | Clears all state. |

---

## Component Inventory

### `common/` — Shared UI Primitives

| Component | Props | Notes |
|-----------|-------|-------|
| `Button` | variant (primary/secondary/ghost/danger), size (sm/md/lg), loading | forwardRef, SVG spinner |
| `Input` | label, error, all HTMLInput props | forwardRef, focus ring, error styling |
| `Textarea` | label, error, all HTMLTextarea props | forwardRef, min-height 80px |
| `Modal` | `open`, `onClose`, title, size (sm/md/lg), children | Escape to close, overlay click, body scroll lock, fade-in/scale-in animations |
| `Badge` | variant (default/success/warning/error/info) | Pill-shaped badge |

### `Layout/` — Page Shell

| Component | Props | Notes |
|-----------|-------|-------|
| `Header` | rightContent | Sticky, backdrop-blur, brand logo square (red with Layers icon) |
| `AppShell` | headerRight, children | Wraps Header + main, min-h-screen, warm-white bg |

### `Board/` — Core Board Components

| Component | Props | Notes |
|-----------|-------|-------|
| `BoardColumn` | column, cards, votes, currentParticipantId, isObscured, votingEnabled, cardCreationDisabled, onAddCard, onUpdateCard, onDeleteCard, onToggleVote | Uses @dnd-kit `useDroppable` + `SortableContext`. Shows column header with color dot, card count badge, description. |
| `RetroCard` | id, text, authorName, authorId, color, voteCount, hasVoted, isAuthor, isObscured, votingEnabled, onUpdate, onDelete, onToggleVote | Inline edit mode, blur when obscured (CSS `filter: blur(6px)`), vote button, edit/delete on hover for authors. |
| `SortableCard` | id, children | @dnd-kit `useSortable` wrapper. Handles transform, transition, drag opacity. |
| `AddCardForm` | onSubmit, disabled | Expandable: shows "Add a card" button → textarea. Enter to submit, Shift+Enter for newline, Escape to cancel. |
| `FacilitatorToolbar` | settings, participantCount, boardId, onUpdateSettings | Toggles: card visibility, board lock, voting. Participant count display. Copy share link button. Timer placeholder. |

---

## Pages

### HomePage

- Hero section with APP_NAME branding and tagline
- 4 feature cards (Flexible Templates, Card Obfuscation, Synced Timer, No Account Needed)
- "Create a Retro Board" button opens Modal with:
  - Title input (required)
  - Description textarea (optional)
  - Template selection grid (5 options with colored pills showing column names)
  - Calls `useBoardStore.createBoard()` → navigates to `/board/:boardId`

### BoardPage

- Fetches board data on mount via `fetchBoard(boardId)`
- Join modal appears if no `retro-pid-{boardId}` in sessionStorage
- After joining: subscribes to Supabase Realtime via `subscribeToBoard(boardId)`
- FacilitatorToolbar rendered in header right slot
- Columns rendered in CSS Grid (max 4 columns, min 280px each)
- Full DnD context wrapping all columns using `@dnd-kit/core` with `closestCorners` collision detection and `PointerSensor` (5px activation distance)
- Cards inside each column are sortable and can be moved between columns

---

## What's NOT Done Yet (Remaining Phases)

### Phase 3: Card Obfuscation + Voting Polish
- Card blur CSS is implemented (`filter: blur(6px)` on RetroCard when `isObscured && !isAuthor`)
- Facilitator reveal/hide toggle works (`card_visibility` setting)
- Still needed:
  - Per-column reveal (using `revealed_columns` array in settings)
  - Reveal animation (transition from blur to clear)
  - Vote count display on columns (not just cards)
  - Secret voting mode (hide who voted)
  - Visual feedback when vote limit is reached

### Phase 4: Timer
- `lib/audio.ts` has `playTimerDing()` ready (Web Audio API, 800/1200/1600 Hz)
- `TimerState` type defined in types (duration, remaining, status, started_at)
- `TIMER_PRESETS` defined (2/5/10 min)
- `src/components/Timer/` directory exists but is empty
- Still needed:
  - Timer UI component (countdown display, start/pause/reset)
  - Realtime timer sync via Supabase Broadcast channel (not Postgres Changes — ephemeral)
  - Timer ding sound when expired
  - Timer controls in FacilitatorToolbar (currently a placeholder button)

### Phase 5: Action Items + Export
- `action_items` table exists in schema
- `ActionItem` type defined
- `actionItems` array in store state (loaded by `fetchBoard`)
- `src/components/ActionItems/` directory exists but is empty
- Still needed:
  - Action item CRUD UI (add, edit, mark done, assign, set due date)
  - Export board to CSV/JSON/Markdown
  - Print-friendly view

### Phase 6: Responsive + Accessibility
- Still needed:
  - Mobile layout (horizontal scroll for columns or stacked view)
  - Touch-friendly card interactions
  - ARIA labels on all interactive elements
  - Keyboard navigation for cards and columns
  - Screen reader announcements for realtime changes
  - High contrast mode support

### Phase 7: Polish + Branding
- Still needed:
  - Loading skeletons for board/column/card states
  - Error boundaries
  - Toast notifications (add sonner dependency)
  - Animated transitions for card creation, deletion, and movement
  - Custom favicon and meta tags
  - Board archiving functionality
  - "My Boards" page for returning users

---

## Known Issues & Technical Debt

1. **No auth integration**: `createBoard` uses `crypto.randomUUID()` as a placeholder for `created_by`. In the future, this should use Supabase Auth user ID.

2. **No `.env.local` exists**: Supabase client will throw on startup until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Copy `.env.example` and fill in values.

3. **RLS policies are fully permissive**: All tables allow all operations for anyone with the anon key. Must tighten policies when auth is added.

4. **Vote UNIQUE constraint**: The DB has `UNIQUE(card_id, voter_id)` but the store's `toggleVote` allows multiple votes per card (up to `max_votes_per_card`). The DB constraint will reject the second vote. Either remove the DB constraint or change the vote model to allow stacking.

5. **Chunk size warning**: Vite build produces a 507 KB JS bundle. Consider code-splitting with dynamic imports if this grows.

6. **Empty directories**: `src/hooks/`, `src/assets/`, `src/components/ActionItems/`, `src/components/Admin/`, `src/components/Timer/`, `src/components/Voting/` are all empty placeholder directories.

7. **Stale CSS files**: `src/App.css` and `src/index.css` may still exist with "no longer used" comments (rm commands were blocked by permissions). Harmless but should be deleted.

8. **No git commits**: All retro-board files are untracked. An initial commit should be made.

---

## Skills Applied

Three skill files were loaded and applied throughout:
- `/Users/jordan.lawson/.claude/skills/frontend-ux-design/SKILL.md`
- `/Users/jordan.lawson/.claude/skills/full-stack-developer/SKILL.md`
- `/Users/jordan.lawson/.claude/skills/visual-design/SKILL.md`

---

## Quick Resume Instructions

To continue building in a new session:

1. **Read this file first**: `cat /Users/jordan.lawson/Projects/retro-board/CONTEXT_SNAPSHOT.md`
2. **Verify build**: `npx vite build` and `npx tsc -b --noEmit` (should both pass)
3. **Set up Supabase** (if not already done):
   - Create a Supabase project
   - Run `001_initial_schema.sql` against it
   - Copy `.env.example` → `.env.local` and fill in URL + anon key
4. **Make initial git commit** (nothing has been committed yet)
5. **Pick up from Phase 3** (card obfuscation polish, per-column reveal, vote UX)
6. **Reference the original spec** for full feature requirements — the user provided a highly detailed specification with 14 feature areas and a 7-phase plan
