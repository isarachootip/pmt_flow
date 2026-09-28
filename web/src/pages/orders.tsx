import * as React from 'react';
import { useJobs, Job } from '@/features/jobs/api';
import { PageHeader } from '@/components/ui/page-header';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { formatDMY, toDateTime, toISODate, format24HourTimeBadge } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Search, Filter } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CreateJobDrawer } from '@/features/jobs/create-job-drawer';
import { isQuickJob, isRenovateJob } from '@/features/jobs/job-active-workspace';
import { toast } from 'sonner';

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobNo } = useParams<{ jobNo?: string }>();
  
  // State for search, date range filters, and create drawer
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
  const [startDate, setStartDate] = React.useState(''); // ISO YYYY-MM-DD
  const [endDate, setEndDate] = React.useState(''); // ISO YYYY-MM-DD
  const [showCreateDrawer, setShowCreateDrawer] = React.useState(false);

  // Toggle or set type filter and synchronize with URL search params
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

  /** Detect project type → 'Q' = Quick Service, 'R' = Renovate */
  const getJobType = (job: Job): 'Q' | 'R' | null => {
    if (!job) return null;
    if (isQuickJob(job)) return 'Q';
    if (isRenovateJob(job)) return 'R';
    const jNo = String(job.job_no || '').toUpperCase();
    const bNo = String(job.booking_no || (job as any).bookingNo || '').toUpperCase();
    if (jNo.startsWith('JOB-Q') || bNo.startsWith('BK-Q') || jNo.includes('-Q') || bNo.includes('-Q')) return 'Q';
    if (jNo.startsWith('JOB-R') || bNo.startsWith('BK-R') || jNo.includes('-R') || bNo.includes('-R')) return 'R';
    return null;
  };

  // Step 1: รับงาน strictly contains pending intake queue items awaiting acceptance.
  // Once accepted or moved to PLANNED/WAIT_QC, jobs move to Step 2 (Project & Gantt) or Step 3 (QC).
  // All closed/completed/delivered jobs belong in Step 4: ปิดงาน (/completed).
  const isJobClosed = (j: any) =>
    j.status === 'COMPLETED' ||
    j.status === 'PASSED' ||
    j.status === 'QC_PASSED' ||
    j.status === 'QC_PASS' ||
    j.status === 'CLOSED' ||
    j.status === 'CLOSEJOB' ||
    (j as any).stk_status === 'DELIVERED';

  const isStep1Queue = (j: any) => {
    // Strictly exclude accepted or moved jobs (no PLANNED, no WAIT_QC, no IN_PROGRESS, no closed)
    if ((j as any).pmt_accepted === true) return false;
    const st = String(j.status || '').toUpperCase();
    if (
      st === 'PLANNED' || 
      st === 'WAIT_QC' || 
      st === 'IN_PROGRESS' || 
      st === 'QC_PENDING' || 
      st === 'PASSED' ||
      st === 'ACCEPTED' ||
      isJobClosed(j)
    ) {
      return false;
    }
    return true;
  };

  // Fetch jobs defaulting to created_at descending, restricted to Step 1 queue
  const { data, isLoading } = useJobs({ 
    page: 1, 
    limit: 100, 
    sort_by: 'created_at', 
    sort_order: 'desc',
    step: 'step1'
  });
  const rawJobs: Job[] = Array.isArray(data) ? data : (data?.data || []);
  const allJobs: Job[] = React.useMemo(() => {
    return rawJobs.filter(j => isStep1Queue(j));
  }, [rawJobs]);

  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);

  // Sync selectedJob when jobs load or jobNo changes in URL
  React.useEffect(() => {
    if (jobNo && allJobs.length > 0) {
      const found = allJobs.find(j => j.job_no === jobNo || String(j.id) === jobNo);
      if (found) {
        setSelectedJob(found);
      }
    }
  }, [jobNo, allJobs]);

  const handleRowClick = (row: Job) => {
    setSelectedJob(row);
    if (row.job_no) {
      navigate(`/orders/${row.job_no}${location.search}`, { replace: true });
    }
  };



  // Job Type Counts (Quick vs Renovate) for Active Queue
  const typeCounts = React.useMemo(() => {
    const counts = { all: allJobs.length, Q: 0, R: 0 };
    for (const j of allJobs) {
      const jt = getJobType(j);
      if (jt === 'Q') counts.Q++;
      else if (jt === 'R') counts.R++;
    }
    return counts;
  }, [allJobs]);

  // Multi-Field Search + Date Range Filter + Job Type Filter + Creation Date Sorting
  const filteredAndSortedJobs = React.useMemo(() => {
    let result = [...allJobs];

    // 0.1 Job Type Filter (Quick vs Renovate)
    if (typeFilter !== 'all') {
      result = result.filter(j => getJobType(j) === typeFilter);
    }

    // 1. Multi-Field Search across Customer Name, Phone, Booking No, Ref ID, Job No, Tech, Services, Project Type
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

        // Check if every token in search query matches at least one field
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

    // 2. Date Range Filter (From Date - To Date)
    if (startDate || endDate) {
      const [from, to] = (startDate && endDate && startDate > endDate) ? [endDate, startDate] : [startDate, endDate];
      result = result.filter((job) => {
        const createdDate = job.created_at ? toISODate(job.created_at) : '';
        const planDateRaw = job.plan_date || (job as any).appointment_date || (job as any).date || (job as any).survey_date;
        const planDate = planDateRaw ? toISODate(planDateRaw) : '';
        
        const inCreatedRange = Boolean(createdDate && (!from || createdDate >= from) && (!to || createdDate <= to));
        const inPlanRange = Boolean(planDate && (!from || planDate >= from) && (!to || planDate <= to));

        // Matches if either created_at or plan_date falls within the selected range
        return inCreatedRange || inPlanRange;
      });
    }

    // 3. Default Sorting to system entry date (`created_at`) descending (latest records first)
    result.sort((a, b) => {
      const timeA = toDateTime(a.created_at)?.getTime() || 0;
      const timeB = toDateTime(b.created_at)?.getTime() || 0;
      if (timeA !== timeB) {
        return timeB - timeA; // latest records first
      }
      const numA = typeof a.id === 'number' ? a.id : (parseInt(String(a.id || '').replace(/\D/g, ''), 10) || 0);
      const numB = typeof b.id === 'number' ? b.id : (parseInt(String(b.id || '').replace(/\D/g, ''), 10) || 0);
      if (numA !== numB) {
        return numB - numA;
      }
      return String(b.job_no || b.id || '').localeCompare(String(a.job_no || a.id || ''));
    });

    return result;
  }, [allJobs, searchQuery, startDate, endDate, typeFilter]);

  const columns: ColumnDef<Job>[] = [
    { 
      id: 'project_type', 
      header: 'ประเภท', 
      width: 65, 
      minWidth: 55,
      cell: ({ row }) => {
        const jt = getJobType(row);
        if (jt === 'Q') return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 border border-blue-400 text-black whitespace-nowrap" title="Quick Service">
            Q
          </span>
        );
        if (jt === 'R') return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 border border-orange-400 text-black whitespace-nowrap" title="Renovate">
            R
          </span>
        );
        const raw = row.project_type || (row as any).job_type || '-';
        return <span className="text-black text-xs font-semibold whitespace-nowrap">{raw}</span>;
      }
    },
    { 
      id: 'job_no', 
      header: 'รหัสงาน', 
      width: 135,
      minWidth: 110,
      cell: ({ row }) => (
        <span className="font-semibold text-black font-mono whitespace-nowrap">{row.job_no}</span>
      )
    },
    { 
      id: 'customer_name', 
      header: 'ลูกค้า', 
      width: 165, 
      minWidth: 130,
      cell: ({ row }) => {
        const name = typeof row.customer === 'string' ? row.customer : (row.customer?.name || (row as any).customer_name || '-');
        return <span className="text-black font-semibold text-sm truncate block max-w-[155px]" title={name}>{name}</span>;
      } 
    },
    { 
      id: 'customer_phone', 
      header: 'เบอร์โทร', 
      width: 115, 
      minWidth: 100,
      cell: ({ row }) => {
        let phone = '-';
        if (typeof row.customer === 'object' && row.customer?.phone) phone = row.customer.phone;
        else if ((row as any).customer_phone) phone = (row as any).customer_phone;
        else if ((row as any).customerPhone) phone = (row as any).customerPhone;
        else if ((row as any).phone) phone = (row as any).phone;
        return <span className="text-black font-mono text-sm font-medium whitespace-nowrap">{phone}</span>;
      } 
    },
    { 
      id: 'booking_no', 
      header: 'Booking No', 
      width: 195, 
      minWidth: 175,
      cell: ({ row }) => {
        const val = row.booking_no || (row as any).bookingNo || (row as any).vfix_no;
        return val ? (
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-black font-semibold whitespace-nowrap block w-fit">
            {val}
          </span>
        ) : (
          <span className="text-black">-</span>
        );
      } 
    },
    { 
      id: 'ticket_no', 
      header: 'Ticket', 
      width: 90, 
      minWidth: 70,
      cell: ({ row }) => {
        const val = row.ticket_no || (row as any).ticketNo || (row as any).ticket_number;
        return val ? (
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-yellow-50 border border-yellow-300 text-black font-bold whitespace-nowrap">
            {val}
          </span>
        ) : (
          <span className="text-black">-</span>
        );
      } 
    },
    { 
      id: 'plan_date', 
      header: 'วันนัด', 
      width: 170, 
      minWidth: 150,
      cell: ({ row }) => {
        const rawDate = row.plan_date || (row as any).appointment_date || (row as any).survey_date || (row as any).date;
        if (!rawDate) {
          return <span className="text-black font-medium text-sm">-</span>;
        }
        const dateFormatted = formatDMY(rawDate);
        if (dateFormatted === '-') {
          return <span className="text-black font-medium text-sm">-</span>;
        }

        const rawTime = (row.plan_time || (row as any).time_slot || (row as any).schedule_plan?.time_slot || (row as any).survey_time || (row as any).time || (row as any).appointment_time || '') as string;
        const displayTime = format24HourTimeBadge(rawTime, rawDate);

        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-black font-medium text-sm">{dateFormatted}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-blue-50 border border-blue-200 text-black">
              {displayTime}
            </span>
          </div>
        );
      } 
    },
    { 
      id: 'store', 
      header: 'สาขา/Store', 
      width: 130, 
      minWidth: 105,
      cell: ({ row }) => {
        const branch = row.branch_name || (row as any).store?.name || (row as any).branch || '';
        const code = row.store_code || (row as any).store?.code || row.branch_code || '';
        const display = branch || code || '-';
        return (
          <span className="text-black text-sm truncate block max-w-[120px]" title={display}>
            {display}
          </span>
        );
      } 
    },
    { 
      id: 'services', 
      header: 'บริการ', 
      width: 190, 
      minWidth: 140,
      cell: ({ row }) => {
        const text = Array.isArray(row.services) ? row.services.join(', ') : (row.services || (row as any).project_sub_type || '-');
        return <div className="truncate max-w-[180px] text-black text-sm font-medium" title={text}>{text}</div>;
      } 
    },
    { 
      id: 'status', 
      header: 'สถานะ', 
      width: 180, 
      minWidth: 160,
      cell: ({ row }) => {
        const isStkDelivered = (row as any).stk_status === 'DELIVERED' || row.status === 'CLOSED' || row.status === 'CLOSEJOB';
        return <StatusBadge status={isStkDelivered ? 'CLOSEJOB' : (row.status === 'QC_PENDING' ? 'PENDING' : row.status)} />;
      } 
    },
  ];

  const handleExportCSV = () => {
    if (filteredAndSortedJobs.length === 0) {
      toast.info('ไม่มีข้อมูลให้ส่งออก');
      return;
    }
    const headers = ['รหัสงาน', 'Booking No', 'Ref ID', 'ลูกค้า', 'เบอร์โทร', 'บริการ', 'ประเภท', 'วันนัด', 'สถานะ', 'ยอดสุทธิ', 'ช่าง'];
    const rows = filteredAndSortedJobs.map(j => {
      const custName = typeof j.customer === 'string' ? j.customer : (j.customer?.name || (j as any).customer_name || '-');
      const custPhone = typeof j.customer === 'object' && j.customer?.phone ? j.customer.phone : ((j as any).customer_phone || (j as any).phone || '-');
      const bookingNo = j.booking_no || (j as any).bookingNo || (j as any).vfix_no || '-';
      const refId = j.external_ref_id || (j as any).ref_id || (j as any).stk_ref || '-';
      const rawDate = j.plan_date || (j as any).appointment_date || (j as any).survey_date || (j as any).date;
      let appointmentCol = '-';
      if (rawDate) {
        const dateFormatted = formatDMY(rawDate);
        if (dateFormatted !== '-') {
          const rawTime = (j.plan_time || (j as any).time_slot || (j as any).survey_time || (j as any).time || (j as any).appointment_time || '') as string;
          const timeBadge = format24HourTimeBadge(rawTime, rawDate);
          appointmentCol = `${dateFormatted} ${timeBadge}`;
        }
      }
      const services = Array.isArray(j.services) ? j.services.join('; ') : (j.services || '-');
      const amt = Number(j.grand_total || (j as any).boq_grand_total || 0);

      return [
        `"${String(j.job_no || j.id || '').replace(/"/g, '""')}"`,
        `"${String(bookingNo).replace(/"/g, '""')}"`,
        `"${String(refId).replace(/"/g, '""')}"`,
        `"${String(custName).replace(/"/g, '""')}"`,
        `"${String(custPhone).replace(/"/g, '""')}"`,
        `"${String(services).replace(/"/g, '""')}"`,
        `"${String(j.project_type || '').replace(/"/g, '""')}"`,
        `"${appointmentCol}"`,
        `"${String(j.status || '').replace(/"/g, '""')}"`,
        `"${amt.toFixed(2)}"`,
        `"${String(j.assigned_tech || '-').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    if (typeof window !== 'undefined' && typeof window.URL?.createObjectURL === 'function') {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.setAttribute('download', `orders_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      try {
        link.dispatchEvent(new MouseEvent('click'));
      } catch {
        // Ignored in test environment
      }
      document.body.removeChild(link);
    }
    toast.success('ส่งออกข้อมูลสำเร็จ');
  };

  const actions = (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={handleExportCSV} className="text-black font-medium">ส่งออก</Button>
      <Button variant="primary" onClick={() => setShowCreateDrawer(true)} className="text-black font-medium">+ สร้างงาน</Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="รับงาน & คิวงาน" pageKey="orders" actions={actions} />
      
      {/* Job Type Filter (Quick vs Renovate) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-3 border-b border-soft">
        <div className="flex items-center gap-1.5 bg-gray-50/90 p-1 rounded-xl border border-gray-300 shadow-2xs">
          <span className="text-xs font-bold text-black px-2 hidden sm:inline-flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-black" />
            <span>ประเภทงาน:</span>
          </span>

          {/* ทั้งหมด */}
          <button
            type="button"
            onClick={() => handleTypeFilterChange('all')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-gray-900 text-white shadow-xs font-bold'
                : 'bg-white text-black border border-gray-300 hover:bg-gray-100 hover:border-gray-400'
            }`}
          >
            <span>ทั้งหมด</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                typeFilter === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-200 text-black'
              }`}
            >
              {typeCounts.all}
            </span>
          </button>

          {/* งาน Quick (Q) */}
          <button
            type="button"
            onClick={() => handleTypeFilterChange('Q')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === 'Q'
                ? 'bg-blue-600 text-white shadow-xs font-bold border border-blue-700'
                : 'bg-white text-black border border-gray-300 hover:bg-blue-50/70 hover:border-blue-300'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                typeFilter === 'Q'
                  ? 'bg-blue-800 text-white border border-blue-400'
                  : 'bg-blue-100 text-blue-900 border border-blue-300'
              }`}
            >
              Q
            </span>
            <span>งาน Quick</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                typeFilter === 'Q'
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-200 text-black'
              }`}
            >
              {typeCounts.Q}
            </span>
          </button>

          {/* งาน Renovate (R) */}
          <button
            type="button"
            onClick={() => handleTypeFilterChange('R')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === 'R'
                ? 'bg-orange-600 text-white shadow-xs font-bold border border-orange-700'
                : 'bg-white text-black border border-gray-300 hover:bg-orange-50/70 hover:border-orange-300'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                typeFilter === 'R'
                  ? 'bg-orange-800 text-white border border-orange-400'
                  : 'bg-orange-100 text-orange-900 border border-orange-300'
              }`}
            >
              R
            </span>
            <span>งาน Renovate</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                typeFilter === 'R'
                  ? 'bg-orange-700 text-white'
                  : 'bg-gray-200 text-black'
              }`}
            >
              {typeCounts.R}
            </span>
          </button>
        </div>

      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-1">
        <div className="flex flex-wrap items-center gap-3">
          {/* Multi-field search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (ลูกค้า, เบอร์โทร, Booking, Ref ID)..."
              className="pl-9 h-9 text-sm text-black placeholder:text-gray-500 bg-white border-gray-300"
            />
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-black whitespace-nowrap">ช่วงวันที่:</span>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              className="bg-white"
            />
          </div>

          {/* Reset button if filter is active */}
          {(searchQuery || startDate || endDate || typeFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
                handleTypeFilterChange('all');
              }}
              className="h-9 text-xs text-black font-medium hover:bg-gray-100"
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>

        {/* Counter badge */}
        <div className="text-xs text-black font-medium">
          แสดง <span className="font-bold text-black">{filteredAndSortedJobs.length}</span> จากทั้งหมด <span className="font-bold text-black">{allJobs.length}</span> รายการ
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="orders"
          masterContent={
            <DataGrid
              columns={columns}
              data={filteredAndSortedJobs}
              isLoading={isLoading}
              getRowId={(row) => String(row.id || row.job_no)}
              onRowSelect={handleRowClick}
              selectedRowId={selectedJob ? String(selectedJob.id || selectedJob.job_no) : undefined}
            />
          }
          detailContent={
            selectedJob ? (
              <div className="flex flex-col h-full overflow-hidden">

                <div className="flex-1 min-h-0">
                  <JobDetailTabs 
                    job={selectedJob} 
                    onClose={() => {
                      setSelectedJob(null);
                      navigate(`/orders${location.search}`, { replace: true });
                    }} 
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-black bg-card border border-soft rounded-xl shadow-card font-medium">
                เลือกรายการเพื่อดูรายละเอียด
              </div>
            )
          }
        />
      </div>

      {/* Create Job Drawer */}
      <CreateJobDrawer
        open={showCreateDrawer}
        onOpenChange={setShowCreateDrawer}
      />
    </div>
  );
}
