-- 001_initial_schema.sql
-- RetroBoard: Complete OLTP operational schema
-- Generated: 2026-02-25
--
-- Design notes:
--   - OLTP transactional schema for a real-time retrospective board
--   - TEXT PRIMARY KEYs for boards, columns, cards, participants (nanoid generated client-side)
--   - UUID PRIMARY KEYs for votes and action_items (server-generated)
--   - No Supabase Auth dependency in Phase 1 — participants join via anonymous session
--   - RLS policies are permissive (anon key access) — will tighten when auth is added
--   - Realtime enabled on all collaborative tables

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- -------------------------------------------------
-- boards
-- Grain: One row per retrospective board.
-- The id is a short nanoid used in shareable URLs (e.g. /board/V1StGXR8_Z5jdHi6B-myT).
-- -------------------------------------------------
CREATE TABLE boards (
  id          TEXT        PRIMARY KEY,              -- nanoid, used in shareable URLs
  title       TEXT        NOT NULL,
  description TEXT,
  template    TEXT        NOT NULL
                          CHECK (template IN (
                            'mad-sad-glad',
                            'liked-learned-lacked',
                            'start-stop-continue',
                            'went-well-didnt-action',
                            'custom'
                          )),
  created_by  TEXT        NOT NULL,                 -- participant id of the board creator
  settings    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ                           -- NULL = active; set when archived
);

COMMENT ON TABLE  boards              IS 'One row per retrospective board';
COMMENT ON COLUMN boards.id           IS 'Short nanoid for shareable URLs';
COMMENT ON COLUMN boards.template     IS 'Board template: mad-sad-glad | liked-learned-lacked | start-stop-continue | went-well-didnt-action | custom';
COMMENT ON COLUMN boards.created_by   IS 'Participant id of the admin/creator';
COMMENT ON COLUMN boards.settings     IS 'Flexible JSONB: card_visibility, voting config, timer state, etc.';
COMMENT ON COLUMN boards.archived_at  IS 'NULL means active; timestamptz when archived';

