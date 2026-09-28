import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQCBookings, useConfirmBooking } from '@/features/qc/api';
import { useJob, useJobs, Job } from '@/features/jobs/api';
import { isQuickJob, isRenovateJob } from '@/features/jobs/job-active-workspace';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Zap, Building2, Camera } from 'lucide-react';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { formatDMY, format24HourTimeBadge } from '@/lib/date';

export default function QcPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJobNo = searchParams.get('jobNo') || '';
  const initialType = searchParams.get('type')?.toLowerCase();

  // Tab: 'quick' (Online) vs 'renovate' (On-site)
  const [activeQcTab, setActiveQcTab] = useState<'quick' | 'renovate'>(() => {
    if (initialType === 'renovate' || (initialJobNo.includes('-R') || initialJobNo.startsWith('JOB-R'))) {
      return 'renovate';
    }
    return 'quick';
  });

  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [selectedQuickJob, setSelectedQuickJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialJobNo);

  // Load all jobs
  const { data: allJobsData, isLoading: isLoadingJobs } = useJobs({ limit: 100 });
  const allJobs: Job[] = Array.isArray(allJobsData) ? allJobsData : (allJobsData?.data || []);

  // Load bookings for Renovate
  const { data: bookingsData, isLoading: isLoadingBookings } = useQCBookings();
  const bookings = Array.isArray(bookingsData) ? bookingsData : (bookingsData?.data || []);

  const confirmBooking = useConfirmBooking();

  // Handle URL params on load or change
  useEffect(() => {
    const qJobNo = searchParams.get('jobNo');
    const qType = searchParams.get('type')?.toLowerCase();
    if (qType === 'renovate') {
      setActiveQcTab('renovate');
    } else if (qType === 'quick') {
      setActiveQcTab('quick');
    }

    if (qJobNo) {
      setSearchQuery(qJobNo);
      if (allJobs.length > 0) {
        const found = allJobs.find(j => j.job_no === qJobNo || String(j.id) === qJobNo);
        if (found) {
          if (isQuickJob(found)) {
            setActiveQcTab('quick');
            setSelectedQuickJob(found);
          } else {
            setActiveQcTab('renovate');
            setSelectedBooking({ job_id: found.id, job_no: found.job_no, customer: found.customer });
          }
        }
      }
    }
  }, [searchParams, allJobs]);

  // Step 3 QC strictly contains jobs waiting for or undergoing QC inspection.
  // All closed/completed/delivered jobs belong in Step 4: ปิดงาน (/completed).
  // All new unaccepted jobs belong in Step 1: รับงาน (/orders).
  const isJobClosed = (j: any) =>
    j.status === 'COMPLETED' ||
    j.status === 'PASSED' ||
    j.status === 'QC_PASSED' ||
    j.status === 'QC_PASS' ||
    j.status === 'CLOSED' ||
    j.status === 'CLOSEJOB' ||
    (j as any).stk_status === 'DELIVERED';

  const isJobInQcStage = (j: any) => {
    if (!j) return false;
    if (isJobClosed(j)) return false;
    // Exclude new unaccepted jobs (they belong in Step 1: รับงาน)
    if (j.status === 'NEW' || j.status === 'NEED_REVIEW' || j.status === 'DRAFT') return false;
    return true;
  };

  // Quick jobs filtered list: Only active jobs awaiting or undergoing QC inspection
  const quickJobsList = useMemo(() => {
    return allJobs.filter(j => isQuickJob(j) && isJobInQcStage(j));
  }, [allJobs]);

  const filteredQuickJobs = useMemo(() => {
    let list = quickJobsList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((j: any) => {
        const jNo = String(j.job_no || '').toLowerCase();
        const bNo = String(j.booking_no || (j as any).external_ref_id || '').toLowerCase();
        const cust = String(typeof j.customer === 'string' ? j.customer : j.customer?.name || '').toLowerCase();
        const phone = String(j.customer_phone || j.customer?.phone || '').toLowerCase();
        const tech = String(j.assigned_tech || '').toLowerCase();
        const svcs = Array.isArray(j.services) ? j.services.join(' ').toLowerCase() : String(j.services || '').toLowerCase();
        return jNo.includes(q) || bNo.includes(q) || cust.includes(q) || phone.includes(q) || tech.includes(q) || svcs.includes(q);
      });
    }
    return list;
  }, [quickJobsList, searchQuery]);

  // Renovate bookings or jobs
  const filteredRenovateList = useMemo(() => {
    let list = bookings;
    // Filter out completed/closed bookings from active QC waiting list
    list = list.filter((b: any) => b.status !== 'DONE' && b.status !== 'COMPLETED' && b.status !== 'CLOSED');

    // Fallback: If bookings empty, use renovate jobs from allJobs that are in QC stage
    if (list.length === 0) {
      list = allJobs
        .filter(j => isRenovateJob(j) && isJobInQcStage(j))
        .map((j: any) => ({
          id: j.id,
          job_id: j.id,
          job_no: j.job_no,
          customer: j.customer,
          task_name: Array.isArray(j.services) ? j.services[0] : (j.services || 'งานปรับปรุงและติดตั้ง'),
          booking_date: j.plan_date || j.created_at,
          time_slot: j.plan_time || '09:00',
          status: j.status === 'WAIT_QC' ? 'CONFIRMED' : 'PENDING',
          inspector: j.assigned_qc || 'รอระบุ'
        }));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((b: any) => {
        const jobNo = String(b.job_no || '').toLowerCase();
        const cust = String(typeof b.customer === 'string' ? b.customer : b.customer?.name || '').toLowerCase();
        const task = String(b.task_name || '').toLowerCase();
        const inspector = String(b.inspector || '').toLowerCase();
        return jobNo.includes(q) || cust.includes(q) || task.includes(q) || inspector.includes(q);
      });
    }
    return list;
  }, [bookings, allJobs, searchQuery]);

  // Currently selected job for Detail pane
  const { data: jobData } = useJob(selectedBooking?.job_id);
  const selectedRenovateJob = jobData?.data || jobData || allJobs.find((j: any) => String(j.id) === String(selectedBooking?.job_id) || j.job_no === selectedBooking?.job_no);

  const activeSelectedJob = activeQcTab === 'quick' ? selectedQuickJob : selectedRenovateJob;

  const handleConfirmBooking = (bookingId: number) => {
    confirmBooking.mutate({ id: bookingId, data: { confirmed_by: 'System', confirmed_at: new Date().toISOString() } });
  };

  // Quick Jobs Columns
  const quickColumns: ColumnDef<Job>[] = [
    {
      id: 'job_no',
      header: 'รหัสงาน',
      width: 140,
      cell: ({ row }) => (
        <span className="font-semibold text-black font-mono">{row.job_no}</span>
      )
    },
    {
      id: 'customer',
      header: 'ลูกค้า',
      width: 180,
      cell: ({ row }) => {
        const val = row.customer;
        const name = typeof val === 'string' ? val : val?.name || '-';
        return <span className="text-black font-medium">{name}</span>;
      }
    },
    {
      id: 'phone',
      header: 'เบอร์โทร',
      width: 130,
      cell: ({ row }) => {
        const phone = row.customer_phone || (row.customer as any)?.phone || (row as any).phone || '-';
        return <span className="text-black font-mono text-xs">{phone}</span>;
      }
    },
    {
      id: 'services',
      header: 'บริการด่วน (Quick)',
      width: 200,
      cell: ({ row }) => {
        const text = Array.isArray(row.services) ? row.services.join(', ') : (row.services || (row as any).project_sub_type || '-');
        return <div className="truncate max-w-[190px] text-black text-sm" title={text}>{text}</div>;
      }
    },
    {
      id: 'plan_date',
      header: 'วันนัดหมาย',
      width: 170,
      cell: ({ row }) => {
        const rawDate = row.plan_date || (row as any).appointment_date || (row as any).survey_date || (row as any).date;
        if (!rawDate) return <span className="text-black">-</span>;
        const dateFormatted = formatDMY(rawDate);
        const rawTime = (row.plan_time || (row as any).time_slot || '') as string;
        const displayTime = format24HourTimeBadge(rawTime, rawDate);
        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-black font-medium text-xs">{dateFormatted}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 border border-blue-200 text-black">
              {displayTime}
            </span>
          </div>
        );
      }
    },
    {
      id: 'status',
      header: 'สถานะ',
      width: 140,
      cell: ({ row }) => {
        const isStkDelivered = (row as any).stk_status === 'DELIVERED' || row.status === 'CLOSED' || row.status === 'CLOSEJOB';
        return <StatusBadge status={isStkDelivered ? 'CLOSEJOB' : (row.status === 'QC_PENDING' ? 'PENDING' : row.status)} />;
      }
    },
    {
      id: 'photos',
      header: 'รูปถ่าย 5 ขั้นตอน',
      width: 130,
      cell: ({ row }) => {
        const photos = Array.isArray(row.photos) ? row.photos : [];
        const count = photos.filter((p: any) => !!(p.url || p.dataUrl)).length;
        return (
          <div className="flex items-center gap-1.5">
            <Camera className={`w-3.5 h-3.5 ${count === 5 ? 'text-green-600' : (count > 0 ? 'text-amber-600' : 'text-gray-400')}`} />
            <span className={`text-xs font-bold font-mono ${count === 5 ? 'text-green-700' : (count > 0 ? 'text-amber-700' : 'text-gray-500')}`}>
              {count}/5 รูป
            </span>
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: 'จัดการ',
      width: 150,
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedQuickJob(row);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1 flex items-center gap-1 shadow-2xs cursor-pointer"
        >
          <span>ตรวจงาน Online →</span>
        </Button>
      )
    }
  ];

  // Renovate Columns
  const renovateColumns: ColumnDef<any>[] = [
    { 
      id: 'job_no', 
      header: 'รหัสงาน', 
      width: 140,
      cell: ({ row }: any) => <span className="font-semibold text-black font-mono">{row.job_no}</span> 
    },
    { 
      id: 'customer', 
      header: 'ลูกค้า', 
      width: 180,
      cell: ({ row }: any) => {
        const val = row.customer;
        const name = typeof val === 'string' ? val : val?.name || '-';
        return <span className="text-black font-medium">{name}</span>;
      }
    },
    { 
      id: 'task_name', 
      header: 'Task งานโครงการ', 
      width: 200,
      cell: ({ row }: any) => <span className="text-black font-medium">{row.task_name || '-'}</span> 
    },
    { 
      id: 'booking_date', 
      header: 'วันนัด QC', 
      width: 140,
      cell: ({ row }: any) => {
        if (!row.booking_date) return <span className="text-black font-medium">-</span>;
        return <span className="text-black font-medium">{formatDMY(row.booking_date)}</span>;
      }
    },
    { 
      id: 'time_slot', 
      header: 'ช่วงเวลา', 
      width: 120,
      cell: ({ row }: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-purple-50 border border-purple-200 text-black">
          {row.time_slot || '-'}
        </span>
      )
    },
    { 
      id: 'status', 
      header: 'สถานะ', 
      width: 130,
      cell: ({ row }: any) => <StatusBadge status={((row as any).stk_status === 'DELIVERED' || row.status === 'CLOSED' || row.status === 'CLOSEJOB' ? 'CLOSEJOB' : row.status) as any} /> 
    },
    { 
      id: 'inspector', 
      header: 'ผู้ตรวจ QC', 
      width: 150,
      cell: ({ row }: any) => <span className="text-black font-medium">{row.inspector || 'รอระบุ'}</span> 
    },
    { 
      id: 'actions', 
      header: 'จัดการ', 
      width: 180,
      cell: ({ row }: any) => (
        <div className="flex gap-1.5">
          {row.status === 'PENDING' && (
            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleConfirmBooking(row.id); }} className="text-black text-xs">
              ยืนยันนัด QC
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBooking(row);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1 flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <span>เริ่มตรวจ On-site →</span>
          </Button>
        </div>
      ) 
    },
  ];

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="ตรวจรับงาน QC" pageKey="qc" />

      {/* Sub-Tabs: Quick Online vs Renovate On-site */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-2 pt-2 rounded-t-xl mt-1">
        <button
          type="button"
          onClick={() => {
            setActiveQcTab('quick');
            setSelectedBooking(null);
            setSearchParams({ type: 'quick', ...(searchQuery ? { jobNo: searchQuery } : {}) });
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeQcTab === 'quick'
              ? 'border-blue-600 text-blue-900 bg-blue-50/50'
              : 'border-transparent text-gray-600 hover:text-black hover:bg-gray-50'
          }`}
        >
          <Zap className={`w-4 h-4 ${activeQcTab === 'quick' ? 'text-blue-600' : 'text-gray-400'}`} />
          <span>ตรวจด่วน Online (Quick Service)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
            activeQcTab === 'quick' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'
          }`}>
            {filteredQuickJobs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveQcTab('renovate');
            setSelectedQuickJob(null);
            setSearchParams({ type: 'renovate', ...(searchQuery ? { jobNo: searchQuery } : {}) });
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeQcTab === 'renovate'
              ? 'border-purple-600 text-purple-900 bg-purple-50/50'
              : 'border-transparent text-gray-600 hover:text-black hover:bg-gray-50'
          }`}
        >
          <Building2 className={`w-4 h-4 ${activeQcTab === 'renovate' ? 'text-purple-600' : 'text-gray-400'}`} />
          <span>จองตรวจ On-site (Renovate Projects)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
            activeQcTab === 'renovate' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-black'
          }`}>
            {filteredRenovateList.length}
          </span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-1 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeQcTab === 'quick' ? "ค้นหางาน Quick (รหัสงาน, ลูกค้า, เบอร์โทร)..." : "ค้นหางาน Renovate (รหัสงาน, ลูกค้า, Task, ผู้ตรวจ)..."}
              className="pl-9 h-9 text-sm text-black placeholder:text-gray-500 bg-white border-gray-300"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSearchParams({ type: activeQcTab });
              }}
              className="h-9 text-xs text-black font-medium hover:bg-gray-100 cursor-pointer"
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>

        <div className="text-xs text-black font-medium flex items-center gap-2">
          {activeQcTab === 'quick' ? (
            <span className="inline-flex items-center gap-1.5 text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span>โหมดตรวจ Online 1 ข้อ จากรูปถ่าย 5 ขั้นตอน (Fast-track)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-purple-800 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <span>โหมดจองช่าง QC Lead & ตรวจเกณฑ์ 5 ข้อมาตรฐาน On-site</span>
            </span>
          )}
          <span className="text-gray-500">|</span>
          <span>แสดง <strong className="text-black">{activeQcTab === 'quick' ? filteredQuickJobs.length : filteredRenovateList.length}</strong> รายการ</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="qc"
          masterContent={
            activeQcTab === 'quick' ? (
              <DataGrid
                columns={quickColumns}
                data={filteredQuickJobs}
                isLoading={isLoadingJobs}
                onRowSelect={(row: Job) => setSelectedQuickJob(row)}
                getRowId={(row) => String(row.id || row.job_no)}
                selectedRowId={selectedQuickJob ? String(selectedQuickJob.id || selectedQuickJob.job_no) : undefined}
              />
            ) : (
              <DataGrid
                columns={renovateColumns}
                data={filteredRenovateList}
                isLoading={isLoadingBookings}
                onRowSelect={(row: any) => setSelectedBooking(row)}
                getRowId={(row) => String(row.id || row.job_no)}
                selectedRowId={selectedBooking ? String(selectedBooking.id || selectedBooking.job_no) : undefined}
              />
            )
          }
          detailContent={
            activeSelectedJob ? (
              <JobDetailTabs 
                job={activeSelectedJob} 
                defaultTab="qc" 
                onClose={() => {
                  setSelectedQuickJob(null);
                  setSelectedBooking(null);
                }} 
              />
            ) : (
              <div className="flex flex-col h-full items-center justify-center text-center p-8 bg-card border border-soft rounded-xl shadow-card">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  {activeQcTab === 'quick' ? <Zap className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                </div>
                <h4 className="text-base font-bold text-black mb-1">
                  {activeQcTab === 'quick' ? 'เลือกใบงาน Quick Service เพื่อตรวจงาน Online' : 'เลือกรายการเพื่อจัดการนัดหมายหรือตรวจ QC On-site'}
                </h4>
                <p className="text-xs text-gray-500 max-w-sm">
                  {activeQcTab === 'quick' 
                    ? 'คลิกเลือกรายการในตารางเพื่อเปิดดูรูปถ่าย 5 ขั้นตอนของช่าง ประเมินเกณฑ์มาตรฐาน 1 ข้อ และส่งออก STK ปิดงานได้ทันที'
                    : 'คลิกเลือกรายการเพื่อยืนยันคิวช่าง QC Lead บันทึกผลการตรวจ 5 ข้อเกณฑ์ Isara Chootip และส่งมอบงาน'}
                </p>
              </div>
            )
          }
        />
      </div>
    </div>
  );
}
