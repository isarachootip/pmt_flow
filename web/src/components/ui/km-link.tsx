import * as React from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KmLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  pageKey: string;
}

const KmLink = React.forwardRef<HTMLAnchorElement, KmLinkProps>(
  ({ pageKey, className, ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={`/km/${pageKey}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center justify-center rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-black',
          className
        )}
        title="คู่มือการใช้งาน (KM)"
        {...props}
      >
        <BookOpen className="h-8 w-8" />
        <span className="sr-only">คู่มือการใช้งาน (KM)</span>
      </a>
    );
  }
);
KmLink.displayName = 'KmLink';

export { KmLink };
