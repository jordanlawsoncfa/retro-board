import { Eye, EyeOff, Lock, Unlock, Vote, ClipboardList, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TimerControls } from '@/components/Timer';
import type { BoardSettings, TimerState } from '@/types';

interface FacilitatorToolbarProps {
  settings: BoardSettings;

  timer: TimerState;
  onUpdateSettings: (settings: Partial<BoardSettings>) => void;
  onTimerStart: (duration: number) => void;
  onTimerPause: () => void;
  onTimerResume: () => void;
  onTimerReset: () => void;
  actionItemCount: number;
  onToggleActionItems: () => void;
  isCompleted: boolean;
  onCompleteRetro: () => void;
}

export function FacilitatorToolbar({
  settings,

  timer,
  onUpdateSettings,
  onTimerStart,
  onTimerPause,
  onTimerResume,
  onTimerReset,
  actionItemCount,
  onToggleActionItems,
  isCompleted,
  onCompleteRetro,
}: FacilitatorToolbarProps) {
  const isRevealed = settings.card_visibility === 'visible';
  const isLocked = settings.board_locked;
  const votingOn = settings.voting_enabled;

  return (
    <div className="flex items-center gap-2">
      {!isCompleted && (
        <>
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

          {/* Secret voting toggle — only show when voting is enabled */}
          {votingOn && (
            <ToolbarButton
              icon={settings.secret_voting ? EyeOff : Eye}
              label={settings.secret_voting ? 'Secret voting' : 'Open voting'}
              active={settings.secret_voting}
              onClick={() => onUpdateSettings({ secret_voting: !settings.secret_voting })}
            />
          )}

          {/* Timer controls */}
          <TimerControls
            timer={timer}
            onStart={onTimerStart}
            onPause={onTimerPause}
            onResume={onTimerResume}
            onReset={onTimerReset}
          />

          {/* Action Items */}
          <ToolbarButton
            icon={ClipboardList}
            label={`Actions${actionItemCount > 0 ? ` (${actionItemCount})` : ''}`}
            onClick={onToggleActionItems}
          />

          {/* Complete Retro */}
          <ToolbarButton
            icon={CheckCircle2}
            label="Complete Retro"
            onClick={onCompleteRetro}
          />
        </>
      )}

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
