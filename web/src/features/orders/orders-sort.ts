import { Job } from '@/features/jobs/api';
import { toDateTime, toISODate } from '@/lib/date';

/**
 * Sorts jobs by specified column and direction.
 * Defaults to earliest appointment date ascending with unscheduled jobs at the bottom.
 */
export function sortOrdersJobs(
  jobs: Job[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): Job[] {
  const sorted = [...jobs];
  const dir = sortDirection === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    if (sortField === 'plan_date') {
      const rawDateA = a.plan_date || (a as any).appointment_date || (a as any).survey_date || (a as any).date;
      const rawDateB = b.plan_date || (b as any).appointment_date || (b as any).survey_date || (b as any).date;
      const isoA = rawDateA ? toISODate(rawDateA) : '';
      const isoB = rawDateB ? toISODate(rawDateB) : '';

      // Missing appointment dates go to the bottom when sorting ascending
      if (!isoA && !isoB) return 0;
      if (!isoA) return 1;
      if (!isoB) return -1;

      if (isoA !== isoB) {
        return isoA.localeCompare(isoB) * dir;
      }

      // Secondary sort: appointment time
      const timeA = String(a.plan_time || (a as any).time_slot || '');
      const timeB = String(b.plan_time || (b as any).time_slot || '');
      if (timeA !== timeB) {
        return timeA.localeCompare(timeB) * dir;
      }

      // Tertiary sort: created_at desc
      const createdA = toDateTime(a.created_at)?.getTime() || 0;
      const createdB = toDateTime(b.created_at)?.getTime() || 0;
      return createdB - createdA;
    }

    if (sortField === 'job_no') {
      const noA = String(a.job_no || a.id || '');
      const noB = String(b.job_no || b.id || '');
      return noA.localeCompare(noB) * dir;
    }

    if (sortField === 'customer') {
      const nameA = String(typeof a.customer === 'string' ? a.customer : (a.customer?.name || (a as any).customer_name || ''));
      const nameB = String(typeof b.customer === 'string' ? b.customer : (b.customer?.name || (b as any).customer_name || ''));
      return nameA.localeCompare(nameB) * dir;
    }

    if (sortField === 'status') {
      const stA = String(a.status || '');
      const stB = String(b.status || '');
      return stA.localeCompare(stB) * dir;
    }

    if (sortField === 'store') {
      const stA = String(a.branch_name || (a as any).store?.name || a.store_code || '');
      const stB = String(b.branch_name || (b as any).store?.name || b.store_code || '');
      return stA.localeCompare(stB) * dir;
    }

    if (sortField === 'created_at') {
      const cA = toDateTime(a.created_at)?.getTime() || 0;
      const cB = toDateTime(b.created_at)?.getTime() || 0;
      return (cA - cB) * dir;
    }

    return 0;
  });

  return sorted;
}
