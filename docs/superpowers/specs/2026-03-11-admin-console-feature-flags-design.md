# Admin Console & Feature Flags Design

**Date:** 2026-03-11
**Status:** Approved
**Author:** Jordan Lawson + Claude

## Problem

Supabase Realtime requires an upgraded micro Supabase instance and per-project subscription costs. Live events should be an optional, toggleable feature rather than a hard dependency. Additionally, the application lacks an admin console for managing global configuration.

## Solution

Add an admin console at `/admin/*` with Supabase Auth protection, featuring:
1. **Feature Flags** — toggle live events (and future features) on/off without code deploys
2. **Boards Management** — view, search, archive, delete, and export all boards
3. **Global Settings** — configure branding, default templates, default board settings, and board retention

When the `live_events` flag is disabled, the board falls back to 10-second polling instead of Supabase Realtime subscriptions.

## Architecture

### Approach

Single SPA — admin routes added to the existing React Router setup within the same Vite app. Admin pages are lazy-loaded to avoid bloating the main bundle. A `ProtectedRoute` wrapper checks Supabase Auth session before rendering admin pages.

### Route Structure

| Path | Component | Purpose |
|------|-----------|---------|
| `/admin/login` | `AdminLoginPage` | Email/password login |
| `/admin` | `AdminDashboardPage` | Stats overview (active boards, flags, completed count) |
| `/admin/features` | `AdminFeaturesPage` | Feature flag toggles |
| `/admin/boards` | `AdminBoardsPage` | Board list with filters, search, pagination |
| `/admin/settings` | `AdminSettingsPage` | Global app configuration |

All `/admin/*` routes except `/admin/login` are wrapped in `ProtectedRoute`.

### Layout

Sidebar layout (matching Harman's Desserts `AdminShell` pattern):
- Fixed left sidebar (dark background) with nav links: Dashboard, Feature Flags, Boards, Settings
- Current user email and sign-out at sidebar bottom
- "Back to App" link to return to the main retro board
- Main content area to the right

## Authentication

### Setup

- Supabase Auth enabled from scratch (email/password provider)
- No social providers, magic links, or self-registration
- Admin users created manually via Supabase Dashboard or a seed script

### Flow

1. User navigates to any `/admin/*` route
2. `ProtectedRoute` calls `supabase.auth.getSession()`
3. If no session → redirect to `/admin/login` with return URL
4. If session exists → verify user exists in `admin_users` table
5. If not in `admin_users` → redirect to `/admin/login` with error
6. If valid → render admin page inside `AdminShell` layout

Session persisted in `localStorage` by Supabase Auth. Admin stays logged in until explicit sign-out or token expiry.

### Separation from Board Auth

Board-facing routes (`/`, `/board/:id`) remain completely unauthenticated. The anonymous participant session model is unchanged.

## Database Schema

### New Tables

```sql
-- Admin users (references Supabase Auth)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feature flags
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App-wide settings (singleton — enforced by CHECK constraint)
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
    CHECK (id = '00000000-0000-0000-0000-000000000000'::uuid),
  default_template TEXT NOT NULL DEFAULT 'mad-sad-glad',
  default_board_settings JSONB NOT NULL DEFAULT '{
    "card_visibility": "hidden",
    "voting_enabled": false,
    "max_votes_per_participant": 5,
    "secret_voting": false,
    "board_locked": false,
    "card_creation_disabled": false,
    "anonymous_cards": false
  }'::jsonb,
  app_name TEXT NOT NULL DEFAULT 'RetroBoard',
  app_logo_url TEXT,
  board_retention_days INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS Policies

| Table | Anon Read | Auth Read | Auth Write |
|-------|-----------|-----------|------------|
| `feature_flags` | Yes (board app checks flags) | Yes | Admin only |
| `app_settings` | Yes (board app reads defaults) | Yes | Admin only |
| `admin_users` | No | Admin only | Admin only |

```sql
-- feature_flags: anyone can read, only admins can write
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_read" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "feature_flags_write" ON feature_flags FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- app_settings: anyone can read, only admins can write
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_write" ON app_settings FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- admin_users: only admins can read/write (bootstrap first user via service role)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users_access" ON admin_users FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_users));
```

**Bootstrap note:** The first admin user must be inserted using the Supabase service role key (Dashboard SQL editor or seed script), since no admin exists yet to satisfy the RLS policy.

### Seed Data

```sql
-- Initial feature flag
INSERT INTO feature_flags (key, name, description, is_enabled) VALUES
  ('live_events', 'Live Events (Realtime)',
   'Supabase Realtime subscriptions for live card, vote, and participant sync. When disabled, falls back to 10-second polling.',
   true);

