import { useState } from 'react';
import { Pencil, Trash2, ThumbsUp, Check, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { CardColorPicker } from './CardColorPicker';

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
  secretVoting: boolean;
  voteLimitReached: boolean;
  onUpdate: (cardId: string, updates: Partial<{ text: string; color: string | null }>) => void;
  onDelete: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
  isCompleted?: boolean;
}

export function RetroCard({
  id,
  text,
  authorName,
  color,
  voteCount,
  hasVoted,
  isAuthor,
  isObscured,
  votingEnabled,
  secretVoting,
  voteLimitReached,
  onUpdate,
  onDelete,
  onToggleVote,
  isCompleted,
}: RetroCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== text) {
      onUpdate(id, { text: trimmed });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditText(text);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'group relative rounded-[var(--radius-md)] border border-[var(--color-gray-1)] bg-white p-3 shadow-sm',
        'transition-[filter] duration-400 ease-out',
        isObscured && !isAuthor && 'select-none',
        colorPickerOpen && 'z-20'
      )}
      style={{
        backgroundColor: color || undefined,
        filter: isObscured && !isAuthor ? 'blur(6px)' : 'blur(0px)',
      }}
    >
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            autoFocus
            className={cn(
              'w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-gray-2)]',
              'bg-white px-2 py-1.5 text-sm text-[var(--color-gray-8)]',
              'focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]'
            )}
          />
          <div className="flex justify-end gap-1">
            <button
              onClick={() => {
                setEditText(text);
                setIsEditing(false);
              }}
              className="rounded-[var(--radius-sm)] p-1 text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]"
              aria-label="Cancel edit"
            >
              <X size={14} />
            </button>
            <button
              onClick={handleSave}
              className="rounded-[var(--radius-sm)] p-1 text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
              aria-label="Save edit"
            >
              <Check size={14} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-gray-8)]">{text}</p>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-[var(--color-gray-4)]">{authorName}</span>

            <div className="flex items-center gap-1">
              {/* Vote button */}
              {votingEnabled && !isCompleted && (
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

              {/* Author actions (visible on hover) */}
              {isAuthor && !isCompleted && (
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <CardColorPicker
                    currentColor={color}
                    onSelectColor={(newColor) => onUpdate(id, { color: newColor })}
                    onOpenChange={setColorPickerOpen}
                  />
                  <button
                    onClick={() => {
                      setEditText(text);
                      setIsEditing(true);
                    }}
                    className="rounded-[var(--radius-sm)] p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]"
                    aria-label="Edit card"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => onDelete(id)}
                    className="rounded-[var(--radius-sm)] p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                    aria-label="Delete card"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
