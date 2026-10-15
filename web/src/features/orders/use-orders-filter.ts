import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Job } from '@/features/jobs/api';
import { toISODate } from '@/lib/date';
import { getJobType } from './orders-columns';
import { sortOrdersJobs } from './orders-sort';
import { getOverdueDays } from './orders-overdue';
import { OrdersStatusFilter, StatusCounts } from './orders-status-chips';
import { DatePreset, getPresetDateRange } from './orders-date-presets';

export function useOrdersFilter(allJobs: Job[]) {
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize from URL search params
  const [searchQuery, setSearchQuery] = React.useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('q') || '';
  });

  const [typeFilter, setTypeFilter] = React.useState<'all' | 'Q' | 'R'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('type')?.toUpperCase();
      if (t === 'Q' || t === 'QUICK') return 'Q';
      if (t === 'R' || t === 'RENOVATE') return 'R';
    }
    return 'all';
  });

  const [statusFilter, setStatusFilter] = React.useState<OrdersStatusFilter>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('status')?.toUpperCase();
      if (s === 'NEW') return 'NEW';
      if (s === 'SURVEYED') return 'SURVEYED';
      if (s === 'OVERDUE') return 'OVERDUE';
    }
    return 'all';
  });

  const [datePreset, setDatePreset] = React.useState<DatePreset>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('preset') as DatePreset;
      if (p === 'today' || p === '7d' || p === 'this_month') return p;
    }
    return 'all';
  });

  const [startDate, setStartDate] = React.useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('start_date') || '';
  });

  const [endDate, setEndDate] = React.useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('end_date') || '';
  });

  const [sortField, setSortField] = React.useState<string>(() => {
    if (typeof window === 'undefined') return 'plan_date';
    return new URLSearchParams(window.location.search).get('sort') || 'plan_date';
  });

  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>(() => {
    if (typeof window === 'undefined') return 'asc';
    const d = new URLSearchParams(window.location.search).get('dir');
    return d === 'desc' ? 'desc' : 'asc';
  });

  // Sync state changes with URL query string
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);

    // Search query
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    else params.delete('q');

    // Type filter
    if (typeFilter !== 'all') params.set('type', typeFilter);
    else params.delete('type');

    // Status filter
    if (statusFilter !== 'all') params.set('status', statusFilter);
    else params.delete('status');

    // Date preset & dates
    if (datePreset !== 'all' && datePreset !== 'custom') params.set('preset', datePreset);
    else params.delete('preset');

    if (startDate) params.set('start_date', startDate);
    else params.delete('start_date');

    if (endDate) params.set('end_date', endDate);
    else params.delete('end_date');

    // Sorting
    if (sortField && sortField !== 'plan_date') params.set('sort', sortField);
    else params.delete('sort');

    if (sortDirection && sortDirection !== 'asc') params.set('dir', sortDirection);
    else params.delete('dir');

    const newSearch = params.toString() ? `?${params.toString()}` : '';
    if (location.search !== newSearch) {
      navigate(`${location.pathname}${newSearch}`, { replace: true });
    }
  }, [searchQuery, typeFilter, statusFilter, datePreset, startDate, endDate, sortField, sortDirection]);

  const handleTypeFilterChange = (newType: 'all' | 'Q' | 'R') => {
    const targetType = typeFilter === newType && newType !== 'all' ? 'all' : newType;
    setTypeFilter(targetType);
  };

  const handleStatusFilterChange = (newStatus: OrdersStatusFilter) => {
    const targetStatus = statusFilter === newStatus && newStatus !== 'all' ? 'all' : newStatus;
    setStatusFilter(targetStatus);
  };

  const handleSelectDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const range = getPresetDateRange(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const handleCustomStartDateChange = (val: string) => {
    setDatePreset('custom');
    setStartDate(val);
  };

  const handleCustomEndDateChange = (val: string) => {
    setDatePreset('custom');
    setEndDate(val);
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
    setDatePreset('all');
    setTypeFilter('all');
    setStatusFilter('all');
  };

  const isFilterActive = Boolean(
    searchQuery || startDate || endDate || typeFilter !== 'all' || statusFilter !== 'all'
  );

  // Status counts across all jobs
  const statusCounts: StatusCounts = React.useMemo(() => {
    let newCount = 0;
    let surveyedCount = 0;
    let overdueCount = 0;

    for (const j of allJobs) {
      const s = String(j.status || '').toUpperCase();
      if (s === 'NEW' || s === 'WAIT_ACCEPT') newCount++;
      else if (s === 'SURVEYED' || s === 'IN_SURVEY' || s === 'DESIGNING' || s === 'BOQ') surveyedCount++;

      const overdue = getOverdueDays(j);
      if (overdue && overdue > 0) overdueCount++;
    }

    return {
      all: allJobs.length,
      newCount,
      surveyedCount,
      overdueCount
    };
  }, [allJobs]);

  const typeCounts = React.useMemo(() => {
    const counts = { all: allJobs.length, Q: 0, R: 0 };
    for (const j of allJobs) {
      const jt = getJobType(j);
      if (jt === 'Q') counts.Q++;
      else if (jt === 'R') counts.R++;
    }
    return counts;
  }, [allJobs]);

  // Filtering + Sorting
  const filteredAndSortedJobs = React.useMemo(() => {
    let result = [...allJobs];

    // Job Type filter
    if (typeFilter !== 'all') {
      result = result.filter(j => getJobType(j) === typeFilter);
    }

    // Status filter
    if (statusFilter === 'NEW') {
      result = result.filter(j => {
        const s = String(j.status || '').toUpperCase();
        return s === 'NEW' || s === 'WAIT_ACCEPT';
      });
    } else if (statusFilter === 'SURVEYED') {
      result = result.filter(j => {
        const s = String(j.status || '').toUpperCase();
        return s === 'SURVEYED' || s === 'IN_SURVEY' || s === 'DESIGNING' || s === 'BOQ';
      });
    } else if (statusFilter === 'OVERDUE') {
      result = result.filter(j => {
        const days = getOverdueDays(j);
        return Boolean(days && days > 0);
      });
    }

    // Multi-token Search
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

    // Date Range Filter
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
  }, [allJobs, searchQuery, startDate, endDate, typeFilter, statusFilter, sortField, sortDirection]);

  return {
    searchQuery,
    setSearchQuery,
    typeFilter,
    handleTypeFilterChange,
    statusFilter,
    handleStatusFilterChange,
    datePreset,
    handleSelectDatePreset,
    startDate,
    handleCustomStartDateChange,
    endDate,
    handleCustomEndDateChange,
    sortField,
    sortDirection,
    handleSort,
    resetFilters,
    isFilterActive,
    typeCounts,
    statusCounts,
    filteredAndSortedJobs
  };
}
