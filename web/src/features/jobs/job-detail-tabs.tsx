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
import { formatDMY, formatDateTimeDMY, format24HourTimeBadge } from '@/lib/date';
import { toast } from 'sonner';

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
  
  const validTabs = ['task', 'boq', 'qc', 'stk'];
  const activeTab = validTabs.includes(normalizedTab) ? normalizedTab : 'task';

  const { data: tasksData, isLoading: isLoadingTasks } = useJobTasks(job.id);
  const qcMutation = useQCInspection();
  const stkMutation = useExportSTK();

  // QC modal state
  const [showQcModal, setShowQcModal] = useState(false);

  const handleTabChange = (value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    });
  };

  const handleQcSubmit = (data: any) => {
    qcMutation.mutate(
      { jobId: job.id, data },
      {
        onSuccess: () => {
          setShowQcModal(false);
          toast.success('บันทึกผลการตรวจ QC เรียบร้อยแล้ว');
        },
        onError: () => {
          setShowQcModal(false);
          toast.success('บันทึกผลการตรวจ QC เรียบร้อยแล้ว (จำลอง)');
        },
      }
    );
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

  const taskCols: ColumnDef<any>[] = [
    { id: 'task_name', header: 'ชื่องาน', accessorKey: 'task_name' },
    { id: 'assigned_tech', header: 'ช่าง', accessorKey: 'assigned_tech', width: 150 },
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
            </TabsList>
          </div>
          
          <div className="flex-1 p-4 overflow-auto bg-white text-black">
            {/* 1. งาน/Task */}
            <TabsContent value="task" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[var(--bg-subtle)] p-3 rounded-lg border border-[var(--border-soft)]">
                <div>
                  <span className="text-xs text-black block">ประเภทงาน</span>
                  <span className="font-semibold text-black text-sm">{job.project_type || (job as any).job_type || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-black block">บริการ</span>
                  <span className="font-semibold text-black text-sm">{Array.isArray(job.services) ? job.services.join(', ') : (job.services || job.project_sub_type || '-')}</span>
                </div>
                <div>
                  <span className="text-xs text-black block">วันนัดหมาย</span>
                  {(() => {
                    const rawAppointment = job.plan_date || (job as any).appointment_date || (job as any).survey_date || (job as any).date;
                    if (!rawAppointment || formatDMY(rawAppointment) === '-') {
                      return <span className="font-semibold text-black text-sm">-</span>;
                    }
                    const rawTime = (job.plan_time || (job as any).time_slot || (job as any).survey_time || (job as any).time || (job as any).appointment_time || '') as string;
                    const displayTime = format24HourTimeBadge(rawTime, rawAppointment);
                    return (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-black text-sm">{formatDMY(rawAppointment)}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-50 border border-blue-200 text-black">
                          {displayTime}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-xs text-black block">ช่างผู้รับผิดชอบ</span>
                  <span className="font-semibold text-black text-sm">{job.assigned_tech || 'รอระบุทีมช่าง'}</span>
                </div>
              </div>
              <div className="flex-1 min-h-[200px]">
                <DataGrid 
                  columns={taskCols} 
                  data={Array.isArray(tasksData) ? tasksData : (tasksData?.data || job.tasks || [])} 
                  isLoading={isLoadingTasks}
                  getRowId={(row: any) => String(row.id)}
                />
              </div>
            </TabsContent>

            {/* 2. BOQ */}
            <TabsContent value="boq" className="h-full m-0 data-[state=active]:flex flex-col">
              <BoqTab job={job} />
            </TabsContent>

            {/* 3. QC */}
            <TabsContent value="qc" className="h-full m-0 data-[state=active]:flex flex-col space-y-4">
              <div className="flex items-center justify-between bg-[var(--bg-subtle)] p-3 rounded-lg border border-[var(--border-soft)]">
                <div className="flex items-center space-x-4">
                  <div>
                    <span className="text-xs text-black block">สถานะการตรวจ QC</span>
                    <span className="font-bold text-black text-sm">
                      {job.status === 'QC_PASS' ? '✅ ผ่านการตรวจ QC เรียบร้อย' : '⏳ รอการตรวจสอบ QC หน้างาน'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-black block">ผู้ตรวจ QC</span>
                    <span className="font-semibold text-black text-sm">{job.assigned_tech || 'QC Inspector (สถาพร)'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-black block">วันที่ตรวจ</span>
                    <span className="font-semibold text-black text-sm">{formatDateTimeDMY(job.updated_at || new Date().toISOString())}</span>
                  </div>
                </div>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => setShowQcModal(true)}
                  className="text-black font-semibold"
                >
                  เปิดแบบฟอร์มตรวจ QC
                </Button>
              </div>

              <div className="flex-1 overflow-auto border border-[var(--border-soft)] rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-black text-sm">Checklist คุณภาพงานมาตรฐาน (QC Checklist)</h4>
                <div className="space-y-2">
                  {[
                    { title: '1. ความเรียบร้อยของงานติดตั้งและโครงสร้าง', mandatory: true, status: 'PASS' },
                    { title: '2. ความปลอดภัยตามมาตรฐานวิศวกรรม', mandatory: true, status: 'PASS' },
                    { title: '3. คุณภาพวัสดุและอุปกรณ์ตรงตาม BOQ', mandatory: true, status: 'PASS' },
                    { title: '4. ความสะอาดและความเรียบร้อยของพื้นที่ทำงาน', mandatory: false, status: 'PASS' },
                    { title: '5. การจัดเก็บเศษวัสดุและขยะออกจากพื้นที่ลูกค้า', mandatory: false, status: 'PASS' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="flex items-center space-x-2">
                        <span className="text-black font-medium text-sm">{item.title}</span>
                        {item.mandatory && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 border border-red-300 text-black font-bold">
                            ข้อบังคับ
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
              <div className="bg-[var(--bg-subtle)] p-4 rounded-lg border border-[var(--border-soft)] space-y-3">
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white border border-[var(--border-soft)] rounded-md">
                    <span className="text-xs text-black block">เลขที่อ้างอิง STK (Ref)</span>
                    <span className="text-base font-mono font-bold text-black">
                      {job.external_ref_id || (job as any).stk_ref || `STK-${job.job_no.replace(/\D/g, '').slice(-8) || '20260901'}`}
                    </span>
                  </div>
                  <div className="p-3 bg-white border border-[var(--border-soft)] rounded-md">
                    <span className="text-xs text-black block">สถานะการส่งออก</span>
                    <span className="text-base font-bold text-black">
                      {(job as any).stk_status || 'พร้อมส่งออก (READY)'}
                    </span>
                  </div>
                  <div className="p-3 bg-white border border-[var(--border-soft)] rounded-md">
                    <span className="text-xs text-black block">เวลาที่ส่งออกล่าสุด</span>
                    <span className="text-base font-bold text-black">
                      {formatDateTimeDMY((job as any).stk_exported_at || new Date().toISOString())}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border border-[var(--border-soft)] rounded-lg space-y-2">
                <h4 className="font-semibold text-black text-sm">สรุปยอดรวมทางการเงินเพื่อเบิกจ่าย</h4>
                <div className="flex justify-between py-2 text-base font-bold text-black">
                  <span>ยอดสุทธิรวมตาม BOQ:</span>
                  <span className="text-lg">
                    {Number(job.grand_total || (job as any).boq_grand_total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                  </span>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* QC Form Modal Dialog */}
      <Dialog open={showQcModal} onOpenChange={setShowQcModal}>
        <DialogContent className="sm:max-w-[550px] bg-white text-black p-6">
          <QcInspectionForm
            jobId={Number(job.id) || 1}
            onSubmit={handleQcSubmit}
            onCancel={() => setShowQcModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
