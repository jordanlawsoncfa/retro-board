import { useState, useRef, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
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
  const [showPopover, setShowPopover] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isExpired = timer.status === 'expired';
  const isActive = isRunning || isPaused;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPopover]);

  const handleStartCustom = () => {
    const mins = parseFloat(customMinutes);
    if (mins > 0 && mins <= 60) {
      onStart(mins * 60);
      setCustomMinutes('');
      setShowPopover(false);
    }
  };

  const handlePresetClick = (seconds: number) => {
    onStart(seconds);
    setShowPopover(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Active timer: show compact inline controls
  if (isActive) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm font-mono font-semibold tabular-nums" style={{ color: timer.remaining <= 10 ? '#DD0031' : 'var(--color-navy)' }}>
          {formatTime(timer.remaining)}
        </span>
        {isRunning ? (
          <button onClick={onPause} className="p-1 rounded hover:bg-[var(--color-gray-1)]" title="Pause">
            <Pause size={14} />
          </button>
        ) : (
          <button onClick={onResume} className="p-1 rounded hover:bg-[var(--color-gray-1)]" title="Resume">
            <Play size={14} />
          </button>
        )}
        <button onClick={onReset} className="p-1 rounded hover:bg-[var(--color-gray-1)]" title="Reset">
          <RotateCcw size={14} />
        </button>
      </div>
    );
  }

  // Idle/expired: show clock button + popover
  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors ${
          isExpired
            ? 'text-[#DD0031] hover:bg-red-50'
            : 'text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]'
        }`}
        title="Set timer"
      >
        <Clock size={14} />
        <span>{isExpired ? "Time's up!" : 'Timer'}</span>
      </button>

      {showPopover && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-[var(--color-gray-2)] p-3 z-50 w-56">
          <p className="text-xs font-medium text-[var(--color-gray-5)] mb-2">Quick start</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TIMER_PRESETS.map((preset) => (
              <button
                key={preset.seconds}
                onClick={() => handlePresetClick(preset.seconds)}
                className="px-2.5 py-1 text-xs rounded-full border border-[var(--color-gray-2)] hover:bg-[var(--color-navy)] hover:text-white hover:border-[var(--color-navy)] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="border-t border-[var(--color-gray-1)] pt-2">
            <p className="text-xs font-medium text-[var(--color-gray-5)] mb-1.5">Custom</p>
            <div className="flex gap-1.5">
              <input
                type="number"
                min="1"
                max="60"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartCustom()}
                placeholder="Minutes"
                className="flex-1 px-2 py-1 text-xs border border-[var(--color-gray-2)] rounded-md focus:outline-none focus:border-[var(--color-navy)]"
              />
              <button
                onClick={handleStartCustom}
                disabled={!customMinutes || parseFloat(customMinutes) <= 0 || parseFloat(customMinutes) > 60}
                className="px-3 py-1 text-xs bg-[var(--color-navy)] text-white rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
