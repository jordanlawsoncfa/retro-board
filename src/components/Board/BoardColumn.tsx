import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ThumbsUp } from 'lucide-react';
import { RetroCard } from './RetroCard';
import { SortableCard } from './SortableCard';
import { AddCardForm } from './AddCardForm';
import type { Column, Card, Vote } from '@/types';

interface BoardColumnProps {
  column: Column;
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  votingEnabled: boolean;
  secretVoting: boolean;
  cardCreationDisabled: boolean;
  maxVotesPerParticipant: number;
  onAddCard: (columnId: string, text: string) => void;
  onUpdateCard: (cardId: string, text: string) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
  isCompleted?: boolean;
}

export function BoardColumn({
  column,
  cards,
  votes,
  currentParticipantId,
  isObscured,
  votingEnabled,
  secretVoting,
  cardCreationDisabled,
  maxVotesPerParticipant,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onToggleVote,
  isCompleted,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.position - b.position),
    [cards]
  );

  const cardIds = useMemo(() => sortedCards.map((c) => c.id), [sortedCards]);

  const columnVoteCount = useMemo(
    () => votes.filter((v) => cards.some((c) => c.id === v.card_id)).length,
    [votes, cards]
  );

  const voteLimitReached = useMemo(() => {
    if (!currentParticipantId) return false;
    const myVoteCount = votes.filter((v) => v.voter_id === currentParticipantId).length;
    return myVoteCount >= maxVotesPerParticipant;
  }, [votes, currentParticipantId, maxVotesPerParticipant]);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[300px] flex-col rounded-[var(--radius-lg)] border bg-white/80 ${
        isOver ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/5' : 'border-[var(--color-gray-1)]'
      }`}
    >
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
        {votingEnabled && !secretVoting && columnVoteCount > 0 && (
          <span className="flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-navy)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-navy)]">
            <ThumbsUp size={10} />
            {columnVoteCount}
          </span>
        )}
      </div>

      {/* Column description */}
      {column.description && (
        <p className="border-b border-[var(--color-gray-1)] px-4 py-2 text-sm text-[var(--color-gray-4)]">
          {column.description}
        </p>
      )}

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {sortedCards.map((card) => {
            const cardVotes = votes.filter((v) => v.card_id === card.id);
            const hasVoted = cardVotes.some((v) => v.voter_id === currentParticipantId);

            return (
              <SortableCard key={card.id} id={card.id}>
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
                  secretVoting={secretVoting}
                  voteLimitReached={voteLimitReached}
                  onUpdate={onUpdateCard}
                  onDelete={onDeleteCard}
                  onToggleVote={onToggleVote}
                  isCompleted={isCompleted}
                />
              </SortableCard>
            );
          })}
        </SortableContext>

        <div className="mt-auto pt-2">
          <AddCardForm
            onSubmit={(text) => onAddCard(column.id, text)}
            disabled={cardCreationDisabled}
          />
        </div>
      </div>
    </div>
  );
}
