import * as React from 'react';
import { useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Job, useJobTasks } from '@/features/jobs/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { BoqTab } from '@/features/boq/boq-tab';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { QcInspectionForm } from '@/features/qc/qc-inspection-form';
import { useQCInspection, useExportSTK } from '@/features/qc/api';
import { useAcceptJob, useUpdateJob } from '@/features/jobs/api';
import { JobTimeline } from '@/features/jobs/job-timeline';
import { formatDMY, formatDateTimeDMY, format24HourTimeBadge } from '@/lib/date';
import { toast } from 'sonner';
import { PhotoSlots5, PhotoSlot } from '@/components/ui/photo-slots-5';
import { OrderCustomerSummary } from '@/features/jobs/order-customer-summary';
import { isQuickJob, isRenovateJob } from '@/features/jobs/job-active-workspace';
import { UserCheck, Camera, ExternalLink, CheckCircle2, ArrowRight, Clock, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GanttChart } from '@/features/gantt/gantt-chart';
import { Task } from '@/features/gantt/api';
import { DailyLogModal } from '@/features/daily-logs/daily-log-modal';

const STANDARD_PHOTO_SLOTS: PhotoSlot[] = [
  { id: 'before', label: 'ก่อนเริ่มงาน' },
  { id: 'progress1', label: 'ระหว่างทำ 1' },
  { id: 'progress2', label: 'ระหว่างทำ 2' },
  { id: 'test', label: 'ทดสอบระบบ' },
  { id: 'after', label: 'หลังเสร็จสิ้น' },
];

interface JobDetailTabsProps {
  job: Job;
  defaultTab?: string;
  onClose?: () => void;
  readOnly?: boolean;
  hideOrderSummary?: boolean;
  hideHeader?: boolean;
}