-- Initial app settings (single row)
INSERT INTO app_settings (default_template) VALUES ('mad-sad-glad');
```

## Feature Flags

### Data Model

Each flag has: `key` (unique identifier), `name` (display label), `description`, `is_enabled` (boolean toggle), `updated_at`.

### UI

Card-style list showing each flag with:
- Name and enabled/disabled badge
- Description text
- Machine key (e.g., `live_events`)
- Last toggled timestamp
- Toggle switch

Info banner: "Feature flags take effect immediately for all new board sessions. Active boards will pick up changes on their next polling cycle or page refresh."

### Live Events Flag Behavior

The `live_events` flag controls all three Supabase Realtime channels:

**When ON (current behavior):**
- `board:{boardId}` — postgres_changes for cards, columns, votes, participants, action items, boards
- `presence:{boardId}` — online participant tracking
- `timer:{boardId}` — broadcast for timer sync

**When OFF (polling fallback):**
- 10-second polling interval refetches all board data via Supabase REST API
- `usePresence` hook called with a `liveSync` parameter — when `false`, the hook early-returns without creating a presence channel (React hooks cannot be conditionally called); static participant list rendered, no online indicator dots
- `useTimer` hook runs in local-only mode — accepts a `liveSync` parameter; when `false`, timer counts down locally but does not create a broadcast channel or sync across clients
- `ConnectionStatusBanner` shows "Polling mode" indicator (new `'polling'` variant added to `ConnectionStatus` type)

### Consumption Pattern

1. App startup → fetch `feature_flags` from Supabase → cache in `featureFlagStore` (Zustand)
2. `boardStore.subscribeToBoard()` checks `live_events` flag value
3. Conditional branch: realtime subscriptions OR polling interval
4. Flag changes picked up on next page load or poll cycle

## Polling Fallback

### New Hook: `usePolling`

```
usePolling(boardId: string, intervalMs: number)
```

Calls existing `fetchBoard()` store action on a 10-second interval. Replaces the three realtime channel subscriptions when `live_events` is disabled.

### What Changes in Polling Mode

| Feature | Realtime Mode | Polling Mode |
|---------|--------------|--------------|
| Card/vote/column sync | Instant | 10-second delay |
| Participant presence | Live online dots | Static list, no online indicators |
| Timer | Cross-client sync via broadcast | Local only, no sync |
| Connection banner | Connected/Disconnected/Reconnected | "Polling mode" badge |
| CRUD operations | Unchanged (Supabase REST) | Unchanged (Supabase REST) |
| Optimistic updates | Unchanged | Unchanged |
| Board completion | Unchanged | Unchanged |
| Facilitator controls | Unchanged | Unchanged |

## Boards Management

### UI

Data table with columns: Board (name + ID), Template, Participants count, Cards count, Created date, Status badge.

**Filters:** All / Active / Completed (with counts)
**Search:** Filter by board title
**Pagination:** Server-side, configurable page size

### Admin Actions

- **View** — open board in new tab (read-only for completed boards)
- **Archive/Complete** — force-complete an active board (sets `archived_at`)
- **Delete** — permanently remove board and all associated data (with confirmation modal)
- **Export** — download as Markdown or CSV (uses existing `src/utils/export.ts`)

No board creation from admin — boards are created by end users from the homepage.

## Global Settings

### Singleton Pattern

Single row in `app_settings` table. The admin settings page reads and updates this row.

### Sections

**Branding:**
- Application name (text input, default "RetroBoard")
- Logo URL (optional text input)

**Default Board Template:**
- Selectable chips for the 5 templates: Mad/Sad/Glad, Liked/Learned/Lacked, Start/Stop/Continue, Went Well/Didn't/Action, Custom
- Pre-selected when users create new boards on the homepage

**Default Board Settings:**
- Card visibility (hidden/visible segmented control)
- Voting enabled (toggle)
- Max votes per participant (number input)
- Secret voting (toggle)
- Applied to every new board unless the facilitator changes them

**Board Retention:**
- Enable/disable auto-deletion of completed boards
- Retention period in days (number input, default 90)
- Only affects completed boards (boards with `archived_at` set)
- **Implementation note:** The retention setting is stored now but auto-deletion requires a server-side scheduled job (Supabase pg_cron or Edge Function). This will be implemented as a follow-up — for v1, the setting is saved and displayed but deletion is manual via the Boards page.

All settings saved via a single "Save Changes" button.

### Default Board Settings Merge Strategy

`app_settings.default_board_settings` is a **partial overlay** — it only contains admin-configurable fields (visibility, voting, etc.). At board creation time, it is merged with the full `DEFAULT_BOARD_SETTINGS` constant from `constants.ts`:

```typescript
const boardSettings = {
  ...DEFAULT_BOARD_SETTINGS,           // full shape including timer, highlighted_card_id
  ...appSettings.default_board_settings // admin overrides (partial)
};
```

This ensures ephemeral fields like `timer` and `highlighted_card_id` always get their correct defaults without being admin-configurable.

### Consumption

Board creation on the homepage reads `app_settings` to populate default values. The `DEFAULT_BOARD_SETTINGS` constant remains the base shape, with `app_settings.default_board_settings` merged on top as overrides.

## Project Structure (New Files)

```
src/
├── components/
│   └── Admin/
│       ├── AdminShell.tsx          # Sidebar layout wrapper
│       ├── AdminSidebar.tsx        # Navigation sidebar
│       ├── ProtectedRoute.tsx      # Auth guard component
│       ├── FeatureFlagCard.tsx     # Individual flag toggle card
│       ├── BoardsTable.tsx         # Boards data table
│       ├── SettingsForm.tsx        # Global settings form
│       └── index.ts               # Barrel exports
├── pages/
│   ├── admin/
│   │   ├── AdminLoginPage.tsx     # Login form
│   │   ├── AdminDashboardPage.tsx # Stats overview
│   │   ├── AdminFeaturesPage.tsx  # Feature flags
│   │   ├── AdminBoardsPage.tsx    # Board management
│   │   └── AdminSettingsPage.tsx  # Global settings
├── stores/
│   ├── boardStore.ts              # Modified: conditional realtime vs polling
│   ├── featureFlagStore.ts        # NEW: feature flag state
│   └── authStore.ts               # NEW: admin auth state
├── hooks/
│   └── usePolling.ts              # NEW: polling fallback hook
└── lib/
    └── supabase.ts                # Unchanged (same client)

