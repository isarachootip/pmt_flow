import * as React from 'react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Job, useJobTasks } from '@/features/jobs/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { BoqTab } from '@/features/boq/boq-tab';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { QcInspectionForm } from '@/features/qc/qc-inspection-form';
import { useQCInspection, useExportSTK } from '@/features/qc/api';
import { useAcceptJob, useUpdateJob } from '@/features/jobs/api';
import { JobTimeline } from '@/features/jobs/job-timeline';
import { formatDMY, formatDateTimeDMY, format24HourTimeBadge } from '@/lib/date';
import { toast } from 'sonner';
import { PhotoSlots5, PhotoSlot } from '@/components/ui/photo-slots-5';
import { OrderCustomerSummary } from '@/features/jobs/order-customer-summary';
import { isQuickJob, isRenovateJob } from '@/features/jobs/job-active-workspace';
import { UserCheck, Camera, ExternalLink, CheckCircle2 } from 'lucide-react';
import { GanttChart } from '@/features/gantt/gantt-chart';
import { Task } from '@/features/gantt/api';

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
}

export function JobDetailTabs({ job, defaultTab = 'task', onClose: _onClose }: JobDetailTabsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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
          toast.success('บันทึกรูปถ่ายเรียบร้อยแล้ว');
        },
        onError: () => {
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
            navigate(`/gantt?jobId=${job.id}&jobNo=${job.job_no}`);
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
            navigate(`/gantt?jobId=${job.id}&jobNo=${job.job_no}`);
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
  }, [tasksData, job, displayTasks]);

  const bookingBadge = job.booking_no || (job as any).bookingNo || (job as any).vfix_no;
  const refBadge = job.external_ref_id || (job as any).ref_id || (job as any).stk_ref || (job as any).externalRefId;

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-soft overflow-hidden shadow-card">
      {/* Header bar */}
      <div className="flex items-center justify-between p-4 border-b border-soft bg-white">
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
          {(job.status === 'NEW' || job.status === 'NEED_REVIEW' || !(job as any).pmt_accepted) && (
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
        </div>
      </div>

      {/* Order & Customer Summary Details (Site address, phone, Google Maps, items, 24-hr schedule) */}
      <OrderCustomerSummary job={job} />

      {/* Tabs Container */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 border-b border-soft bg-white">
            <TabsList className="bg-transparent h-12 flex space-x-2">
              <TabsTrigger 
                value="task" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-black text-black font-semibold rounded-none shadow-none px-4 py-3"
              >
                งาน/Task
              </TabsTrigger>
              <TabsTrigger 
                value="boq" 
                disabled={isQuick}
                title={isQuick ? "งาน Quick Service ไม่มีขั้นตอน BOQ (ข้ามไปตรวจ QC Online ทันที)" : "ประมาณการราคาและรายการพัสดุ (BOQ)"}
                className={`data-[state=active]:border-b-2 data-[state=active]:border-primary font-semibold rounded-none shadow-none px-4 py-3 ${
                  isQuick ? 'opacity-40 cursor-not-allowed text-gray-400' : 'text-black'
                }`}
              >
                <span>BOQ</span>
                {isQuick && <span className="ml-1 text-[10px] text-gray-400 font-normal">(ไม่ใช้ใน Quick)</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="gantt" 
                disabled={isQuick}
                title={isQuick ? "งาน Quick Service ไม่มีขั้นตอนผัง Gantt" : "ผังกำหนดการทำงาน (Gantt Chart)"}
                className={`data-[state=active]:border-b-2 data-[state=active]:border-primary font-semibold rounded-none shadow-none px-4 py-3 ${
                  isQuick ? 'opacity-40 cursor-not-allowed text-gray-400' : 'text-black'
                }`}
              >
                <span>Gantt</span>
                {isQuick && <span className="ml-1 text-[10px] text-gray-400">(ไม่ใช้)</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="qc" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-black text-black font-semibold rounded-none shadow-none px-4 py-3"
              >
                QC
              </TabsTrigger>
              <TabsTrigger 
                value="stk" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-black text-black font-semibold rounded-none shadow-none px-4 py-3"
              >
                ส่งออก STK
              </TabsTrigger>
              <TabsTrigger 
                value="timeline" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-black text-black font-semibold rounded-none shadow-none px-4 py-3"
              >
                ประวัติ (Timeline)
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 p-4 overflow-auto bg-white text-black">
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
                          {!isClosed ? (
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
                          ) : (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                              ส่งงานเรียบร้อย (ห้ามแก้ไข)
                            </span>
                          )}
                        </div>
                      </div>

                      <PhotoSlots5
                        slots={photoSlots}
                        onUpload={handlePhotoUpload}
                        readOnly={isClosed}
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
                <BoqTab job={job} />
              )}
            </TabsContent>

            {/* 3. ผัง Gantt (เฉพาะงาน Renovate) */}
            <TabsContent value="gantt" className="h-full m-0 data-[state=active]:flex flex-col space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-gray-200 rounded-xl">
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
                  <p className="text-xs text-gray-600 mt-0.5">
                    แผนภูมิแสดงแถบเวลาตามแผนงานของช่างแต่ละขั้นตอน พร้อมสถานะความคืบหน้า
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/gantt?jobId=${job.id}&jobNo=${job.job_no}`)}
                    className="text-xs text-indigo-700 bg-white hover:bg-indigo-50 border-indigo-200 font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>เปิดใน Step 2: Project & Gantt ใหญ่ ↗</span>
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-[300px] border border-gray-200 rounded-xl overflow-auto bg-white p-2">
                <GanttChart
                  tasks={finalGanttTasks}
                  className="h-full"
                />
              </div>
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
              />
            </TabsContent>

            {/* 5. ส่งออก STK */}
            <TabsContent value="stk" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <div className="p-4 border-b border-gray-200 bg-white text-black space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div>
                    <h4 className="text-base font-bold text-black flex items-center gap-2">
                      <span>การส่งออกข้อมูลไปยังระบบ STK / BMT</span>
                      {((job as any).stk_status === 'DELIVERED' || job.status === 'CLOSED' || job.status === 'CLOSEJOB') && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>closejob(ส่ง stk แล้ว)</span>
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-black mt-1">
                      ส่งข้อมูลงาน, ยอดเงินตาม BOQ และบันทึกค่าใช้จ่ายเพื่อตัดยอดบัญชีในระบบภายนอก
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="https://vwds.online/wds/pmt-qc"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold shadow-xs transition-colors"
                      title="เปิดหน้าจอตรวจสอบข้อมูล WDS / PMT-QC"
                    >
                      <ExternalLink className="w-4 h-4 text-blue-600" />
                      <span>เปิดระบบ WDS (vwds.online)</span>
                    </a>
                    <Button 
                      variant="primary" 
                      onClick={handleExportStk} 
                      disabled={stkMutation.isPending}
                      className="text-black font-semibold"
                    >
                      {stkMutation.isPending ? 'กำลังส่งออก...' : '🚀 ส่งออก STK'}
                    </Button>
                  </div>
                </div>

                {/* Prominent Direct Link Banner to vwds.online */}
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-black">
                      <ExternalLink className="w-4 h-4 text-blue-600" />
                      <span>ลิงก์ระบบภายนอก: WDS Platform (vwds.online)</span>
                      {((job as any).stk_status === 'DELIVERED' || job.status === 'CLOSED' || job.status === 'CLOSEJOB') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>closejob(ส่ง stk แล้ว)</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-black">
                      ตรวจสอบบันทึกผลการตรวจ QC, รายละเอียดงาน และสถานะเบิกจ่ายจริงบนระบบ WDS
                    </p>
                    <div className="text-[11px] font-mono text-blue-700 font-semibold">
                      https://vwds.online/wds/pmt-qc
                    </div>
                  </div>
                  <a
                    href="https://vwds.online/wds/pmt-qc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
                  >
                    <span>ไปดูข้อมูลในระบบ vwds.online ↗</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-xs pt-2">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="font-bold text-black shrink-0">เลขที่อ้างอิง STK (Ref):</span>
                    <span className="font-mono font-bold text-black">
                      {job.external_ref_id || (job as any).stk_ref || `STK-${job.job_no.replace(/\D/g, '').slice(-8) || '20260901'}`}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="font-bold text-black shrink-0">สถานะการส่งออก:</span>
                    <span className="font-bold text-black">
                      {(job as any).stk_status === 'DELIVERED' || job.status === 'CLOSED' || job.status === 'CLOSEJOB' ? 'closejob(ส่ง stk แล้ว)' : ((job as any).stk_status || 'พร้อมส่งออก (READY)')}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="font-bold text-black shrink-0">เวลาที่ส่งออกล่าสุด:</span>
                    <span className="font-bold text-black">
                      {formatDateTimeDMY((job as any).stk_exported_at || new Date().toISOString())}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <h5 className="text-xs font-bold text-black">สรุปยอดรวมทางการเงินเพื่อเบิกจ่าย</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-xs pt-2">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <span className="font-bold text-black shrink-0">ยอดเงินรวม:</span>
                      <span className="font-mono font-bold text-black">
                        ฿{Number(job.grand_total || (job as any).boq_grand_total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
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
    </div>
  );
}
