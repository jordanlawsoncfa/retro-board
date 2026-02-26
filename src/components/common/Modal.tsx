import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ animation: 'fade-in 150ms ease-out' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-[var(--color-gray-8)]/50" />
      <div
        className={cn(
          'relative w-full rounded-[var(--radius-lg)] bg-white shadow-xl',
          sizeStyles[size]
        )}
        style={{ animation: 'scale-in 150ms ease-out' }}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[var(--color-gray-1)] px-6 py-4">
            <h2 className="text-xl font-bold text-[var(--color-gray-8)]">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)] transition-colors"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
