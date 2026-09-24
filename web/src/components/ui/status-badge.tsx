import * as React from 'react';
import { cn } from '@/lib/utils';

export type StatusValue =
  | 'PENDING'
  | 'NEW'
  | 'SURVEYED'
  | 'IN_PROGRESS'
  | 'DESIGNING'
  | 'BOQ'
  | 'DONE'
  | 'QC_PASS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'OVERDUE'
  | 'FAIL'
  | 'REJECTED'
  | 'REWORK'
  | 'DRAFT'
  | 'CANCELLED';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusValue;
  label?: string;
}

const getStatusColor = (status: StatusValue) => {
  switch (status) {
    case 'PENDING':
    case 'NEW':
    case 'SURVEYED':
      return 'bg-[var(--st-pending)]';
    case 'IN_PROGRESS':
    case 'DESIGNING':
    case 'BOQ':
      return 'bg-[var(--st-progress)]';
    case 'DONE':
    case 'QC_PASS':
    case 'COMPLETED':
    case 'CLOSED':
      return 'bg-[var(--st-done)]';
    case 'OVERDUE':
    case 'FAIL':
    case 'REJECTED':
      return 'bg-[var(--st-overdue)]';
    case 'REWORK':
      return 'bg-[var(--st-rework)]';
    case 'DRAFT':
    case 'CANCELLED':
    default:
      return 'bg-[var(--st-neutral)]';
  }
};

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ status, label, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('inline-flex items-center gap-2', className)}
        {...props}
      >
        <span
          className={cn('h-2 w-2 rounded-full', getStatusColor(status))}
          aria-hidden="true"
        />
        <span className="text-[14px] font-medium text-black">
          {label || status}
        </span>
      </div>
    );
  }
);
StatusBadge.displayName = 'StatusBadge';

export { StatusBadge };
