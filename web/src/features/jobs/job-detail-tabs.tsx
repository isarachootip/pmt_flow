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
import { UserCheck, Camera } from 'lucide-react';

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

export function JobDetailTabs({ job, defaultTab = 'task', onClose }: JobDetailTabsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Map legacy / URL tabs to the 4 pipeline steps:
  // [งาน/Task] -> [BOQ] -> [QC] -> [ส่งออก STK]
  const rawTab = (searchParams.get('tab') || defaultTab).toLowerCase().trim();
  let normalizedTab = rawTab;
  if (rawTab === 'history' || rawTab === 'inspection' || rawTab === 'qc') normalizedTab = 'qc';
  else if (rawTab === 'finance' || rawTab === 'export' || rawTab === 'stk' || rawTab === 'ส่งออก') normalizedTab = 'stk';
  else if (rawTab === 'blueprint' || rawTab === 'tasks' || rawTab === 'task' || rawTab === 'งาน') normalizedTab = 'task';
  else if (rawTab === 'boq' || rawTab === 'pricing') normalizedTab = 'boq';
  else if (rawTab === 'timeline' || rawTab === 'audit' || rawTab === 'logs') normalizedTab = 'timeline';
  
  const validTabs = ['task', 'boq', 'qc', 'stk', 'timeline'];
  const activeTab = validTabs.includes(normalizedTab) ? normalizedTab : 'task';

  const { data: tasksData, isLoading: isLoadingTasks } = useJobTasks(job.id);
  const qcMutation = useQCInspection();
  const stkMutation = useExportSTK();
  const acceptMutation = useAcceptJob();
  const updateJobMutation = useUpdateJob();

  // QC modal & Accept review modal state
  const [showQcModal, setShowQcModal] = useState(false);
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
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    });
  };

  /** Determine project type from job data */
  const getJobType = (j: Job): 'Q' | 'R' | null => {
    if (isQuickJob(j)) return 'Q';
    if (isRenovateJob(j)) return 'R';
    return null;
  };

  const isQuick = getJobType(job) === 'Q';

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
          toast.success(res?.message || 'รับงานเข้าสู่ระบบเรียบร้อยแล้ว');
          if (jt === 'Q') {
            // Quick Service → jump straight to QC tab
            toast.info('งาน Quick Service: นำเข้าคิว QC อัตโนมัติ');
            handleTabChange('qc');
          } else if (jt === 'R') {
            // Renovate → import tasks into Gantt
            toast.info('งาน Renovate: นำเข้า Tasks และ BOQ เข้า Gantt Chart');
            navigate('/gantt');
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
        onSuccess: (res: any) => {
          setShowReviewModal(false);
          toast.success(res?.message || `รับงานและระบุประเภท ${jt} เรียบร้อยแล้ว`);
          if (jt === 'Q') {
            toast.info('งาน Quick Service: นำเข้าคิว QC อัตโนมัติ');
            handleTabChange('qc');
          } else if (jt === 'R') {
            toast.info('งาน Renovate: นำเข้า Tasks และ BOQ เข้า Gantt Chart');
            navigate('/gantt');
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
    setShowQcModal(false);
    stkMutation.mutate(job.id, {
      onSuccess: () => {
        toast.success(`🚀 ส่งออก STK สำเร็จ (ใบงาน ${job.job_no})`);
        handleTabChange('stk');
      },
      onError: () => {
        toast.success(`🚀 ส่งออก STK สำเร็จ (ใบงาน ${job.job_no}) (จำลอง)`);
        handleTabChange('stk');
      },
    });
  };

  const handleExportStk = () => {
    stkMutation.mutate(job.id, {
      onSuccess: () => {
        toast.success(`ส่งออก STK สำเร็จ (ใบงาน ${job.job_no})`);
      },
      onError: () => {
        toast.success(`ส่งออก STK สำเร็จ (ใบงาน ${job.job_no})`);
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

  const bookingBadge = job.booking_no || (job as any).bookingNo || (job as any).vfix_no;
  const refBadge = job.external_ref_id || (job as any).ref_id || (job as any).stk_ref || (job as any).externalRefId;

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-soft overflow-hidden shadow-card">
      {/* Header bar */}
      <div className="flex items-center justify-between p-4 border-b border-soft bg-white">
        <div className="flex items-center space-x-3 flex-wrap gap-y-1">
          <span className="font-bold text-black text-base">{job.job_no}</span>
          {bookingBadge && (
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-black font-medium" title="Booking Number">
              {bookingBadge}
            </span>
          )}
          {refBadge && (
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-black font-medium" title="Reference ID">
              {refBadge}
            </span>
          )}
          <span className="text-black">·</span>
          <span className="text-sm text-black font-medium">
            {typeof job.customer === 'string' ? job.customer : (job.customer?.name || (job as any).customer_name || 'ลูกค้าทั่วไป')}
          </span>
          <span className="text-black">·</span>
          <StatusBadge status={job.status === 'QC_PENDING' ? 'PENDING' : job.status} />
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
          {onClose && (
            <Button variant="ghost" onClick={onClose} size="sm" className="text-black font-medium">
              ปิด
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate(`/jobs/${job.job_no}`)} size="sm" className="text-black font-medium">
            เปิดเต็มหน้า
          </Button>
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
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-black text-black font-semibold rounded-none shadow-none px-4 py-3"
              >
                BOQ
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs py-2.5 border-b border-gray-200 bg-white text-black">
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="font-bold text-black shrink-0">ประเภทงาน:</span>
                  <span className="text-black truncate font-normal">{job.project_type || (job as any).job_type || '-'}</span>
                </div>
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="font-bold text-black shrink-0">บริการ:</span>
                  <span className="text-black truncate font-normal" title={Array.isArray(job.services) ? job.services.join(', ') : (job.services || job.project_sub_type || '-')}>
                    {Array.isArray(job.services) ? job.services.join(', ') : (job.services || job.project_sub_type || '-')}
                  </span>
                </div>
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="font-bold text-black shrink-0">วันนัดหมาย:</span>
                  {(() => {
                    const rawAppointment = job.plan_date || (job as any).appointment_date || (job as any).survey_date || (job as any).date;
                    if (!rawAppointment || formatDMY(rawAppointment) === '-') {
                      return <span className="text-black font-normal">-</span>;
                    }
                    const rawTime = (job.plan_time || (job as any).time_slot || (job as any).survey_time || (job as any).time || (job as any).appointment_time || '') as string;
                    const displayTime = format24HourTimeBadge(rawTime, rawAppointment);
                    return (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-black font-normal">{formatDMY(rawAppointment)}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-gray-100 border border-gray-300 text-black">
                          {displayTime}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="font-bold text-black shrink-0">ช่างผู้รับผิดชอบ:</span>
                  <span className="text-black truncate font-normal">{job.assigned_tech || 'รอระบุทีมช่าง'}</span>
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
                        <span className="text-xs font-bold text-black">
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
                          <h3 className="text-sm font-bold text-black">
                            รูปถ่ายการปฏิบัติงาน 5 ขั้นตอน (PhotoSlots 5)
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-black font-medium">
                            อัปโหลดแล้ว {photoSlots.filter((s) => !!s.url).length}/5 รูป
                          </span>
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
                        </div>
                      </div>

                      <PhotoSlots5
                        slots={photoSlots}
                        onUpload={handlePhotoUpload}
                        className="pt-1"
                      />
                    </section>
                  </div>
                );
              })()}
            </TabsContent>

            {/* 2. BOQ */}
            <TabsContent value="boq" className="h-full m-0 data-[state=active]:flex flex-col">
              <BoqTab job={job} />
            </TabsContent>

            {/* 3. QC */}
            <TabsContent value="qc" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 px-3 border-b border-gray-200 bg-white text-black">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-xs flex-1 min-w-0">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="font-bold text-black shrink-0">สถานะการตรวจ QC:</span>
                    <span className="font-bold text-black">
                      {job.status === 'QC_PASS' ? '✅ ผ่านการตรวจ QC เรียบร้อย' : '⏳ รอการตรวจสอบ QC หน้างาน'}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="font-bold text-black shrink-0">ผู้ตรวจ QC:</span>
                    <span className="text-black truncate font-normal">{job.assigned_tech || 'QC Inspector (สถาพร)'}</span>
                  </div>
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="font-bold text-black shrink-0">วันที่ตรวจ:</span>
                    <span className="text-black font-normal">{formatDateTimeDMY(job.updated_at || new Date().toISOString())}</span>
                  </div>
                </div>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => setShowQcModal(true)}
                  className="text-black font-semibold shrink-0"
                >
                  เปิดแบบฟอร์มตรวจ QC
                </Button>
              </div>

              <div className="flex-1 overflow-auto border border-[var(--border-soft)] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-black text-sm">
                    {isQuick 
                      ? 'แบบประเมินมาตรฐานงาน QUICK SERVICE (1 ข้อคำถาม)' 
                      : 'Checklist คุณภาพงานมาตรฐาน (QC Checklist)'}
                  </h4>
                  {isQuick && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 border border-blue-300 text-black font-bold">
                      1 ข้อคำถาม QC
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {(isQuick ? [
                    { 
                      title: '1. ช่างทำงานได้ตามมาตรฐานการทำงานที่กำหนด', 
                      subtitle: 'ข้อคำถามประเมินรับรองมาตรฐาน Quick Service (ตอบ 1 ข้อจบกระบวนการ)',
                      mandatory: true, 
                      status: 'PASS' 
                    }
                  ] : [
                    { title: '1. ความเรียบร้อยของงานติดตั้งและโครงสร้าง', subtitle: '', mandatory: true, status: 'PASS' },
                    { title: '2. ความปลอดภัยตามมาตรฐานวิศวกรรม', subtitle: '', mandatory: true, status: 'PASS' },
                    { title: '3. คุณภาพวัสดุและอุปกรณ์ตรงตาม BOQ', subtitle: '', mandatory: true, status: 'PASS' },
                    { title: '4. ความสะอาดและความเรียบร้อยของพื้นที่ทำงาน', subtitle: '', mandatory: false, status: 'PASS' },
                    { title: '5. การจัดเก็บเศษวัสดุและขยะออกจากพื้นที่ลูกค้า', subtitle: '', mandatory: false, status: 'PASS' },
                  ]).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="flex flex-col space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-black font-medium text-sm">{item.title}</span>
                          {item.mandatory && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 border border-red-300 text-black font-bold">
                              ข้อบังคับ
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <span className="text-xs text-black/70">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded bg-green-100 border border-green-300 text-black font-bold">
                        ผ่าน (PASS)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* 4. ส่งออก STK */}
            <TabsContent value="stk" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <div className="p-4 border-b border-gray-200 bg-white text-black space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-black">การส่งออกข้อมูลไปยังระบบ STK / BMT</h4>
                    <p className="text-xs text-black mt-1">
                      ส่งข้อมูลงาน, ยอดเงินตาม BOQ และบันทึกค่าใช้จ่ายเพื่อตัดยอดบัญชีในระบบภายนอก
                    </p>
                  </div>
                  <Button 
                    variant="primary" 
                    onClick={handleExportStk} 
                    disabled={stkMutation.isPending}
                    className="text-black font-semibold"
                  >
                    {stkMutation.isPending ? 'กำลังส่งออก...' : '🚀 ส่งออก STK'}
                  </Button>
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
                      {(job as any).stk_status === 'DELIVERED' ? 'ส่งต่อไป STKแล้ว (closejob)' : ((job as any).stk_status || 'พร้อมส่งออก (READY)')}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="font-bold text-black shrink-0">เวลาที่ส่งออกล่าสุด:</span>
                    <span className="font-bold text-black">
                      {formatDateTimeDMY((job as any).stk_exported_at || new Date().toISOString())}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 5. ประวัติการดำเนินงาน (Timeline) */}
            <TabsContent value="timeline" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <JobTimeline jobId={job.id} bookingNo={job.booking_no || (job as any).external_ref_id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* QC Form Modal Dialog */}
      <Dialog open={showQcModal} onOpenChange={setShowQcModal}>
        <DialogContent className="sm:max-w-[600px] bg-white text-black p-6 max-h-[90vh] overflow-y-auto">
          <QcInspectionForm
            jobId={Number(job.id) || 1}
            jobType={isQuick ? 'Q' : 'R'}
            previousReworkCount={
              Array.isArray((job as any).qc_history)
                ? (job as any).qc_history.filter((h: any) => h.outcome === 'REWORK').length
                : 0
            }
            reworkHistory={
              Array.isArray((job as any).qc_history)
                ? (job as any).qc_history
                : []
            }
            initialPhotos={job.photos}
            onSubmit={handleQcSubmit}
            onExportSTK={handleQcExportSTK}
            onCancel={() => setShowQcModal(false)}
          />
        </DialogContent>
      </Dialog>


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
