import * as React from 'react';
import { cn } from '@/lib/utils';

export type StatusValue =
  | 'PENDING'
  | 'NEW'
  | 'ACCEPTED'
  | 'NEED_REVIEW'
  | 'WAIT_QC'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'PASSED'
  | 'QC_PASS'
  | 'QC_PASSED'
  | 'REWORK'
  | 'ESCALATED'
  | 'OPEN'
  | 'COMPLETED'
  | 'CLOSED'
  | 'SENT'
  | 'SYNC_FAILED'
  | 'SURVEYED'
  | 'DESIGNING'
  | 'BOQ'
  | 'DONE'
  | 'OVERDUE'
  | 'FAIL'
  | 'REJECTED'
  | 'DRAFT'
  | 'CANCELLED'
  | string;

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusValue;
  label?: string;
}

const getStatusColor = (status: string) => {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'NEW':
    case 'PENDING':
    case 'SURVEYED':
      return 'bg-[var(--st-pending)]';
    case 'ACCEPTED':
    case 'IN_PROGRESS':
    case 'DESIGNING':
    case 'BOQ':
    case 'OPEN':
      return 'bg-[var(--st-progress)]';
    case 'WAIT_QC':
      return 'bg-amber-500';
    case 'PLANNED':
      return 'bg-blue-600';
    case 'NEED_REVIEW':
      return 'bg-purple-600';
    case 'PASSED':
    case 'QC_PASS':
    case 'QC_PASSED':
    case 'DONE':
    case 'COMPLETED':
    case 'CLOSED':
    case 'CLOSEJOB':
    case 'CLOSEJOB(ส่ง STK แล้ว)':
    case 'DELIVERED':
    case 'SENT':
      return 'bg-[var(--st-done)]';
    case 'REWORK':
      return 'bg-[var(--st-rework)]';
    case 'ESCALATED':
    case 'OVERDUE':
    case 'FAIL':
    case 'REJECTED':
    case 'SYNC_FAILED':
      return 'bg-[var(--st-overdue)]';
    case 'DRAFT':
    case 'CANCELLED':
    default:
      return 'bg-[var(--st-neutral)]';
  }
};

const getStatusDefaultLabel = (status: string): string => {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'NEW':
      return 'รอรับงาน (NEW)';
    case 'ACCEPTED':
      return 'รับงานแล้ว (ACCEPTED)';
    case 'NEED_REVIEW':
      return 'รอระบุประเภท (NEED_REVIEW)';
    case 'WAIT_QC':
      return 'รอตรวจ QC (WAIT_QC)';
    case 'PLANNED':
      return 'วางแผนงาน (PLANNED)';
    case 'IN_PROGRESS':
      return 'กำลังดำเนินการ';
    case 'PASSED':
    case 'QC_PASSED':
    case 'QC_PASS':
      return 'ผ่าน QC';
    case 'REWORK':
      return 'ส่งกลับแก้ไข (REWORK)';
    case 'ESCALATED':
      return 'ส่งต่อผู้บริหาร (ESCALATED)';
    case 'COMPLETED':
      return 'ปิดงานเรียบร้อย (COMPLETED)';
    case 'CLOSED':
    case 'CLOSEJOB':
    case 'CLOSEJOB(ส่ง STK แล้ว)':
    case 'DELIVERED':
    case 'SENT':
      return 'closejob(ส่ง stk แล้ว)';
    case 'SYNC_FAILED':
      return 'ส่ง STK ล้มเหลว';
    case 'DRAFT':
      return 'ร่าง (DRAFT)';
    case 'CANCELLED':
      return 'ยกเลิก';
    default:
      return status;
  }
};

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ status, label, className, ...props }, ref) => {
    const displayLabel = label || getStatusDefaultLabel(status);
    return (
      <div
        ref={ref}
        className={cn('inline-flex items-center gap-2', className)}
        {...props}
      >
        <span
          className={cn('h-2 w-2 rounded-full shrink-0', getStatusColor(status))}
          aria-hidden="true"
        />
        <span className="text-[13px] font-semibold text-black whitespace-nowrap">
          {displayLabel}
        </span>
      </div>
    );
  }
);
StatusBadge.displayName = 'StatusBadge';

export { StatusBadge };
