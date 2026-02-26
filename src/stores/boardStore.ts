import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import { BOARD_TEMPLATES } from '@/utils/templates';
import type { Board, Column, Card, Vote, ActionItem, Participant, BoardTemplate, BoardSettings } from '@/types';

interface BoardState {
  board: Board | null;
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  actionItems: ActionItem[];
  participants: Participant[];
  loading: boolean;
  error: string | null;
  currentParticipantId: string | null;

  // Board lifecycle
  createBoard: (title: string, description: string | null, template: BoardTemplate) => Promise<string>;
  fetchBoard: (boardId: string) => Promise<void>;
  updateSettings: (settings: Partial<BoardSettings>) => Promise<void>;
  reset: () => void;

  // Participants
  joinBoard: (boardId: string, displayName: string) => Promise<void>;

  // Columns
  addColumn: (title: string, color: string, description?: string) => Promise<void>;
  updateColumn: (columnId: string, updates: Partial<Pick<Column, 'title' | 'color' | 'description'>>) => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;

  // Cards
  addCard: (columnId: string, text: string) => Promise<void>;
  updateCard: (cardId: string, text: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  moveCard: (cardId: string, targetColumnId: string, newPosition: number) => Promise<void>;

  // Voting
  toggleVote: (cardId: string) => Promise<void>;

  // Realtime
  subscribeToBoard: (boardId: string) => () => void;
}

const initialState = {
  board: null as Board | null,
  columns: [] as Column[],
  cards: [] as Card[],
  votes: [] as Vote[],
  actionItems: [] as ActionItem[],
  participants: [] as Participant[],
  loading: false,
  error: null as string | null,
  currentParticipantId: null as string | null,
};

export const useBoardStore = create<BoardState>((set, get) => ({
  ...initialState,

  createBoard: async (title, description, template) => {
    const boardId = nanoid(10);
    const templateDef = BOARD_TEMPLATES.find((t) => t.id === template);

    const { error: boardError } = await supabase.from('boards').insert({
      id: boardId,
      title,
      description,
      template,
      created_by: crypto.randomUUID(), // placeholder — will use auth user ID later
      settings: DEFAULT_BOARD_SETTINGS,
    });

    if (boardError) throw boardError;

    if (templateDef && templateDef.columns.length > 0) {
      const columnsToInsert = templateDef.columns.map((col, i) => ({
        id: nanoid(10),
        board_id: boardId,
        title: col.title,
        description: col.description || null,
        color: col.color,
        position: i,
      }));

      const { error: colError } = await supabase.from('columns').insert(columnsToInsert);
      if (colError) throw colError;
    }

    return boardId;
  },

  fetchBoard: async (boardId) => {
    set({ loading: true, error: null });

    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .single();

    if (boardError) {
      set({ loading: false, error: boardError.message });
      return;
    }

    const [columnsRes, cardsRes, votesRes, actionItemsRes, participantsRes] = await Promise.all([
      supabase.from('columns').select('*').eq('board_id', boardId).order('position'),
      supabase.from('cards').select('*').eq('board_id', boardId).order('position'),
      supabase.from('votes').select('*').eq('board_id', boardId),
      supabase.from('action_items').select('*').eq('board_id', boardId).order('created_at'),
      supabase.from('participants').select('*').eq('board_id', boardId),
    ]);

    const stored = sessionStorage.getItem(`retro-pid-${boardId}`);

    set({
      board,
      columns: columnsRes.data || [],
      cards: cardsRes.data || [],
      votes: votesRes.data || [],
      actionItems: actionItemsRes.data || [],
      participants: participantsRes.data || [],
      currentParticipantId: stored || null,
      loading: false,
    });
  },

  updateSettings: async (settingsUpdate) => {
    const { board } = get();
    if (!board) return;

    const newSettings = { ...board.settings, ...settingsUpdate };

    const { error } = await supabase
      .from('boards')
      .update({ settings: newSettings })
      .eq('id', board.id);

    if (error) throw error;

    set({ board: { ...board, settings: newSettings } });
  },

  joinBoard: async (boardId, displayName) => {
    const participantId = crypto.randomUUID();

    const { error } = await supabase.from('participants').insert({
      id: participantId,
      board_id: boardId,
      display_name: displayName,
      is_admin: false,
    });

    if (error) throw error;

    sessionStorage.setItem(`retro-pid-${boardId}`, participantId);

    set((state) => ({
      currentParticipantId: participantId,
      participants: [
        ...state.participants,
        {
          id: participantId,
          board_id: boardId,
          display_name: displayName,
          is_admin: false,
          joined_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        },
      ],
    }));
  },

  // --- Column CRUD ---

  addColumn: async (title, color, description) => {
    const { board, columns } = get();
    if (!board) return;

    const newCol = {
      id: nanoid(10),
      board_id: board.id,
      title,
      description: description || null,
      color,
      position: columns.length,
    };

    const { error } = await supabase.from('columns').insert(newCol);
    if (error) throw error;

    set((state) => ({
      columns: [...state.columns, { ...newCol, created_at: new Date().toISOString() }],
    }));
  },

  updateColumn: async (columnId, updates) => {
    const { error } = await supabase.from('columns').update(updates).eq('id', columnId);
    if (error) throw error;

    set((state) => ({
      columns: state.columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c)),
    }));
  },

  deleteColumn: async (columnId) => {
    const { error } = await supabase.from('columns').delete().eq('id', columnId);
    if (error) throw error;

    set((state) => ({
      columns: state.columns.filter((c) => c.id !== columnId),
      cards: state.cards.filter((c) => c.column_id !== columnId),
    }));
  },

  // --- Card CRUD ---

  addCard: async (columnId, text) => {
    const { board, cards, currentParticipantId, participants } = get();
    if (!board || !currentParticipantId) return;

    const participant = participants.find((p) => p.id === currentParticipantId);
    const cardsInColumn = cards.filter((c) => c.column_id === columnId);

    const newCard = {
      id: nanoid(10),
      column_id: columnId,
      board_id: board.id,
      text,
      author_name: participant?.display_name || 'Anonymous',
      author_id: currentParticipantId,
      color: null,
      position: cardsInColumn.length,
      merged_with: null,
    };

    const { error } = await supabase.from('cards').insert(newCard);
    if (error) throw error;

    set((state) => ({
      cards: [
        ...state.cards,
        { ...newCard, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
    }));
  },

  updateCard: async (cardId, text) => {
    const { error } = await supabase.from('cards').update({ text }).eq('id', cardId);
    if (error) throw error;

    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, text, updated_at: new Date().toISOString() } : c
      ),
    }));
  },

  deleteCard: async (cardId) => {
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (error) throw error;

    set((state) => ({
      cards: state.cards.filter((c) => c.id !== cardId),
      votes: state.votes.filter((v) => v.card_id !== cardId),
    }));
  },

  moveCard: async (cardId, targetColumnId, newPosition) => {
    const { cards } = get();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // Optimistic update
    set((state) => {
      const otherCards = state.cards.filter((c) => c.id !== cardId);
      const movedCard = { ...card, column_id: targetColumnId, position: newPosition };

      const targetCards = otherCards
        .filter((c) => c.column_id === targetColumnId)
        .sort((a, b) => a.position - b.position);

      targetCards.splice(newPosition, 0, movedCard);
      const reindexed = targetCards.map((c, i) => ({ ...c, position: i }));

      return {
        cards: [
          ...otherCards.filter((c) => c.column_id !== targetColumnId),
          ...reindexed,
        ],
      };
    });

    const { error } = await supabase
      .from('cards')
      .update({ column_id: targetColumnId, position: newPosition })
      .eq('id', cardId);

    if (error) {
      // Revert on failure
      set((state) => ({
        cards: state.cards.map((c) =>
          c.id === cardId ? { ...c, column_id: card.column_id, position: card.position } : c
        ),
      }));
      throw error;
    }
  },

  // --- Voting ---

  toggleVote: async (cardId) => {
    const { board, votes, currentParticipantId } = get();
    if (!board || !currentParticipantId) return;

    const existingVote = votes.find(
      (v) => v.card_id === cardId && v.voter_id === currentParticipantId
    );

    if (existingVote) {
      const { error } = await supabase.from('votes').delete().eq('id', existingVote.id);
      if (error) throw error;
      set((state) => ({ votes: state.votes.filter((v) => v.id !== existingVote.id) }));
    } else {
      const myVotes = votes.filter((v) => v.voter_id === currentParticipantId);
      if (myVotes.length >= board.settings.max_votes_per_participant) return;

      const myVotesOnCard = myVotes.filter((v) => v.card_id === cardId);
      if (myVotesOnCard.length >= board.settings.max_votes_per_card) return;

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

  // --- Realtime ---

  subscribeToBoard: (boardId) => {
    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cards', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.cards.some((c) => c.id === payload.new.id)) return state;
            return { cards: [...state.cards, payload.new as Card] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cards', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            cards: state.cards.map((c) => (c.id === payload.new.id ? (payload.new as Card) : c)),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'cards', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            cards: state.cards.filter((c) => c.id !== payload.old.id),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.columns.some((c) => c.id === payload.new.id)) return state;
            return { columns: [...state.columns, payload.new as Column] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            columns: state.columns.map((c) => (c.id === payload.new.id ? (payload.new as Column) : c)),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            columns: state.columns.filter((c) => c.id !== payload.old.id),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.votes.some((v) => v.id === payload.new.id)) return state;
            return { votes: [...state.votes, payload.new as Vote] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'votes', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            votes: state.votes.filter((v) => v.id !== payload.old.id),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'participants', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.participants.some((p) => p.id === payload.new.id)) return state;
            return { participants: [...state.participants, payload.new as Participant] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'boards', filter: `id=eq.${boardId}` },
        (payload) => {
          set({ board: payload.new as Board });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  reset: () => set(initialState),
}));
