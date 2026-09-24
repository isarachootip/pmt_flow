import * as React from 'react';
import { cn } from '@/lib/utils';

export interface KpiChip {
  id: string;
  label: string;
  count: number;
}

export interface KpiChipsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  chips: KpiChip[];
  activeId?: string;
  onSelect?: (id: string) => void;
}

const KpiChips = React.forwardRef<HTMLDivElement, KpiChipsProps>(
  ({ chips, activeId, onSelect, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex flex-wrap gap-2', className)} {...props}>
        {chips.map((chip) => {
          const isActive = activeId === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => onSelect?.(chip.id)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'border-[var(--primary)] bg-[var(--primary-softer)] text-[var(--primary)]'
                  : 'border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[var(--primary-soft)] hover:text-black'
              )}
            >
              <span className="font-medium">{chip.label}</span>
              <span
                className={cn(
                  'flex h-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                  isActive
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--bg-subtle)] text-[var(--text)]'
                )}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
);
KpiChips.displayName = 'KpiChips';

export { KpiChips };
