import { Eye, EyeOff, Lock, Unlock, Vote, Timer, Users, Share2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { BoardSettings } from '@/types';

interface FacilitatorToolbarProps {
  settings: BoardSettings;
  participantCount: number;
  boardId: string;
  onUpdateSettings: (settings: Partial<BoardSettings>) => void;
}

export function FacilitatorToolbar({
  settings,
  participantCount,
  boardId,
  onUpdateSettings,
}: FacilitatorToolbarProps) {
  const isRevealed = settings.card_visibility === 'visible';
  const isLocked = settings.board_locked;
  const votingOn = settings.voting_enabled;

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/board/${boardId}`;
    await navigator.clipboard.writeText(url);
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {/* Reveal / Hide cards */}
      <ToolbarButton
        icon={isRevealed ? Eye : EyeOff}
        label={isRevealed ? 'Cards visible' : 'Cards hidden'}
        active={isRevealed}
        onClick={() =>
          onUpdateSettings({
            card_visibility: isRevealed ? 'hidden' : 'visible',
          })
        }
      />

      {/* Lock / Unlock board */}
      <ToolbarButton
        icon={isLocked ? Lock : Unlock}
        label={isLocked ? 'Board locked' : 'Board open'}
        active={isLocked}
        onClick={() => onUpdateSettings({ board_locked: !isLocked })}
      />

      {/* Toggle voting */}
      <ToolbarButton
        icon={Vote}
        label={votingOn ? 'Voting on' : 'Voting off'}
        active={votingOn}
        onClick={() => onUpdateSettings({ voting_enabled: !votingOn })}
      />

      {/* Timer placeholder */}
      <ToolbarButton
        icon={Timer}
        label="Timer"
        onClick={() => {
          // Timer UI will be built in Phase 4
        }}
      />

      {/* Divider */}
      <div className="mx-1 h-6 w-px bg-[var(--color-gray-2)]" />

      {/* Participant count */}
      <div className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-gray-5)]">
        <Users size={14} />
        <span>{participantCount}</span>
      </div>

      {/* Share link */}
      <ToolbarButton icon={Share2} label="Copy link" onClick={handleCopyLink} />
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm transition-colors',
        active
          ? 'bg-[var(--color-navy)]/10 text-[var(--color-navy)] font-medium'
          : 'text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)]'
      )}
      title={label}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
