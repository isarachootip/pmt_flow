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
import { Search } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CreateJobDrawer } from '@/features/jobs/create-job-drawer';
import { isRenovateJob } from '@/features/jobs/job-active-workspace';
import { toast } from 'sonner';

export default function GanttPage() {
  const navigate = useNavigate();
  const { jobNo: paramJobNo } = useParams<{ jobNo?: string }>();
  const [searchParams] = useSearchParams();

  // Search and date range filter states
  const [searchQuery, setSearchQuery] = React.useState('');
  const [startDate, setStartDate] = React.useState(''); // ISO YYYY-MM-DD
  const [endDate, setEndDate] = React.useState(''); // ISO YYYY-MM-DD
  const [showCreateDrawer, setShowCreateDrawer] = React.useState(false);

  /** Detect project type → 'Q' = Quick Service, 'R' = Renovate */
  const getJobType = (job: Job): 'Q' | 'R' | null => {
    if (!job) return null;
    if (isRenovateJob(job)) return 'R';
    const jNo = String(job.job_no || '').toUpperCase();
    const bNo = String(job.booking_no || (job as any).bookingNo || '').toUpperCase();
    if (jNo.startsWith('JOB-R') || bNo.startsWith('BK-R') || jNo.includes('-R') || bNo.includes('-R')) return 'R';
    if (jNo.startsWith('JOB-Q') || bNo.startsWith('BK-Q') || jNo.includes('-Q') || bNo.includes('-Q')) return 'Q';
    return null;
  };

  // Filter out closed/completed jobs (belong in Step 4: ปิดงาน /completed)
  const isJobClosed = (j: any) =>
    j.status === 'COMPLETED' ||
    j.status === 'PASSED' ||
    j.status === 'QC_PASSED' ||
    j.status === 'QC_PASS' ||
    j.status === 'CLOSED' ||
    j.status === 'CLOSEJOB' ||
    (j as any).stk_status === 'DELIVERED';

  // Fetch jobs defaulting to created_at descending
  const { data, isLoading } = useJobs({
    page: 1,
    limit: 100,
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  const rawJobs: Job[] = Array.isArray(data) ? data : (data?.data || []);

  // Step 2 Project & Gantt: Strictly display ONLY Renovate jobs (งาน R) that have been accepted and moved to Step 2
  const renovateJobs: Job[] = React.useMemo(() => {
    return rawJobs.filter(j => 
      !isJobClosed(j) && 
      getJobType(j) === 'R' && 
      (j.status !== 'NEW' && j.status !== 'NEED_REVIEW' || (j as any).pmt_accepted)
    );
  }, [rawJobs]);

  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);

  // Multi-Field Search + Date Range Filter + Creation Date Sorting
  const filteredAndSortedJobs = React.useMemo(() => {
    let result = [...renovateJobs];

    // 1. Multi-Field Search across Customer Name, Phone, Booking No, Ref ID, Job No, Tech, Services
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
            servicesStr.includes(term)
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

        return inCreatedRange || inPlanRange;
      });
    }

    // 3. Default Sorting to system entry date (`created_at`) descending
    result.sort((a, b) => {
      const timeA = toDateTime(a.created_at)?.getTime() || 0;
      const timeB = toDateTime(b.created_at)?.getTime() || 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      const numA = typeof a.id === 'number' ? a.id : (parseInt(String(a.id || '').replace(/\D/g, ''), 10) || 0);
      const numB = typeof b.id === 'number' ? b.id : (parseInt(String(b.id || '').replace(/\D/g, ''), 10) || 0);
      if (numA !== numB) {
        return numB - numA;
      }
      return String(b.job_no || b.id || '').localeCompare(String(a.job_no || a.id || ''));
    });

    return result;
  }, [renovateJobs, searchQuery, startDate, endDate]);

  // Synchronize selection from URL parameters (jobNo / jobId) or default to first project
  React.useEffect(() => {
    const targetJobNo = paramJobNo || searchParams.get('jobNo');
    const targetJobId = searchParams.get('jobId');

    if (filteredAndSortedJobs.length > 0) {
      if (targetJobNo || targetJobId) {
        const matched = filteredAndSortedJobs.find(
          j => (targetJobNo && (j.job_no === targetJobNo || String(j.id) === targetJobNo)) ||
               (targetJobId && String(j.id) === String(targetJobId))
        );
        if (matched) {
          setSelectedJob(matched);
          return;
        }
      }
      // If none selected or current selection is not in list, auto-select first item
      if (!selectedJob || !filteredAndSortedJobs.some(j => j.id === selectedJob.id)) {
        setSelectedJob(filteredAndSortedJobs[0]);
      }
    } else {
      setSelectedJob(null);
    }
  }, [paramJobNo, searchParams, filteredAndSortedJobs]);

  const handleRowClick = (row: Job) => {
    setSelectedJob(row);
    const tab = searchParams.get('tab') || 'gantt';
    navigate(`/gantt?jobNo=${row.job_no}&tab=${tab}`, { replace: true });
  };

  const columns: ColumnDef<Job>[] = [
    {
      id: 'index',
      header: '#',
      width: 45,
      minWidth: 40,
      cell: ({ index }) => (
        <span className="font-bold text-black text-xs">{index + 1}</span>
      )
    },
    {
      id: 'customer_name',
      header: 'ลูกค้า',
      width: 175,
      minWidth: 140,
      cell: ({ row }) => {
        const name = typeof row.customer === 'string' ? row.customer : (row.customer?.name || (row as any).customer_name || '-');
        return <span className="text-black font-semibold text-sm truncate block max-w-[165px]" title={name}>{name}</span>;
      }
    },
    {
      id: 'customer_phone',
      header: 'เบอร์โทร',
      width: 120,
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
      width: 210,
      minWidth: 150,
      cell: ({ row }) => {
        const text = Array.isArray(row.services) ? row.services.join(', ') : (row.services || (row as any).project_sub_type || '-');
        return <div className="truncate max-w-[200px] text-black text-sm font-medium" title={text}>{text}</div>;
      }
    },
    {
      id: 'status',
      header: 'สถานะ',
      width: 180,
      minWidth: 160,
      cell: ({ row }) => {
        return <StatusBadge status={row.status === 'QC_PENDING' ? 'PENDING' : row.status} />;
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
        `"${String(j.project_type || 'RENOVATE').replace(/"/g, '""')}"`,
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
      link.setAttribute('download', `project_gantt_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
    toast.success('ส่งออกข้อมูลสำเร็จ');
  };

  const actions = (
    <div className="flex items-center gap-1.5">
      <Button variant="secondary" size="sm" onClick={handleExportCSV} className="h-7 text-xs px-2.5 text-black font-medium">ส่งออก</Button>
      <Button variant="primary" size="sm" onClick={() => setShowCreateDrawer(true)} className="h-7 text-xs px-2.5 text-black font-medium">+ สร้างงาน</Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-2.5 overflow-hidden">
      <PageHeader title="Project & Gantt" pageKey="gantt" actions={actions} />

      {/* Search & Filter Toolbar (No Quick / Type filters: Dedicated to Job R only) */}
      <div className="flex flex-wrap items-center justify-between gap-2 py-1 px-1 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Multi-field search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (ลูกค้า, เบอร์โทร, Booking, Ref ID)..."
              className="pl-8 h-8 text-xs text-black placeholder:text-gray-500 bg-white border-gray-300"
            />
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-black whitespace-nowrap">ช่วงวันที่:</span>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              className="bg-white [&_input]:h-8 [&_input]:text-xs [&_button]:h-8"
            />
          </div>

          {/* Reset button if filter is active */}
          {(searchQuery || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
              }}
              className="h-8 text-xs text-black font-medium hover:bg-gray-100 px-2"
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>

        {/* Counter badge: Shows only Renovate jobs */}
        <div className="text-xs text-black font-medium">
          แสดง <span className="font-bold text-black">{filteredAndSortedJobs.length}</span> จากทั้งหมด <span className="font-bold text-black">{renovateJobs.length}</span> รายการ
        </div>
      </div>

      {/* Master Detail Layout: Top Table, Bottom JobDetailTabs with defaultTab="gantt" */}
      <div className="flex-1 min-h-0 mt-1">
        <MasterDetailLayout
          pageKey="gantt"
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
              <JobDetailTabs
                job={selectedJob}
                defaultTab="gantt"
                onClose={() => setSelectedJob(null)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 border border-border-soft rounded-2xl bg-white shadow-2xs">
                <p className="text-sm font-semibold text-black">เลือกโครงการจากตารางด้านบนเพื่อดูผังกำหนดการทำงาน Gantt Chart</p>
                <p className="text-xs text-slate-500 mt-1">แสดงเฉพาะงานโครงการปรับปรุง/ต่อเติม (Renovate - งาน R)</p>
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
