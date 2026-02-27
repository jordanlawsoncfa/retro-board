import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { APP_NAME } from '@/utils/constants';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  rightContent?: React.ReactNode;
}

export function Header({ rightContent }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-gray-1)] bg-[var(--color-surface-translucent)] backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 hover:no-underline">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)]">
            <Layers size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-[var(--color-gray-8)]">
            {APP_NAME}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {rightContent}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
