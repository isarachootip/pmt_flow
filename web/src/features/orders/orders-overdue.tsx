import { toISODate } from '@/lib/date';
import { Job } from '@/features/jobs/api';
import { AlertCircle } from 'lucide-react';

/**
 * Returns current date in Asia/Bangkok timezone formatted as YYYY-MM-DD.
 */
export function getBangkokTodayISO(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  } catch {
    const now = new Date();
    const utc7 = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
    return `${utc7.getFullYear()}-${String(utc7.getMonth() + 1).padStart(2, '0')}-${String(utc7.getDate()).padStart(2, '0')}`;
  }
}

/**
 * Checks if a job has completed its lifecycle and should not be flagged as overdue.
 */
export function isJobClosedOrPassed(job: Job | any): boolean {
  if (!job) return false;
  if (job.stk_status === 'DELIVERED') return true;
  const s = String(job.status || '').toUpperCase();
  return (
    s === 'COMPLETED' ||
    s === 'PASSED' ||
    s === 'QC_PASSED' ||
    s === 'QC_PASS' ||
    s === 'CLOSED' ||
    s === 'CLOSEJOB' ||
    s === 'CANCELLED' ||
    s === 'REJECTED'
  );
}

/**
 * Extracts ISO date string (YYYY-MM-DD) from job appointment/plan fields.
 */
export function getJobAppointmentDateISO(job: Job | any): string | null {
  if (!job) return null;
  const raw = job.plan_date || job.appointment_date || job.survey_date || job.date;
  if (!raw) return null;
  return toISODate(raw) || null;
}

/**
 * Calculates number of overdue days in Asia/Bangkok timezone.
 * Returns positive integer if overdue, or null if on-time, future, unscheduled, or closed.
 */
export function getOverdueDays(job: Job | any, todayISO?: string): number | null {
  if (!job || isJobClosedOrPassed(job)) return null;
  const planISO = getJobAppointmentDateISO(job);
  if (!planISO) return null;

  const currentToday = todayISO || getBangkokTodayISO();
  if (planISO >= currentToday) return null;

  const [y1, m1, d1] = currentToday.split('-').map(Number);
  const [y2, m2, d2] = planISO.split('-').map(Number);
  const todayDate = new Date(Date.UTC(y1, m1 - 1, d1));
  const planDate = new Date(Date.UTC(y2, m2 - 1, d2));

  const diffMs = todayDate.getTime() - planDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : null;
}

/**
 * Prominent Overdue Badge component adhering strictly to Black font & WCAG AA standards.
 */
export function OverdueBadge({ days }: { days: number | null }) {
  if (!days || days <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 border border-rose-300 text-black whitespace-nowrap shadow-2xs shrink-0"
      title={`นัดหมายเลยกำหนดมาแล้ว ${days} วัน`}
    >
      <AlertCircle className="w-2.5 h-2.5 shrink-0 text-rose-600" />
      <span>เกิน {days} วัน</span>
    </span>
  );
}