supabase/
└── migrations/
    └── 002_admin_console.sql      # New tables, RLS, seed data
```

## Modified Existing Files

- `src/App.tsx` — add `/admin/*` routes with lazy loading
- `src/stores/boardStore.ts` — conditional branch in `subscribeToBoard()` for realtime vs polling
- `src/pages/BoardPage.tsx` — conditionally call `usePresence` based on `live_events` flag; pass `liveSync` param to `useTimer`
- `src/hooks/usePresence.ts` — add `liveSync` parameter; when `false`, early-return without creating presence channel
- `src/hooks/useTimer.ts` — add `liveSync` parameter; when `false`, skip broadcast channel creation, run timer locally only
- `src/components/Board/ConnectionStatusBanner.tsx` — add "Polling mode" variant
- `src/pages/HomePage.tsx` — read `app_settings` for default template and board settings
- `src/utils/constants.ts` — `DEFAULT_BOARD_SETTINGS` becomes fallback only
- `src/types/index.ts` — add `FeatureFlag`, `AppSettings`, `AdminUser` interfaces; add `'polling'` to `ConnectionStatus` union

## Design Decisions

- **Feature flag cache invalidation:** Flags are fetched once at app startup and cached. Toggling a flag in the admin console will not affect currently-open board tabs until they navigate away and return (or do a full page reload). This is intentional — flags control infrastructure behavior, not per-session UI, so eventual consistency is acceptable.
- **Board export from admin:** The admin boards page must fetch a board's full data (columns, cards, votes, action items) before exporting, since the admin table only shows summary data. This is a fetch-then-export pattern, not a direct download.
