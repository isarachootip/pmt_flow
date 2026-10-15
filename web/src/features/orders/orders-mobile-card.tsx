import { Job } from '@/features/jobs/api';
import { formatDMY, format24HourTimeBadge } from '@/lib/date';
import { Phone, Calendar, Store, Wrench, Inbox } from 'lucide-react';
import { OrderStatusPill } from './orders-status-pill';
import { getOverdueDays, OverdueBadge } from './orders-overdue';
import { getJobType } from './orders-columns';

export interface OrderMobileCardProps {
  job: Job;
  onClick: (job: Job) => void;
}

export function OrderMobileCard({ job, onClick }: OrderMobileCardProps) {
  const jt = getJobType(job);
  const bookingNo = job.booking_no || (job as any).bookingNo || (job as any).vfix_no;
  const customerName = typeof job.customer === 'string'
    ? job.customer
    : (job.customer?.name || (job as any).customer_name || '-');
  
  let rawPhone = '';
  if (typeof job.customer === 'object' && job.customer?.phone) rawPhone = job.customer.phone;
  else if ((job as any).customer_phone) rawPhone = (job as any).customer_phone;
  else if ((job as any).customerPhone) rawPhone = (job as any).customerPhone;
  else if ((job as any).phone) rawPhone = (job as any).phone;
  const cleanPhone = rawPhone.replace(/[\s\-\(\)]/g, '');

  const rawDate = job.plan_date || (job as any).appointment_date || (job as any).survey_date || (job as any).date;
  const dateFormatted = rawDate ? formatDMY(rawDate) : null;
  const rawTime = (job.plan_time || (job as any).time_slot || (job as any).schedule_plan?.time_slot || (job as any).survey_time || (job as any).time || (job as any).appointment_time || '') as string;
  const displayTime = rawDate && dateFormatted && dateFormatted !== '-' ? format24HourTimeBadge(rawTime, rawDate) : null;
  const overdueDays = getOverdueDays(job);

  const storeDisplay = job.branch_name || (job as any).store?.name || (job as any).branch || job.store_code || '';
  const servicesText = Array.isArray(job.services)
    ? job.services.join(', ')
    : (job.services || (job as any).project_sub_type || '');

  return (
    <div
      onClick={() => onClick(job)}
      className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-blue-400 hover:shadow-xs active:bg-blue-50/30 transition-all cursor-pointer flex flex-col gap-2.5"
    >
      {/* Top Row: Type Pill + Job No + Status Pill */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {jt === 'Q' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 border border-blue-400 text-black shrink-0" title="Quick Service">
              Q
            </span>
          ) : jt === 'R' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 border border-orange-400 text-black shrink-0" title="Renovate">
              R
            </span>
          ) : null}
          <span className="font-bold text-black font-mono text-sm truncate">
            {job.job_no}
          </span>
        </div>
        <div className="shrink-0">
          <OrderStatusPill status={job.status} />
        </div>
      </div>

      {/* Booking & Ticket Bar */}
      {bookingNo && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 text-black font-semibold">
            BK: {bookingNo}
          </span>
          {job.ticket_no && (
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-yellow-50 border border-yellow-300 text-black font-bold">
              Ticket: {job.ticket_no}
            </span>
          )}
        </div>
      )}

      {/* Customer & Call Action */}
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
        <div className="min-w-0">
          <div className="font-bold text-black text-sm truncate" title={customerName}>
            {customerName}
          </div>
          {rawPhone && (
            <div className="text-xs font-mono text-black font-medium">
              {rawPhone}
            </div>
          )}
        </div>
        {cleanPhone && (
          <a
            href={`tel:${cleanPhone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 border border-green-300 text-black hover:bg-green-100 transition-colors shrink-0"
            title="โทรหาลูกค้า"
          >
            <Phone className="h-3.5 w-3.5 text-green-700" />
            <span>โทร</span>
          </a>
        )}
      </div>

      {/* Appointment & Overdue */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-gray-100 pt-2 text-xs">
        <div className="flex items-center gap-1 text-black font-medium">
          <Calendar className="h-3.5 w-3.5 text-gray-500 shrink-0" />
          {dateFormatted && dateFormatted !== '-' ? (
            <div className="flex items-center gap-1">
              <span className="font-semibold text-black">{dateFormatted}</span>
              {displayTime && (
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-blue-50 border border-blue-200 text-black font-bold">
                  {displayTime}
                </span>
              )}
            </div>
          ) : (
            <span className="text-black">-</span>
          )}
        </div>
        {overdueDays ? <OverdueBadge days={overdueDays} /> : null}
      </div>

      {/* Store & Services */}
      {(storeDisplay || servicesText) && (
        <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 text-xs text-black">
          {storeDisplay && (
            <div className="flex items-center gap-1 truncate font-medium">
              <Store className="h-3.5 w-3.5 text-gray-500 shrink-0" />
              <span className="truncate">{storeDisplay}</span>
            </div>
          )}
          {servicesText && (
            <div className="flex items-center gap-1 truncate font-medium">
              <Wrench className="h-3.5 w-3.5 text-gray-500 shrink-0" />
              <span className="truncate">{servicesText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface OrdersMobileCardListProps {
  jobs: Job[];
  isLoading?: boolean;
  onSelect: (job: Job) => void;
}

export function OrdersMobileCardList({ jobs, isLoading, onSelect }: OrdersMobileCardListProps) {
  if (isLoading) {
    return (
      <div className="p-3 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-gray-200 rounded-xl bg-white m-3">
        <Inbox className="h-10 w-10 text-gray-300 mb-2" />
        <p className="text-black font-semibold text-sm">ไม่มีรายการในคิว</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 overflow-y-auto max-h-full">
      {jobs.map(job => (
        <OrderMobileCard key={job.id || job.job_no} job={job} onClick={onSelect} />
      ))}
    </div>
  );
}
