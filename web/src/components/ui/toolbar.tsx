import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  (
    { onSearch, searchPlaceholder = 'ค้นหา...', filters, actions, className, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-wrap items-center gap-4 py-4', className)}
        {...props}
      >
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-placeholder)]" />
          <Input
            className="pl-9"
            placeholder={searchPlaceholder}
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
        {filters && <div className="flex flex-1 items-center gap-2">{filters}</div>}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
    );
  }
);
Toolbar.displayName = 'Toolbar';

export { Toolbar };
