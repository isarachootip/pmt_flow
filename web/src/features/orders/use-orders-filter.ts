import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Job } from '@/features/jobs/api';
import { toISODate } from '@/lib/date';
import { getJobType } from './orders-columns';
import { sortOrdersJobs } from './orders-sort';

export function useOrdersFilter(allJobs: Job[]) {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'Q' | 'R'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('type')?.toUpperCase();
      if (t === 'Q' || t === 'QUICK') return 'Q';
      if (t === 'R' || t === 'RENOVATE') return 'R';
    }
    return 'all';
  });

  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [sortField, setSortField] = React.useState<string>('plan_date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const handleTypeFilterChange = (newType: 'all' | 'Q' | 'R') => {
    const targetType = typeFilter === newType && newType !== 'all' ? 'all' : newType;
    setTypeFilter(targetType);
    const params = new URLSearchParams(location.search);
    if (targetType === 'all') {
      params.delete('type');
    } else {
      params.set('type', targetType);
    }
    const search = params.toString() ? `?${params.toString()}` : '';
    navigate(`${location.pathname}${search}`, { replace: true });
  };

  const handleSort = (colId: string) => {
    if (sortField === colId) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(colId);
      setSortDirection(colId === 'created_at' ? 'desc' : 'asc');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    handleTypeFilterChange('all');
  };

  const isFilterActive = Boolean(searchQuery || startDate || endDate || typeFilter !== 'all');

  const typeCounts = React.useMemo(() => {
    const counts = { all: allJobs.length, Q: 0, R: 0 };
    for (const j of allJobs) {
      const jt = getJobType(j);
      if (jt === 'Q') counts.Q++;
      else if (jt === 'R') counts.R++;
    }
    return counts;
  }, [allJobs]);

  const filteredAndSortedJobs = React.useMemo(() => {
    let result = [...allJobs];

    if (typeFilter !== 'all') {
      result = result.filter(j => getJobType(j) === typeFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      result = result.filter((job) => {
        const custName = String(
          typeof job.customer === 'string'
            ? job.customer
            : (job.customer?.name || (job as any).customer_name || (job as any).customerName || '')
        ).toLowerCase();

        const rawPhone = String(
          typeof job.customer === 'object' && job.customer?.phone
            ? job.customer.phone
            : ((job as any).customer_phone || (job as any).customerPhone || (job as any).phone || '')
        );
        const custPhone = rawPhone.toLowerCase();
        const cleanPhone = custPhone.replace(/[\s\-\(\)\+]/g, '');

        const bookingNo = String(job.booking_no || (job as any).bookingNo || (job as any).vfix_no || '').toLowerCase();
        const cleanBookingNo = bookingNo.replace(/[\s\-\_\/]/g, '');

        const refId = String(job.external_ref_id || (job as any).ref_id || (job as any).stk_ref || (job as any).externalRefId || '').toLowerCase();
        const cleanRefId = refId.replace(/[\s\-\_\/]/g, '');

        const jobNoStr = String(job.job_no || job.id || '').toLowerCase();
        const cleanJobNo = jobNoStr.replace(/[\s\-\_\/]/g, '');

        const techName = String(job.assigned_tech || '').toLowerCase();
        const servicesStr = Array.isArray(job.services)
          ? job.services.join(' ').toLowerCase()
          : String(job.services || (job as any).project_sub_type || '').toLowerCase();
        const projectTypeStr = String(job.project_type || (job as any).job_type || '').toLowerCase();

        return terms.every(term => {
          const cleanTerm = term.replace(/[\s\-\_\/\(\)\+]/g, '');
          return (
            custName.includes(term) ||
            custPhone.includes(term) ||
            (cleanTerm && cleanPhone.includes(cleanTerm)) ||
            bookingNo.includes(term) ||
            (cleanTerm && cleanBookingNo.includes(cleanTerm)) ||
            refId.includes(term) ||
            (cleanTerm && cleanRefId.includes(cleanTerm)) ||
            jobNoStr.includes(term) ||
            (cleanTerm && cleanJobNo.includes(cleanTerm)) ||
            techName.includes(term) ||
            servicesStr.includes(term) ||
            projectTypeStr.includes(term)
          );
        });
      });
    }

    if (startDate || endDate) {
      const [from, to] = (startDate && endDate && startDate > endDate) ? [endDate, startDate] : [startDate, endDate];
      result = result.filter((job) => {
        const createdDate = job.created_at ? toISODate(job.created_at) : '';
        const planDateRaw = job.plan_date || (job as any).appointment_date || (job as any).date || (job as any).survey_date;
        const planDate = planDateRaw ? toISODate(planDateRaw) : '';
        const inCreatedRange = Boolean(createdDate && (!from || createdDate >= from) && (!to || createdDate <= to));
        const inPlanRange = Boolean(planDate && (!from || planDate >= from) && (!to || planDate <= to));
        return inCreatedRange || inPlanRange;
      });
    }

    return sortOrdersJobs(result, sortField, sortDirection);
  }, [allJobs, searchQuery, startDate, endDate, typeFilter, sortField, sortDirection]);

  return {
    searchQuery,
    setSearchQuery,
    typeFilter,
    handleTypeFilterChange,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    sortField,
    sortDirection,
    handleSort,
    resetFilters,
    isFilterActive,
    typeCounts,
    filteredAndSortedJobs
  };
}
