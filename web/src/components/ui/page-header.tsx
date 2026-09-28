import * as React from 'react';
import { cn } from '@/lib/utils';
import { KmLink } from './km-link';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  pageKey?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, pageKey, actions, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-[var(--bg-subtle)] to-white px-3 py-1.5 border-b border-[var(--border-soft)] rounded-lg shrink-0',
          className
        )}
        {...props}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-bold text-black leading-tight">{title}</h1>
            {pageKey && <KmLink pageKey={pageKey} />}
          </div>
          {children}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    );
  }
);
PageHeader.displayName = 'PageHeader';

export { PageHeader };
