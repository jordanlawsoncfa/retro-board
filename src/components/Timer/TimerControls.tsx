import { useState } from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TIMER_PRESETS } from '@/utils/constants';
import type { TimerState } from '@/types';

interface TimerControlsProps {
  timer: TimerState;
  onStart: (duration: number) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

export function TimerControls({ timer, onStart, onPause, onResume, onReset }: TimerControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');

  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isExpired = timer.status === 'expired';

  const handleCustomStart = () => {
    const mins = parseInt(customMinutes, 10);
    if (mins > 0 && mins <= 60) {
      onStart(mins * 60);
      setCustomMinutes('');
      setIsOpen(false);
    }
  };

  if (isRunning || isPaused) {
    return (
      <div className="flex items-center gap-1">
        {isRunning ? (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)] transition-colors"
            title="Pause timer"
          >
            <Pause size={14} />
            <span className="hidden sm:inline">Pause</span>
          </button>
        ) : (
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-navy)] hover:bg-[var(--color-navy)]/10 transition-colors"
            title="Resume timer"
          >
            <Play size={14} />
            <span className="hidden sm:inline">Resume</span>
          </button>
        )}
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)] transition-colors"
          title="Reset timer"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm transition-colors',
          isExpired
            ? 'text-[var(--color-error)] hover:bg-[var(--color-error)]/10'
            : 'text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)]'
        )}
        title="Timer"
      >
        <Clock size={14} />
        <span className="hidden sm:inline">{isExpired ? 'Restart' : 'Timer'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-white p-2 shadow-lg">
          {TIMER_PRESETS.map((preset) => (
            <button
              key={preset.seconds}
              onClick={() => {
                onStart(preset.seconds);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-1)] transition-colors"
            >
              <Play size={12} />
              {preset.label}
            </button>
          ))}

          <div className="mt-1 border-t border-[var(--color-gray-1)] pt-1">
            <div className="flex items-center gap-1 px-1">
              <input
                type="number"
                min="1"
                max="60"
                placeholder="min"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomStart()}
                className="w-16 rounded-[var(--radius-sm)] border border-[var(--color-gray-2)] px-2 py-1.5 text-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
              />
              <button
                onClick={handleCustomStart}
                disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
                className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-sm text-[var(--color-navy)] hover:bg-[var(--color-navy)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Play size={12} />
                Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
