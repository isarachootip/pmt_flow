import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  clickable?: boolean;
}

const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  ({ label, value, clickable, className, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          'flex flex-col p-5',
          clickable &&
            'cursor-pointer transition-shadow hover:shadow-[var(--shadow-hover)]',
          className
        )}
        {...props}
      >
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">
          {label}
        </span>
        <span className="mt-1 text-[28px] font-semibold text-black">
          {value}
        </span>
      </Card>
    );
  }
);
KpiCard.displayName = 'KpiCard';

export { KpiCard };
