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

interface SwimlaneRow {
  id: string;
  label: string;
  cards: Card[];
}

const groupOptions: { id: SwimlaneGroupBy; label: string }[] = [
  { id: 'author', label: 'Author' },
  { id: 'votes', label: 'Votes' },
  { id: 'time', label: 'Time Added' },
];

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

  const rows = useMemo((): SwimlaneRow[] => {
    switch (groupBy) {
      case 'author': {
        const authorMap = new Map<string, { name: string; cards: Card[] }>();
        for (const card of cards) {
          const existing = authorMap.get(card.author_id);
          if (existing) {
            existing.cards.push(card);
          } else {
            const participant = participants.find((p) => p.id === card.author_id);
            authorMap.set(card.author_id, {
              name: participant?.display_name || card.author_name,
              cards: [card],
            });
          }
        }
        return Array.from(authorMap.entries()).map(([id, { name, cards: authorCards }]) => ({
          id,
          label: name,
          cards: authorCards,
        }));
      }

      case 'votes': {
        const voteCountMap = new Map<string, number>();
        for (const vote of votes) {
          voteCountMap.set(vote.card_id, (voteCountMap.get(vote.card_id) || 0) + 1);
        }

        const high: Card[] = [];
        const some: Card[] = [];
        const none: Card[] = [];

        for (const card of cards) {
          const count = voteCountMap.get(card.id) || 0;
          if (count >= 3) high.push(card);
          else if (count >= 1) some.push(card);
          else none.push(card);
        }

        const result: SwimlaneRow[] = [];
        if (high.length > 0) result.push({ id: 'high', label: 'High votes (3+)', cards: high });
        if (some.length > 0) result.push({ id: 'some', label: 'Some votes (1-2)', cards: some });
        if (none.length > 0) result.push({ id: 'none', label: 'No votes', cards: none });
        return result;
      }

      case 'time': {
        const boardStart = new Date(boardCreatedAt).getTime();
        const first5: Card[] = [];
        const mid: Card[] = [];
        const late: Card[] = [];

        for (const card of cards) {
          const cardTime = new Date(card.created_at).getTime();
          const minutesSinceStart = (cardTime - boardStart) / 60000;
          if (minutesSinceStart < 5) first5.push(card);
          else if (minutesSinceStart < 10) mid.push(card);
          else late.push(card);
        }

        const result: SwimlaneRow[] = [];
        if (first5.length > 0) result.push({ id: 'first5', label: 'First 5 min', cards: first5 });
        if (mid.length > 0) result.push({ id: 'mid', label: '5-10 min', cards: mid });
        if (late.length > 0) result.push({ id: 'late', label: '10+ min', cards: late });
        return result;
      }

      default:
        return [];
    }
  }, [groupBy, cards, votes, participants, boardCreatedAt]);

  const toggleRow = (rowId: string) => {
    setCollapsedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      {/* Group-by selector */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--color-gray-5)]">Group by:</span>
        <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-white p-0.5">
          {groupOptions.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setGroupBy(id)}
              className={cn(
                'rounded-[var(--radius-sm)] px-2.5 py-1 text-sm transition-colors',
                groupBy === id
                  ? 'bg-[var(--color-navy)] text-white'
                  : 'text-[var(--color-gray-5)] hover:text-[var(--color-gray-7)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="mb-2 grid gap-4" style={{ gridTemplateColumns: `200px repeat(${sortedColumns.length}, minmax(200px, 1fr))` }}>
        <div /> {/* spacer for row label column */}
        {sortedColumns.map((col) => (
          <div key={col.id} className="flex items-center gap-2 px-2">
            <div
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: col.color }}
            />
            <span className="text-sm font-semibold text-[var(--color-gray-8)]">{col.title}</span>
          </div>
        ))}
      </div>

      {/* Swimlane rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const isCollapsed = collapsedRows.has(row.id);
          return (
            <div key={row.id} className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-white/80">
              {/* Row header */}
              <button
                onClick={() => toggleRow(row.id)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--color-gray-0)]"
              >
                {isCollapsed ? (
                  <ChevronRight size={16} className="text-[var(--color-gray-4)]" />
                ) : (
                  <ChevronDown size={16} className="text-[var(--color-gray-4)]" />
                )}
                <span className="text-sm font-medium text-[var(--color-gray-8)]">{row.label}</span>
                <span className="rounded-[var(--radius-full)] bg-[var(--color-gray-1)] px-2 py-0.5 text-xs text-[var(--color-gray-5)]">
                  {row.cards.length}
                </span>
              </button>

              {/* Row content */}
              {!isCollapsed && (
                <div
                  className="grid gap-4 border-t border-[var(--color-gray-1)] p-3"
                  style={{ gridTemplateColumns: `200px repeat(${sortedColumns.length}, minmax(200px, 1fr))` }}
                >
                  <div /> {/* spacer */}
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
                              votingEnabled={votingEnabled}
                              secretVoting={secretVoting}
                              voteLimitReached={voteLimitReached}
                              onUpdate={onUpdateCard}
                              onDelete={onDeleteCard}
                              onToggleVote={onToggleVote}
                              isCompleted={isCompleted}
                            />
                          );
                        })}
                        {colCards.length === 0 && (
                          <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-gray-1)] p-4 text-center text-xs text-[var(--color-gray-3)]">
                            --
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-gray-2)] bg-white/50 p-12 text-center">
            <p className="text-sm text-[var(--color-gray-4)]">No cards to display</p>
          </div>
        )}
      </div>
    </div>
  );
}
