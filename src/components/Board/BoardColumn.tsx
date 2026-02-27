import { useState, useRef, useEffect, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ThumbsUp, Pencil, Trash2, Check, X, Palette } from 'lucide-react';
import { cn } from '@/utils/cn';
import { COLUMN_COLORS } from '@/utils/constants';
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
  onUpdateCard: (cardId: string, updates: Partial<{ text: string; color: string | null }>) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
  isCompleted?: boolean;
  isAdmin?: boolean;
  onUpdateColumn?: (columnId: string, updates: Partial<Pick<Column, 'title' | 'color' | 'description'>>) => void;
  onDeleteColumn?: (columnId: string) => void;
  canDeleteColumn?: boolean;
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
  isAdmin,
  onUpdateColumn,
  onDeleteColumn,
  canDeleteColumn,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  const handleColorSelect = (color: string) => {
    if (onUpdateColumn) {
      onUpdateColumn(column.id, { color });
    }
    setShowColorPicker(false);
  };

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== column.title && onUpdateColumn) {
      onUpdateColumn(column.id, { title: trimmed });
    }
    setIsEditingTitle(false);
    setEditTitle(trimmed || column.title);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') {
      setEditTitle(column.title);
      setIsEditingTitle(false);
    }
  };

  const handleDeleteColumn = () => {
    if (onDeleteColumn) {
      onDeleteColumn(column.id);
    }
    setShowDeleteConfirm(false);
  };

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
      className={`flex min-h-[300px] w-[85vw] shrink-0 snap-start flex-col rounded-[var(--radius-lg)] border bg-white/80 sm:w-auto sm:shrink ${
        isOver ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/5' : 'border-[var(--color-gray-1)]'
      }`}
    >
      {/* Column header */}
      <div className="flex flex-col border-b border-[var(--color-gray-1)]">
        <div className="flex items-center gap-2 px-4 py-3">
          <div
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: column.color }}
          />

          {isEditingTitle ? (
            <div className="flex flex-1 items-center gap-1">
              <input
                ref={titleInputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleSaveTitle}
                maxLength={40}
                className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-gray-2)] px-2 py-1.5 text-base font-semibold text-[var(--color-gray-8)] focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSaveTitle}
                className="rounded-[var(--radius-sm)] p-2 text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
                aria-label="Save title"
              >
                <Check size={16} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setEditTitle(column.title);
                  setIsEditingTitle(false);
                }}
                className="rounded-[var(--radius-sm)] p-2 text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <h3 className="flex-1 text-base font-semibold text-[var(--color-gray-8)]">
              {column.title}
            </h3>
          )}

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

        {/* Admin action bar — always visible, not hover-dependent */}
        {isAdmin && !isCompleted && !isEditingTitle && (
          <div className="relative flex items-center gap-1 border-t border-[var(--color-gray-1)] px-3 py-1.5">
            <button
              onClick={() => {
                setEditTitle(column.title);
                setIsEditingTitle(true);
              }}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)] transition-colors"
              aria-label="Rename column"
            >
              <Pencil size={14} />
              <span>Rename</span>
            </button>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)] transition-colors"
              aria-label="Change column color"
            >
              <Palette size={14} />
              <span>Color</span>
            </button>
            {canDeleteColumn && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)] transition-colors"
                aria-label="Delete column"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}

            {/* Color picker popover */}
            {showColorPicker && (
              <div
                ref={colorPickerRef}
                className="absolute left-2 top-full z-30 mt-1 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-white p-2 shadow-lg"
              >
                <div className="grid grid-cols-6 gap-1.5">
                  {COLUMN_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                        column.color === color
                          ? 'border-[var(--color-gray-8)] ring-2 ring-[var(--color-gray-8)]/20'
                          : 'border-transparent'
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="flex items-center justify-between bg-[var(--color-error)]/5 px-4 py-2.5 text-sm">
          <span className="text-[var(--color-error)]">
            Delete column{cards.length > 0 ? ` and ${cards.length} card${cards.length === 1 ? '' : 's'}` : ''}?
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-[var(--radius-sm)] px-3 py-1.5 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteColumn}
              className="rounded-[var(--radius-sm)] bg-[var(--color-error)] px-3 py-1.5 text-xs text-white hover:opacity-90"
            >
              Delete
            </button>
          </div>
        </div>
      )}

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
