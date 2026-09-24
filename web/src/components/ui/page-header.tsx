import * as React from 'react';
import { cn } from '@/lib/utils';
import { KmLink } from './km-link';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  pageKey?: string;
  actions?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, pageKey, actions, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between bg-gradient-to-r from-[var(--bg-subtle)] to-white px-6 py-4 border-b border-[var(--border-soft)]',
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-black">{title}</h1>
          {pageKey && <KmLink pageKey={pageKey} />}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    );
  }
);
PageHeader.displayName = 'PageHeader';

export { PageHeader };