-- -------------------------------------------------
-- columns
-- Grain: One row per column on a board.
-- Columns define the categories (e.g. "Mad", "Sad", "Glad").
-- -------------------------------------------------
CREATE TABLE columns (
  id          TEXT        PRIMARY KEY,              -- nanoid
  board_id    TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT '#004F71',
  position    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  columns            IS 'One row per column on a board';
COMMENT ON COLUMN columns.position   IS 'Sort order within the board (0-based)';
COMMENT ON COLUMN columns.color      IS 'Hex color for the column header';

-- -------------------------------------------------
-- participants
-- Grain: One row per person who joins a board.
-- Created BEFORE cards/votes because those tables reference participant ids.
-- In Phase 1, participants join without Supabase Auth — id is a client-generated UUID string.
-- -------------------------------------------------
CREATE TABLE participants (
  id           TEXT        PRIMARY KEY,             -- client-generated UUID string
  board_id     TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL,
  is_admin     BOOLEAN     NOT NULL DEFAULT false,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  participants              IS 'One row per person who joins a board';
COMMENT ON COLUMN participants.id           IS 'Client-generated UUID string (no auth required in Phase 1)';
COMMENT ON COLUMN participants.is_admin     IS 'True for the board creator; false for regular participants';
COMMENT ON COLUMN participants.last_seen    IS 'Updated on each interaction for presence tracking';

-- -------------------------------------------------
-- cards
-- Grain: One row per sticky note card on a board.
-- -------------------------------------------------
CREATE TABLE cards (
  id          TEXT        PRIMARY KEY,              -- nanoid
  column_id   TEXT        NOT NULL REFERENCES columns (id) ON DELETE CASCADE,
  board_id    TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  text        TEXT        NOT NULL DEFAULT '',
  author_name TEXT        NOT NULL,
  author_id   TEXT        NOT NULL,                 -- participant id
  color       TEXT,
  position    INTEGER     NOT NULL DEFAULT 0,
  merged_with TEXT        REFERENCES cards (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  cards              IS 'One row per sticky note card on a board';
COMMENT ON COLUMN cards.author_id    IS 'References participants.id (the card creator)';
COMMENT ON COLUMN cards.merged_with  IS 'If set, this card has been merged/grouped with another card';
COMMENT ON COLUMN cards.position     IS 'Sort order within the column (0-based)';

-- -------------------------------------------------
-- votes
-- Grain: One row per vote on a card.
-- The UNIQUE constraint on (card_id, voter_id) prevents double-voting.
-- -------------------------------------------------
CREATE TABLE votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     TEXT        NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  board_id    TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  voter_id    TEXT        NOT NULL,                 -- participant id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_votes_card_voter UNIQUE (card_id, voter_id)
);

COMMENT ON TABLE  votes            IS 'One row per vote on a card';
COMMENT ON COLUMN votes.voter_id   IS 'References participants.id (the voter)';

-- -------------------------------------------------
-- action_items
-- Grain: One row per action item created from a retrospective.
-- -------------------------------------------------
CREATE TABLE action_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  description TEXT        NOT NULL,
  assignee    TEXT,                                  -- free-text assignee name
  due_date    DATE,
  status      TEXT        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'in_progress', 'done')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  action_items          IS 'One row per action item from a retrospective';
COMMENT ON COLUMN action_items.status   IS 'Workflow state: open -> in_progress -> done';
COMMENT ON COLUMN action_items.assignee IS 'Free-text assignee name (not a FK in Phase 1)';


-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- boards
CREATE INDEX idx_boards_created_by   ON boards (created_by);
CREATE INDEX idx_boards_created_at   ON boards (created_at DESC);
CREATE INDEX idx_boards_archived_at  ON boards (archived_at)
  WHERE archived_at IS NULL;          -- partial index: quickly find active boards

-- columns
CREATE INDEX idx_columns_board_id    ON columns (board_id);
CREATE INDEX idx_columns_ordering    ON columns (board_id, position);

-- participants
CREATE INDEX idx_participants_board_id ON participants (board_id);

-- cards
CREATE INDEX idx_cards_column_id     ON cards (column_id);
CREATE INDEX idx_cards_board_id      ON cards (board_id);
CREATE INDEX idx_cards_author_id     ON cards (author_id);
CREATE INDEX idx_cards_ordering      ON cards (column_id, position);
CREATE INDEX idx_cards_merged_with   ON cards (merged_with)
  WHERE merged_with IS NOT NULL;      -- partial: only index rows that are merged

-- votes
CREATE INDEX idx_votes_card_id       ON votes (card_id);
CREATE INDEX idx_votes_board_id      ON votes (board_id);
CREATE INDEX idx_votes_voter_id      ON votes (voter_id);
-- Note: the UNIQUE constraint on (card_id, voter_id) already creates a composite index

-- action_items
CREATE INDEX idx_action_items_board_id ON action_items (board_id);
CREATE INDEX idx_action_items_status   ON action_items (board_id, status);


-- ============================================================================
-- 3. TRIGGER: auto-update updated_at
-- ============================================================================

-- Reusable trigger function — attach to any table with an updated_at column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to cards table
CREATE TRIGGER trg_cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================
-- Phase 1: No Supabase Auth. Participants join via anonymous session with anon key.
-- Policies are permissive — all operations allowed. We will tighten these in later
-- phases when proper authentication is introduced.

ALTER TABLE boards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE columns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------
-- boards
-- -------------------------------------------------
CREATE POLICY "boards: public read"
  ON boards FOR SELECT
  USING (true);

CREATE POLICY "boards: allow insert"
  ON boards FOR INSERT
  WITH CHECK (true);

CREATE POLICY "boards: allow update"
  ON boards FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "boards: allow delete"
  ON boards FOR DELETE
  USING (true);

-- -------------------------------------------------
-- columns
-- -------------------------------------------------
CREATE POLICY "columns: public read"
  ON columns FOR SELECT
  USING (true);

CREATE POLICY "columns: allow insert"
  ON columns FOR INSERT
  WITH CHECK (true);

CREATE POLICY "columns: allow update"
  ON columns FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "columns: allow delete"
  ON columns FOR DELETE
  USING (true);

-- -------------------------------------------------
-- cards
-- -------------------------------------------------
CREATE POLICY "cards: public read"
  ON cards FOR SELECT
  USING (true);

CREATE POLICY "cards: allow insert"
  ON cards FOR INSERT
  WITH CHECK (true);

CREATE POLICY "cards: allow update"
  ON cards FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cards: allow delete"
  ON cards FOR DELETE
  USING (true);

-- -------------------------------------------------
-- votes
-- -------------------------------------------------
CREATE POLICY "votes: public read"
  ON votes FOR SELECT
  USING (true);

CREATE POLICY "votes: allow insert"
  ON votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "votes: allow delete"
  ON votes FOR DELETE
  USING (true);

-- -------------------------------------------------
-- action_items
-- -------------------------------------------------
CREATE POLICY "action_items: public read"
  ON action_items FOR SELECT
  USING (true);

CREATE POLICY "action_items: allow insert"
  ON action_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "action_items: allow update"
  ON action_items FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "action_items: allow delete"
  ON action_items FOR DELETE
  USING (true);

-- -------------------------------------------------
-- participants
-- -------------------------------------------------
CREATE POLICY "participants: public read"
  ON participants FOR SELECT
  USING (true);

CREATE POLICY "participants: allow insert"
  ON participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "participants: allow update"
  ON participants FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "participants: allow delete"
  ON participants FOR DELETE
  USING (true);


-- ============================================================================
-- 5. ENABLE SUPABASE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE boards;
ALTER PUBLICATION supabase_realtime ADD TABLE columns;
ALTER PUBLICATION supabase_realtime ADD TABLE cards;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