export function JobDetailTabs({ 
  job, 
  defaultTab = 'task', 
  onClose, 
  readOnly = false,
  hideOrderSummary = false,
  hideHeader = false,
}: JobDetailTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDailyLogTask, setSelectedDailyLogTask] = useState<Task | null>(null);
  const [isDailyLogModalOpen, setIsDailyLogModalOpen] = useState(false);

  /** Determine project type from job data */
  const getJobType = (j: Job): 'Q' | 'R' | null => {
    if (!j) return null;
    if (isQuickJob(j)) return 'Q';
    if (isRenovateJob(j)) return 'R';
    const jNo = String(j.job_no || '').toUpperCase();
    const bNo = String(j.booking_no || (j as any).bookingNo || '').toUpperCase();
    if (jNo.startsWith('JOB-Q') || bNo.startsWith('BK-Q') || jNo.includes('-Q') || bNo.includes('-Q')) return 'Q';
    if (jNo.startsWith('JOB-R') || bNo.startsWith('BK-R') || jNo.includes('-R') || bNo.includes('-R')) return 'R';
    return null;
  };

  const isQuick = getJobType(job) === 'Q';
  const isClosed = job.status === 'CLOSED' || job.status === 'CLOSEJOB' || (job as any).stk_status === 'DELIVERED';
  const isAcceptedOrPlanned = Boolean(
    (job as any).pmt_accepted ||
    (job.status && job.status !== 'NEW' && job.status !== 'NEED_REVIEW')
  );

  // Map legacy / URL tabs to the pipeline steps:
  // [งาน/Task] -> [BOQ] -> [ผัง Gantt] -> [QC] -> [ส่งออก STK] -> [ประวัติ (Timeline)]
  const rawTab = (searchParams.get('tab') || defaultTab).toLowerCase().trim();
  let normalizedTab = rawTab;
  if (rawTab === 'history' || rawTab === 'inspection' || rawTab === 'qc') normalizedTab = 'qc';
  else if (rawTab === 'finance' || rawTab === 'export' || rawTab === 'stk' || rawTab === 'ส่งออก') normalizedTab = 'stk';
  else if (rawTab === 'blueprint' || rawTab === 'tasks' || rawTab === 'task' || rawTab === 'งาน') normalizedTab = 'task';
  else if (rawTab === 'boq' || rawTab === 'pricing') normalizedTab = 'boq';
  else if (rawTab === 'gantt' || rawTab === 'แผนงาน' || rawTab === 'ผังงาน' || rawTab === 'chart') normalizedTab = 'gantt';
  else if (rawTab === 'timeline' || rawTab === 'audit' || rawTab === 'logs') normalizedTab = 'timeline';
  
  // If Quick job, disable and disallow boq and gantt tabs!
  if (isQuick && (normalizedTab === 'boq' || normalizedTab === 'gantt')) {
    normalizedTab = 'task';
  }

  const validTabs = ['task', 'boq', 'gantt', 'qc', 'stk', 'timeline'];
  const activeTab = validTabs.includes(normalizedTab) ? normalizedTab : 'task';

  const { data: tasksData, isLoading: isLoadingTasks } = useJobTasks(job.id);
  const qcMutation = useQCInspection();
  const stkMutation = useExportSTK();
  const acceptMutation = useAcceptJob();
  const updateJobMutation = useUpdateJob();

  // Accept review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReviewType, setSelectedReviewType] = useState<'Q' | 'R'>('Q');

  // Photo save success modal state
  const [showPhotoSuccessModal, setShowPhotoSuccessModal] = useState(false);

  // Photo slots state (5 standard steps)
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>(() => {
    const slots = STANDARD_PHOTO_SLOTS.map((s) => ({ ...s }));
    if (Array.isArray(job.photos)) {
      job.photos.forEach((p: any, idx: number) => {
        const slotId = p.slot_id || p.tag || (slots[idx] ? slots[idx].id : null);
        if (slotId) {
          const match = slots.find((s) => s.id === slotId);
          if (match) {
            match.url = p.url || p.dataUrl;
          }
        }
      });
    }
    return slots;
  });

  React.useEffect(() => {
    const slots = STANDARD_PHOTO_SLOTS.map((s) => ({ ...s }));
    if (Array.isArray(job.photos)) {
      job.photos.forEach((p: any, idx: number) => {
        const slotId = p.slot_id || p.tag || (slots[idx] ? slots[idx].id : null);
        if (slotId) {
          const match = slots.find((s) => s.id === slotId);
          if (match) {
            match.url = p.url || p.dataUrl;
          }
        }
      });
    }
    setPhotoSlots(slots);
  }, [job.photos, job.id]);

  const handlePhotoUpload = (slotId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updatedSlots = photoSlots.map((s) =>
        s.id === slotId ? { ...s, url: dataUrl } : s
      );
      setPhotoSlots(updatedSlots);

      const uploadedPhotos = updatedSlots
        .filter((s) => !!s.url)
        .map((s) => ({
          slot_id: s.id,
          tag: s.id,
          label: s.label,
          url: s.url,
        }));

      updateJobMutation.mutate(
        {
          id: job.id,
          data: {
            photos: uploadedPhotos,
          },
        },
        {
          onSuccess: () => {
            const slotName = STANDARD_PHOTO_SLOTS.find((s) => s.id === slotId)?.label || slotId;
            toast.success(`อัปโหลดรูปภาพ "${slotName}" เรียบร้อยแล้ว`);
          },
          onError: () => {
            const slotName = STANDARD_PHOTO_SLOTS.find((s) => s.id === slotId)?.label || slotId;
            toast.success(`อัปโหลดรูปภาพ "${slotName}" เรียบร้อยแล้ว (จำลอง)`);
          },
        }
      );
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhotos = () => {
    const uploadedPhotos = photoSlots
      .filter((s) => !!s.url)
      .map((s) => ({
        slot_id: s.id,
        tag: s.id,
        label: s.label,
        url: s.url,
      }));

    updateJobMutation.mutate(
      {
        id: job.id,
        data: {
          photos: uploadedPhotos,
        },
      },
      {
        onSuccess: () => {
          setShowPhotoSuccessModal(true);
          toast.success('บันทึกรูปถ่ายเรียบร้อยแล้ว');
        },
        onError: () => {
          setShowPhotoSuccessModal(true);
          toast.success('บันทึกรูปถ่ายเรียบร้อยแล้ว (จำลอง)');
        },
      }
    );
  };

  const handleTabChange = (value: string) => {
    if (isQuick && value === 'boq') {
      toast.warning('งาน Quick Service ไม่มีขั้นตอน BOQ (ดำเนินการตรวจ QC Online ได้ทันที)');
      return;
    }
    if (isQuick && value === 'gantt') {
      toast.warning('งาน Quick Service ไม่มีขั้นตอนผัง Gantt');
      return;
    }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    });
  };

  const handleAcceptJob = () => {
    if (job.status === 'NEED_REVIEW' || (job as any).job_type === 'NEED_REVIEW') {
      setShowReviewModal(true);
      return;
    }
    const jt = getJobType(job);
    acceptMutation.mutate(
      { id: job.id, job_type: jt ?? undefined },
      {
        onSuccess: (res: any) => {
          if (jt === 'Q') {
            toast.success(res?.message || 'รับงานประเภท Quick Service เรียบร้อยแล้ว');
            toast.info('งาน Quick Service: นำทางสู่เมนู Step 3: QC (ตรวจงาน Online) ทันที');
            navigate(`/qc?type=quick&jobNo=${job.job_no}`);
          } else if (jt === 'R') {
            toast.success(res?.message || 'รับงาน Renovate เข้าสู่ระบบและสร้างผัง Gantt เรียบร้อยแล้ว');
            toast.info('เปิดหน้าจอแผนงาน Gantt เพื่อเริ่มดำเนินงานและทำการจอง QC ต่อในระบบ');
            navigate(`/gantt?jobId=${job.id}&jobNo=${job.job_no}&tab=gantt`);
          } else {
            toast.success(res?.message || 'รับงานเข้าสู่ระบบเรียบร้อยแล้ว');
          }
        },
        onError: (err: any) => {
          toast.error(err.message || 'ไม่สามารถรับงานได้ กรุณาลองใหม่อีกครั้ง');
        }
      }
    );
  };

  const handleConfirmReviewAccept = () => {
    const jt = selectedReviewType;
    acceptMutation.mutate(
      { id: job.id, job_type: jt },
      {
        onSuccess: () => {
          setShowReviewModal(false);
          if (jt === 'Q') {
            toast.success(`รับงานประเภท Q (Quick Service) เรียบร้อยแล้ว`);
            toast.info('งาน Quick Service: นำทางสู่เมนู Step 3: QC (ตรวจงาน Online) ทันที');
            navigate(`/qc?type=quick&jobNo=${job.job_no}`);
          } else if (jt === 'R') {
            toast.success(`รับงานประเภท R (Renovate) และสร้างผัง Gantt เรียบร้อยแล้ว`);
            toast.info('เปิดหน้าจอแผนงาน Gantt เพื่อเริ่มดำเนินงานและทำการจอง QC ต่อในระบบ');
            navigate(`/gantt?jobId=${job.id}&jobNo=${job.job_no}&tab=gantt`);
          }
        },
        onError: (err: any) => {
          toast.error(err.message || 'ไม่สามารถรับงานได้');
        }
      }
    );
  };

  const handleQcSubmit = (data: any) => {
    const isPass = data.outcome === 'PASS';
    qcMutation.mutate(
      { jobId: job.id, data },
      {
        onSuccess: () => {
          if (isPass) {
            toast.success(`✅ ผ่าน QC รอบที่ ${data.round} — คะแนน ${data.score.toFixed(1)}/5.0`);
          } else {
            toast.warning(`🔄 ส่งกลับแก้ไข (Rework) รอบที่ ${data.round} บันทึกแล้ว`);
          }
        },
        onError: () => {
          if (isPass) {
            toast.success(`✅ ผ่าน QC รอบที่ ${data.round} — คะแนน ${data.score.toFixed(1)}/5.0 (จำลอง)`);
          } else {
            toast.warning(`🔄 ส่งกลับแก้ไข (Rework) รอบที่ ${data.round} บันทึกแล้ว (จำลอง)`);
          }
        },
      }
    );
  };

  /** เรียกตรง จาก QC Form เมื่อผ่าน QC → ส่ง STK ทันที (Step 6) */
  const handleQcExportSTK = () => {
    stkMutation.mutate(job.id, {
      onSuccess: () => {
        toast.success(`🚀 ส่งออก STK สำเร็จ (ใบงาน ${job.job_no}) ข้อมูลส่งถึงระบบ WDS เรียบร้อยแล้ว`);
        handleTabChange('stk');
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error?.message || err?.message || 'ส่งออก STK ไม่สำเร็จ';
        toast.error(`⚠️ ${msg}`);
        handleTabChange('stk');
      },
    });
  };

  const handleExportStk = () => {
    stkMutation.mutate(job.id, {
      onSuccess: () => {
        toast.success(`🚀 ส่งออก STK สำเร็จ (ใบงาน ${job.job_no}) ข้อมูลส่งถึงระบบ WDS เรียบร้อยแล้ว`);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error?.message || err?.message || 'ส่งออก STK ไม่สำเร็จ';
        toast.error(`⚠️ ${msg}`);
      },
    });
  };

  // Derive items for the Grid View: job.tasks, job.job_details, or job.services
  const displayTasks = React.useMemo(() => {
    const rawTasks = Array.isArray(tasksData) ? tasksData : (tasksData?.data || job.tasks || []);
    if (Array.isArray(rawTasks) && rawTasks.length > 0) {
      return rawTasks.map((t: any, idx: number) => ({
        id: t.id || `task-${idx}`,
        task_name: t.task_name || t.name || `งานที่ ${idx + 1}`,
        assigned_tech: t.assigned_tech || job.assigned_tech || 'รอระบุทีมช่าง',
        plan_start_date: t.plan_start_date || job.plan_date || job.created_at,
        plan_end_date: t.plan_end_date || job.plan_date || job.created_at,
        quantity: t.quantity || t.qty || 1,
        status: t.status || job.status || 'NEW',
        remark: t.remark || t.notes || '-',
      }));
    }

    if (Array.isArray(job.job_details) && job.job_details.length > 0) {
      return job.job_details.map((d: any, idx: number) => ({
        id: `jd-${idx}`,
        task_name: d.installation_detail || d.job_type || d.product_name || `รายการที่ ${idx + 1}`,
        assigned_tech: job.assigned_tech || 'รอระบุทีมช่าง',
        plan_start_date: job.plan_date || job.created_at,
        plan_end_date: job.plan_date || job.created_at,
        quantity: Number(d.product_quantity || d.qty || 1),
        status: job.status || 'NEW',
        remark: d.remark || '-',
      }));
    }

    const services = Array.isArray(job.services)
      ? job.services
      : [job.services || (job as any).project_sub_type || 'บริการติดตั้ง'];

    return services.map((s: string, idx: number) => ({
      id: `svc-${idx}`,
      task_name: typeof s === 'string' ? s : ((s as any)?.name || 'บริการติดตั้ง'),
      assigned_tech: job.assigned_tech || 'รอระบุทีมช่าง',
      plan_start_date: job.plan_date || job.created_at,
      plan_end_date: job.plan_date || job.created_at,
      quantity: 1,
      status: job.status || 'NEW',
      remark: job.special_instructions || job.additional_notes || '-',
    }));
  }, [tasksData, job]);

  const taskCols: ColumnDef<any>[] = [
    { 
      id: 'task_name', 
      header: 'ชื่องาน', 
      accessorKey: 'task_name',
      cell: ({ row }) => (
        <span className="font-semibold text-black">{row.task_name}</span>
      )
    },
    { 
      id: 'quantity', 
      header: 'จำนวน', 
      width: 70, 
      cell: ({ row }) => (
        <span className="text-black font-mono font-bold">{row.quantity || 1}</span>
      )
    },
    { 
      id: 'assigned_tech', 
      header: 'ช่าง', 
      accessorKey: 'assigned_tech', 
      width: 140,
      cell: ({ row }) => <span className="text-black">{row.assigned_tech || job.assigned_tech || '-'}</span> 
    },
    { 
      id: 'plan_start_date', 
      header: 'วันเริ่ม', 
      width: 120, 
      cell: ({ row }) => (
        <span className="text-black font-medium">{formatDMY(row.plan_start_date)}</span>
      )
    },
    { 
      id: 'plan_end_date', 
      header: 'วันสิ้นสุด', 
      width: 120, 
      cell: ({ row }) => (
        <span className="text-black font-medium">{formatDMY(row.plan_end_date)}</span>
      )
    },
    { 
      id: 'remark', 
      header: 'หมายเหตุ', 
      cell: ({ row }) => (
        <span className="text-black truncate block max-w-[180px]" title={row.remark || '-'}>
          {row.remark || '-'}
        </span>
      )
    },
  ];

  const finalGanttTasks: Task[] = React.useMemo(() => {
    // If job has not been accepted/planned yet, no Gantt chart tasks exist!
    if (!isAcceptedOrPlanned) {
      return [];
    }

    const rawTasks = Array.isArray(tasksData) ? tasksData : (tasksData?.data || job.tasks || []);
    const source = (rawTasks.length > 0 ? rawTasks : displayTasks);
    return source.map((t: any, idx: number) => ({
      id: t.id || `task-${job.id}-${idx}`,
      job_id: job.id,
      job_no: job.job_no,
      booking_no: job.booking_no,
      customer_name: typeof job.customer === 'string' ? job.customer : (job.customer?.name || (job as any).customer_name || 'ลูกค้า'),
      service_type: job.project_type || (Array.isArray(job.services) ? job.services[0] : job.services) || 'Renovate',
      area_id: t.area_id || 'general',
      area_name: t.area_name || 'งานทั่วไป / แผนงานหลัก',
      task_name: t.task_name || t.name || `งานที่ ${idx + 1}`,
      assigned_tech: t.assigned_tech || job.assigned_tech || 'รอระบุทีมช่าง',
      plan_start_date: t.plan_start_date || job.plan_date || new Date().toISOString().slice(0, 10),
      plan_end_date: t.plan_end_date || job.plan_date || new Date().toISOString().slice(0, 10),
      duration_days: Number(t.duration_days || t.days || 1),
      status: (t.status || 'PLANNED') as any,
      progress_percent: Number(t.progress_percent || t.progress || 0),
      qc_score: t.qc_score,
      rework_count: t.rework_count || 0
    }));
  }, [tasksData, job, displayTasks, isAcceptedOrPlanned]);

  const bookingBadge = job.booking_no || (job as any).bookingNo || (job as any).vfix_no;
  const refBadge = job.external_ref_id || (job as any).ref_id || (job as any).stk_ref || (job as any).externalRefId;

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-soft overflow-hidden shadow-card">
      {/* Header bar */}
      {!hideHeader && (
        <div className={cn(
          "flex items-center justify-between border-b border-soft bg-white",
          hideOrderSummary ? "px-4 py-2" : "p-4"
        )}>
          <div className="flex items-center space-x-3 flex-wrap gap-y-1">
            <span className="font-bold text-black text-lg">{job.job_no}</span>
            {bookingBadge && (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-black font-semibold" title="Booking Number">
                {bookingBadge}
              </span>
            )}
            {refBadge && (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-black font-semibold" title="Reference ID">
                {refBadge}
              </span>
            )}
            <span className="text-black font-bold">·</span>
            <span className="text-base text-black font-semibold">
              {typeof job.customer === 'string' ? job.customer : (job.customer?.name || (job as any).customer_name || 'ลูกค้าทั่วไป')}
            </span>
            <span className="text-black font-bold">·</span>
            <StatusBadge status={(job as any).stk_status === 'DELIVERED' || job.status === 'CLOSED' || job.status === 'CLOSEJOB' ? 'CLOSEJOB' : (job.status === 'QC_PENDING' ? 'PENDING' : job.status)} />
          </div>
          <div className="flex items-center space-x-2">
            {!readOnly && (job.status === 'NEW' || job.status === 'NEED_REVIEW' || !(job as any).pmt_accepted) && (
              <Button
                variant="primary"
                size="sm"
                disabled={acceptMutation.isPending}
                onClick={handleAcceptJob}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-white" />
                <span>{acceptMutation.isPending ? 'กำลังรับงาน...' : 'รับงาน'}</span>
              </Button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-black hover:bg-gray-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="ปิดหน้าต่าง (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Order & Customer Summary Details (Site address, phone, Google Maps, items, 24-hr schedule) */}
      {!hideOrderSummary && <OrderCustomerSummary job={job} />}

      {/* Tabs Container */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 border-b border-soft bg-white flex items-center justify-between">
            <TabsList className={cn("bg-transparent flex space-x-2", hideOrderSummary ? "h-10" : "h-12")}>
              <TabsTrigger 
                value="task" 
                className={cn(
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-black text-black font-semibold rounded-none shadow-none px-4",
                  hideOrderSummary ? "py-2 text-xs" : "py-3"
                )}
              >
                งาน/Task
              </TabsTrigger>
              <TabsTrigger 
                value="boq" 
                disabled={isQuick}
                title={isQuick ? "งาน Quick Service ไม่มีขั้นตอน BOQ (ข้ามไปตรวจ QC Online ทันที)" : "ประมาณการราคาและรายการพัสดุ (BOQ)"}
                className={cn(
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary font-semibold rounded-none shadow-none px-4",
                  hideOrderSummary ? "py-2 text-xs" : "py-3",
                  isQuick ? 'opacity-40 cursor-not-allowed text-gray-400' : 'text-black'
                )}
              >
                <span>BOQ</span>
                {isQuick && <span className="ml-1 text-[10px] text-gray-400 font-normal">(ไม่ใช้ใน Quick)</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="gantt" 
                disabled={isQuick}
                title={isQuick ? "งาน Quick Service ไม่มีขั้นตอนผัง Gantt" : (!isAcceptedOrPlanned ? "รอรับงานก่อนสร้างผัง Gantt" : "ผังกำหนดการทำงาน (Gantt Chart)")}
                className={cn(
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary font-semibold rounded-none shadow-none px-4 flex items-center gap-1.5",
                  hideOrderSummary ? "py-2 text-xs" : "py-3",
                  isQuick ? 'opacity-40 cursor-not-allowed text-gray-400' : 'text-black'
                )}
              >
                <span>Gantt</span>
                {isQuick && <span className="ml-1 text-[10px] text-gray-400">(ไม่ใช้)</span>}
                {!isQuick && !isAcceptedOrPlanned && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
                    รอรับงาน
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="qc" 
                className={cn(
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-black text-black font-semibold rounded-none shadow-none px-4",
                  hideOrderSummary ? "py-2 text-xs" : "py-3"
                )}
              >
                QC
              </TabsTrigger>
              <TabsTrigger 
                value="stk" 
                className={cn(
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-black text-black font-semibold rounded-none shadow-none px-4",
                  hideOrderSummary ? "py-2 text-xs" : "py-3"
                )}
              >
                ส่งออก STK
              </TabsTrigger>
              <TabsTrigger 
                value="timeline" 
                className={cn(
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-black text-black font-semibold rounded-none shadow-none px-4",
                  hideOrderSummary ? "py-2 text-xs" : "py-3"
                )}
              >
                ประวัติ (Timeline)
              </TabsTrigger>
            </TabsList>
            {hideHeader && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-black hover:bg-gray-100 p-1.5 rounded-lg transition-colors cursor-pointer ml-auto"
                title="ปิดหน้าต่าง (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className={cn("flex-1 overflow-auto bg-white text-black", hideOrderSummary ? "p-2.5" : "p-4")}>
            {/* 1. งาน/Task */}
            <TabsContent value="task" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm py-3 border-b border-gray-200 bg-white text-black">
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="font-bold text-black text-sm shrink-0">ประเภทงาน:</span>
                  <span className="text-black font-medium text-sm truncate">{job.project_type || (job as any).job_type || '-'}</span>
                </div>
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="font-bold text-black text-sm shrink-0">บริการ:</span>
                  <span className="text-black font-medium text-sm truncate" title={Array.isArray(job.services) ? job.services.join(', ') : (job.services || job.project_sub_type || '-')}>
                    {Array.isArray(job.services) ? job.services.join(', ') : (job.services || job.project_sub_type || '-')}
                  </span>
                </div>
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="font-bold text-black text-sm shrink-0">วันนัดหมาย:</span>
                  {(() => {
                    const rawAppointment = job.plan_date || (job as any).appointment_date || (job as any).survey_date || (job as any).date;
                    if (!rawAppointment || formatDMY(rawAppointment) === '-') {
                      return <span className="text-black font-medium text-sm">-</span>;
                    }
                    const rawTime = (job.plan_time || (job as any).time_slot || (job as any).survey_time || (job as any).time || (job as any).appointment_time || '') as string;
                    const displayTime = format24HourTimeBadge(rawTime, rawAppointment);
                    return (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-black font-medium text-sm">{formatDMY(rawAppointment)}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-gray-100 border border-gray-300 text-black">
                          {displayTime}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="font-bold text-black text-sm shrink-0">ช่างผู้รับผิดชอบ:</span>
                  <span className="text-black font-medium text-sm truncate">{job.assigned_tech || 'รอระบุทีมช่าง'}</span>
                </div>
              </div>
              {/* Directly Show Grid View (Tab 2) & Photos below */}
              {(() => {
                const tasks = Array.isArray(tasksData) ? tasksData : (tasksData?.data || job.tasks || []);
                const finalTasks = tasks.length > 0 ? tasks : displayTasks;

                return (
                  <div className="space-y-4 flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-black">
                          ตารางรายการย่อย ({finalTasks.length}) (Grid View)
                        </span>
                      </div>
                    </div>

                    <div className="min-h-[160px] flex-shrink-0">
                      <DataGrid 
                        columns={taskCols} 
                        data={finalTasks} 
                        isLoading={isLoadingTasks && (!job.tasks || job.tasks.length === 0)}
                        getRowId={(row: any) => String(row.id)}
                      />
                    </div>

                    {/* รูปภาพ (PhotoSlots 5) Section Placed Below the Grid */}
                    <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Camera className="w-4 h-4 text-black" />
                          <h3 className="text-sm font-bold text-black flex items-center gap-2">
                            <span>รูปถ่ายการปฏิบัติงาน 5 ขั้นตอน (PhotoSlots 5)</span>
                            {isClosed && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300">
                                🔒 ปิดงานแล้ว (Readonly)
                              </span>
                            )}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-black font-medium">
                            อัปโหลดแล้ว {photoSlots.filter((s) => !!s.url).length}/5 รูป
                          </span>
                          {!isClosed && !readOnly ? (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={updateJobMutation.isPending}
                              onClick={handleSavePhotos}
                              className="bg-primary hover:bg-primary-hover text-black font-bold px-3 py-1 text-xs"
                            >
                              {updateJobMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกรูปถ่าย'}
                            </Button>
                          ) : isClosed ? (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                              ส่งงานเรียบร้อย (ห้ามแก้ไข)
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <PhotoSlots5
                        slots={photoSlots}
                        onUpload={handlePhotoUpload}
                        readOnly={isClosed || readOnly}
                        className="pt-1"
                      />
                    </section>
                  </div>
                );
              })()}
            </TabsContent>

            {/* 2. BOQ (Disabled สำหรับงาน Quick Service) */}
            <TabsContent value="boq" className="h-full m-0 data-[state=active]:flex flex-col">
              {isQuick ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 border border-gray-200 rounded-xl m-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold">
                    Q
                  </div>
                  <h3 className="text-base font-bold text-black">งานบริการด่วน (Quick Service) ไม่มีขั้นตอน BOQ</h3>
                  <p className="text-xs text-gray-600 max-w-md">
                    งานประเภท Quick Service เป็นบริการติดตั้งด่วนมาตรฐาน ไม่ต้องจัดทำประมาณการราคาและรายการพัสดุ (BOQ) ระบบจะพาเข้าสู่ขั้นตอนตรวจรับรองคุณภาพ QC และส่งออก STK ทันที
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleTabChange('qc')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer"
                  >
                    ไปที่แท็บ QC ตรวจงาน Online →
                  </Button>
                </div>
              ) : (
                <BoqTab job={job} readOnly={readOnly} />
              )}
            </TabsContent>

            {/* 3. ผัง Gantt (เฉพาะงาน Renovate ที่รับงานแล้ว / สถานะวางแผนงาน) */}
            <TabsContent value="gantt" className={cn("h-full m-0 data-[state=active]:flex flex-col", hideOrderSummary ? "space-y-2" : "space-y-3")}>
              {!isAcceptedOrPlanned ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-gray-200 rounded-xl space-y-4 my-auto shadow-2xs">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-2xs">
                    <Clock className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <h3 className="text-base font-bold text-black">ยังไม่มีผังกำหนดการทำงาน (Gantt Chart)</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      ใบงานนี้อยู่ในสถานะ <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">รอรับงาน (NEW)</span> และยังไม่ได้ทำรายการรับเข้าสู่ระบบ
                      <br />
                      จะมีผัง Gantt Chart ได้ก็ต่อเมื่อกด <strong>"รับงาน"</strong> และย้ายไปสู่สถานะ <strong>"วางแผนงาน (PLANNED)"</strong> ที่ Step 2: Project & Gantt
                    </p>
                  </div>
                  {!readOnly && (
                    <Button
                      onClick={handleAcceptJob}
                      disabled={acceptMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs text-xs flex items-center gap-2 cursor-pointer transition hover:scale-102"
                    >
                      <UserCheck className="w-4 h-4 text-white" />
                      <span>{acceptMutation.isPending ? 'กำลังรับงาน...' : '✓ กดรับงานเพื่อสร้างผัง Gantt และเริ่มวางแผนงาน →'}</span>
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className={cn(
                    "flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-gray-200 rounded-lg",
                    hideOrderSummary ? "px-3 py-1.5" : "p-3"
                  )}>
                    <div>
                      <h3 className="text-sm font-bold text-black flex items-center gap-2">
                        <span>ผังกำหนดการทำงาน Gantt Chart</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-200 text-black font-semibold">
                          {job.job_no}
                        </span>
                        <span className="text-xs font-medium text-gray-600">
                          ({finalGanttTasks.length} รายการงานย่อย)
                        </span>
                      </h3>
                      {!location.pathname.startsWith('/gantt') && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          แผนภูมิแสดงแถบเวลาตามแผนงานของช่างแต่ละขั้นตอน พร้อมสถานะความคืบหน้า
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!readOnly && !location.pathname.startsWith('/gantt') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/gantt?jobId=${job.id}&jobNo=${job.job_no}&tab=gantt`)}
                          className="text-xs text-indigo-700 bg-white hover:bg-indigo-50 border-indigo-200 font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>เปิดใน Step 2: Project & Gantt ใหญ่ ↗</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className={cn("flex-1 min-h-[300px] border border-gray-200 rounded-xl overflow-auto bg-white", hideOrderSummary ? "p-1.5" : "p-2")}>
                    <GanttChart
                      tasks={finalGanttTasks}
                      onOpenDailyLog={readOnly ? undefined : (task) => {
                        setSelectedDailyLogTask(task);
                        setIsDailyLogModalOpen(true);
                      }}
                      className="h-full"
                    />
                  </div>
                </>
              )}
            </TabsContent>

            {/* 4. QC (Inline Inspection Workspace - No Popup) */}
            <TabsContent value="qc" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <QcInspectionForm
                jobId={job.id}
                jobNo={job.job_no}
                jobType={isQuick ? 'Q' : 'R'}
                jobStatus={job.status}
                assignedTech={job.assigned_tech}
                planDate={job.plan_date || (job as any).appointment_date || (job as any).date}
                planTime={(job.plan_time || (job as any).time_slot || (job as any).appointment_time) as string}
                qcScore={(job as any).qc_score}
                previousReworkCount={
                  Array.isArray((job as any).qc_history)
                    ? (job as any).qc_history.filter((h: any) => h.outcome === 'REWORK' || h.result === 'FAIL').length
                    : 0
                }
                reworkHistory={
                  Array.isArray((job as any).qc_history)
                    ? (job as any).qc_history
                    : []
                }
                initialPhotos={job.photos}
                onPhotosChange={(photos) => {
                  setPhotoSlots(photos);
                  const uploadedPhotos = photos
                    .filter((s) => !!s.url)
                    .map((s) => ({
                      slot_id: s.id,
                      tag: s.id,
                      label: s.label,
                      url: s.url,
                    }));
                  updateJobMutation.mutate({
                    id: job.id,
                    data: { photos: uploadedPhotos },
                  });
                }}
                onSubmit={handleQcSubmit}
                onExportSTK={handleQcExportSTK}
                isInline={true}
                readOnly={readOnly}
              />
            </TabsContent>

            {/* 5. ส่งออก STK */}
            <TabsContent value="stk" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <div className="p-6 bg-white text-black space-y-6">
                {/* Header & Main Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-base font-bold text-black">
                        การส่งออกข้อมูลไปยังระบบ STK / BMT
                      </h4>
                      {isClosed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>closejob (ส่ง STK เรียบร้อยแล้ว)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                          พร้อมส่งออก (READY)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-black">
                      ส่งข้อมูลงาน ยอดเงินตาม BOQ และบันทึกค่าใช้จ่ายเพื่อตัดยอดบัญชีในระบบภายนอก WDS
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <a
                      href="https://vwds.online/wds/pmt-qc"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-black font-bold shadow-xs transition-colors"
                      title="เปิดหน้าจอตรวจสอบข้อมูล WDS Platform (vwds.online/wds/pmt-qc)"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                      <span>เปิดระบบ WDS ↗</span>
                    </a>

                    {!readOnly && (
                      isClosed ? (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={handleExportStk} 
                          disabled={stkMutation.isPending}
                          className="text-xs border border-gray-300 bg-white hover:bg-gray-100 text-black font-bold h-9 px-3.5 flex items-center gap-1.5 shadow-xs cursor-pointer"
                          title="ส่งซิงค์ข้อมูลไปยังระบบภายนอกใหม่อีกครั้ง"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-black ${stkMutation.isPending ? 'animate-spin' : ''}`} />
                          <span>{stkMutation.isPending ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลซ้ำ (Re-sync)'}</span>
                        </Button>
                      ) : (
                        <Button 
                          variant="primary" 
                          size="sm"
                          onClick={handleExportStk} 
                          disabled={stkMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <span>{stkMutation.isPending ? 'กำลังส่งออก...' : '🚀 ส่งออก STK'}</span>
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* Clean, Spacious Key-Value Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-1">
                    <span className="text-xs text-black font-semibold block">เลขที่อ้างอิง STK (Ref)</span>
                    <span className="font-mono text-sm font-bold text-black block truncate" title={job.external_ref_id || (job as any).stk_ref || `STK-${job.job_no.replace(/\D/g, '').slice(-8) || '20260901'}`}>
                      {job.external_ref_id || (job as any).stk_ref || `STK-${job.job_no.replace(/\D/g, '').slice(-8) || '20260901'}`}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-1">
                    <span className="text-xs text-black font-semibold block">สถานะการส่งออก</span>
                    <div className="pt-0.5">
                      {isClosed ? (
                        <span className="font-bold text-xs text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          closejob (ส่ง stk แล้ว)
                        </span>
                      ) : (
                        <span className="font-bold text-xs text-amber-800">
                          พร้อมส่งออก (READY)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-1">
                    <span className="text-xs text-black font-semibold block">เวลาที่ส่งออกล่าสุด</span>
                    <span className="text-xs font-bold text-black block">
                      {formatDateTimeDMY((job as any).stk_exported_at || new Date().toISOString())}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-1">
                    <span className="text-xs text-black font-semibold block">สรุปยอดเงินรวมเบิกจ่าย</span>
                    <span className="font-mono text-sm font-bold text-black block">
                      ฿{Number(job.grand_total || (job as any).boq_grand_total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Subtle, Clean Footer Link */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-black">
                  <span>ปลายทางระบบภายนอก: <strong className="text-black font-bold">WDS Platform</strong> (vwds.online/wds/pmt-qc)</span>
                  <a
                    href="https://vwds.online/wds/pmt-qc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    ตรวจสอบบน WDS ↗
                  </a>
                </div>
              </div>
            </TabsContent>

            {/* 6. ประวัติการดำเนินงาน (Timeline) */}
            <TabsContent value="timeline" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <JobTimeline jobId={job.id} bookingNo={job.booking_no || (job as any).external_ref_id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>


      {/* Need Review Accept Modal Dialog */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="sm:max-w-[480px] bg-white text-black p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-black flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-purple-600" />
              <span>ระบุประเภทงานก่อนกดรับงาน</span>
            </h3>
            <p className="text-xs text-black mt-1">
              ระบบตรวจสอบข้อมูลต้นทางแล้วพบว่าประเภทงานไม่ชัดเจน (NEED_REVIEW) กรุณาเลือกประเภทงานเพื่อดำเนินการต่อ
            </p>
          </div>

          <div className="space-y-3">
            <label 
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                selectedReviewType === 'Q' 
                  ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500' 
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
              onClick={() => setSelectedReviewType('Q')}
            >
              <input 
                type="radio" 
                name="reviewType" 
                value="Q" 
                checked={selectedReviewType === 'Q'} 
                onChange={() => setSelectedReviewType('Q')}
                className="mt-1 accent-amber-600" 
              />
              <div>
                <span className="font-bold text-sm text-black block">Q — Quick Service (งานด่วน/ติดตั้ง)</span>
                <span className="text-xs text-black">
                  ข้ามขั้นตอนออกแบบ/BOQ และส่งไปขั้นตอนรอตรวจ QC (WAIT_QC) ทันที
                </span>
              </div>
            </label>

            <label 
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                selectedReviewType === 'R' 
                  ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500' 
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
              onClick={() => setSelectedReviewType('R')}
            >
              <input 
                type="radio" 
                name="reviewType" 
                value="R" 
                checked={selectedReviewType === 'R'} 
                onChange={() => setSelectedReviewType('R')}
                className="mt-1 accent-blue-600" 
              />
              <div>
                <span className="font-bold text-sm text-black block">R — Renovate (งานปรับปรุง/ต่อเติม)</span>
                <span className="text-xs text-black">
                  เข้าสู่ขั้นตอนสร้าง Project (3 ระดับ), จัดการ BOQ และมอบหมายช่าง/QC ประจำพื้นที่
                </span>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-soft)]">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowReviewModal(false)}
              className="text-black font-semibold text-xs"
            >
              ยกเลิก
            </Button>
            <Button 
              type="button" 
              variant="primary" 
              size="sm"
              disabled={acceptMutation.isPending}
              onClick={handleConfirmReviewAccept}
              className="bg-primary hover:bg-primary-hover text-black font-bold px-4 py-2 text-xs"
            >
              {acceptMutation.isPending ? 'กำลังบันทึก...' : `ยืนยันรับงานประเภท ${selectedReviewType}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal แจ้งเตือนบันทึกรูปถ่ายสำเร็จ พร้อมแนะนำขั้นตอนต่อไปสำหรับงาน Q */}
      <Dialog open={showPhotoSuccessModal} onOpenChange={setShowPhotoSuccessModal}>
        <DialogContent className="sm:max-w-[480px] bg-white border border-[var(--border)] shadow-xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-base font-bold text-black">
                  บันทึกรูปถ่ายสำเร็จเรียบร้อยแล้ว
                </DialogTitle>
                <span className="text-xs text-black font-medium">
                  {job.job_no} ({isQuick ? '⚡ งาน Quick Service' : '🏗️ งาน Renovate'})
                </span>
              </div>
            </div>
            <DialogDescription className="text-sm text-black pt-2 text-left">
              บันทึกรูปถ่ายการปฏิบัติงานจำนวน <strong className="text-black">{photoSlots.filter((s) => !!s.url).length}/5 รูป</strong> เข้าสู่ระบบเรียบร้อยแล้ว
            </DialogDescription>
          </DialogHeader>

          {isQuick ? (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2 text-left">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                  ⚡ ขั้นตอนถัดไปของงาน Q (Quick Service)
                </span>
              </div>
              <p className="text-xs text-black leading-relaxed">
                • <strong>Fast-Track:</strong> ข้ามขั้นตอนออกแบบ BOQ และผัง Gantt อัตโนมัติ (บริการด่วน 1 วันเสร็จ)
                <br />
                • <strong>ตรวจ QC Online:</strong> รูปถ่าย 5 ขั้นตอนนี้ถูกส่งตรงไปยังขั้นตอน <strong>QC</strong> ทันที เพื่อให้ผู้ตรวจประเมินผลผ่านระบบออนไลน์โดยไม่ต้องลงหน้างาน
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1 text-left">
              <span className="text-xs font-bold text-black">
                🏗️ ขั้นตอนถัดไปของงาน Renovate (งาน R):
              </span>
              <p className="text-xs text-black leading-relaxed">
                รูปถ่ายจะถูกนำไปอ้างอิงในผัง Gantt Chart และใช้ประกอบการลงตรวจหน้างานจริง (On-site QC)
              </p>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-3 border-t border-[var(--border-soft)]">
            {isQuick && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setShowPhotoSuccessModal(false);
                  handleTabChange('qc');
                }}
                className="bg-primary hover:bg-primary-hover text-black font-bold px-4 py-2 text-xs flex items-center justify-center gap-1.5"
              >
                <span>ไปยังแท็บตรวจ QC (QC Online)</span>
                <ArrowRight className="w-3.5 h-3.5 text-black" />
              </Button>
            )}
            <Button
              type="button"
              variant={isQuick ? "ghost" : "primary"}
              size="sm"
              onClick={() => setShowPhotoSuccessModal(false)}
              className={isQuick ? "text-black font-semibold text-xs border border-gray-300 hover:bg-gray-100" : "bg-primary hover:bg-primary-hover text-black font-bold px-4 py-2 text-xs"}
            >
              ตกลง / ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Daily Technician Work Log Modal */}
      <DailyLogModal
        open={isDailyLogModalOpen}
        onOpenChange={setIsDailyLogModalOpen}
        preselectedJobId={job.id}
        preselectedTaskId={selectedDailyLogTask?.id}
        preselectedTask={selectedDailyLogTask}
      />
    </div>
  );
}
