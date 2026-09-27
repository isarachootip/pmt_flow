import { useState, useEffect } from 'react';
import { Job } from './api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Layers, Hammer, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface ConvertBoqDrawerProps {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialItems?: any[];
}

export function ConvertBoqDrawer({ job, open, onOpenChange }: ConvertBoqDrawerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [baseStartDate, setBaseStartDate] = useState<string | undefined>(
    job.plan_start_date || job.appointment_date || new Date().toISOString().split('T')[0]
  );

  // 3-Level hierarchy state: Areas -> Tasks
  const [areas, setAreas] = useState<any[]>([]);

  // Fetch 3-level preview from backend
  const { data: previewData, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['boq-preview', job.id, open],
    queryFn: async () => {
      try {
        const res = await api.post<any>(`/api/v1/jobs/${job.id}/boq/preview`, {
          base_start_date: baseStartDate
        });
        return res;
      } catch {
        return null;
      }
    },
    enabled: open
  });

  // Sync preview data into editable state
  useEffect(() => {
    if (previewData?.areas && previewData.areas.length > 0) {
      setAreas(previewData.areas);
    } else if (open) {
      // Fallback 2 Areas: ห้องรับแขก (2 tasks) + ห้องครัว (3 tasks)
      const baseDate = baseStartDate || new Date().toISOString().slice(0, 10);
      const defaultAreas = [
        {
          id: `AREA_${job.id}_1`,
          name: 'ห้องรับแขก (Living Room)',
          assigned_qc: 'วิชัย ตรวจดี (ช่าง QC Lead)',
          tasks: [
            {
              id: `T_${job.id}_1_1`,
              task_name: 'รื้อถอนและเตรียมพื้นผิวห้องรับแขก',
              duration_days: 2,
              assigned_tech: 'สมศักดิ์ ช่างเอก',
              plan_start_date: baseDate,
              status: 'PLANNED'
            },
            {
              id: `T_${job.id}_1_2`,
              task_name: 'ติดตั้งพื้นไม้ลามิเนตห้องรับแขก',
              duration_days: 3,
              assigned_tech: 'สมบัติ ช่างโท',
              plan_start_date: baseDate,
              status: 'PLANNED'
            }
          ]
        },
        {
          id: `AREA_${job.id}_2`,
          name: 'ห้องครัว (Kitchen)',
          assigned_qc: 'สถาพร ตรวจการ (QC)',
          tasks: [
            {
              id: `T_${job.id}_2_1`,
              task_name: 'เดินท่อน้ำดีและท่อน้ำทิ้งห้องครัว',
              duration_days: 2,
              assigned_tech: 'ชาญชัย ช่างตรี',
              plan_start_date: baseDate,
              status: 'PLANNED'
            },
            {
              id: `T_${job.id}_2_2`,
              task_name: 'ปูกระเบื้องผนังและเคาน์เตอร์ครัว',
              duration_days: 3,
              assigned_tech: 'มานพ ช่างกระเบื้อง',
              plan_start_date: baseDate,
              status: 'PLANNED'
            },
            {
              id: `T_${job.id}_2_3`,
              task_name: 'ติดตั้งเครื่องดูดควันและซิงค์ล้างจาน',
              duration_days: 1,
              assigned_tech: 'อนุชา ช่างติดตั้ง',
              plan_start_date: baseDate,
              status: 'PLANNED'
            }
          ]
        }
      ];
      setAreas(defaultAreas);
    }
  }, [previewData, open, baseStartDate, job.id]);

  const convertMutation = useMutation({
    mutationFn: async (payload: any) => {
      const result = await api.post(`/api/v1/jobs/${job.id}/boq/convert-project`, payload);
      return result;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['boq', job.id] });
      toast.success(data?.message || 'แปลง BOQ เป็นโครงการ 3 ระดับสำเร็จ');
      onOpenChange(false);
      navigate('/gantt');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'เกิดข้อผิดพลาดในการแปลง BOQ');
    }
  });

  const handleUpdateAreaQc = (areaIdx: number, qcName: string) => {
    const next = [...areas];
    next[areaIdx].assigned_qc = qcName;
    setAreas(next);
  };

  const handleUpdateTaskTech = (areaIdx: number, taskIdx: number, techName: string) => {
    const next = [...areas];
    next[areaIdx].tasks[taskIdx].assigned_tech = techName;
    next[areaIdx].tasks[taskIdx].tech = techName;
    setAreas(next);
  };

  const handleUpdateTaskDuration = (areaIdx: number, taskIdx: number, days: number) => {
    const next = [...areas];
    next[areaIdx].tasks[taskIdx].duration_days = days;
    setAreas(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validation: Every area must have assigned QC
    for (const a of areas) {
      if (!a.assigned_qc || !String(a.assigned_qc).trim()) {
        toast.error(`พื้นที่ "${a.name}" ยังไม่มีการระบุช่าง QC (Strictly 1 QC per Area)`);
        return;
      }
    }

    // 2. Validation: Every task must have >= 1 technician
    for (const a of areas) {
      for (const t of a.tasks || []) {
        const tech = (t.assigned_tech || t.tech || '').trim();
        if (!tech) {
          toast.error(`Task "${t.task_name || t.name}" ในพื้นที่ "${a.name}" ต้องมีช่างผู้รับผิดชอบอย่างน้อย 1 คน`);
          return;
        }

        // 3. Validation: QC must NOT be the same as task technician
        const qcLower = String(a.assigned_qc).trim().toLowerCase();
        const techLower = tech.toLowerCase();
        if (qcLower === techLower || (techLower.length > 2 && qcLower.includes(techLower)) || (qcLower.length > 2 && techLower.includes(qcLower))) {
          toast.error(`เจ้าหน้าที่ QC (${a.assigned_qc}) ห้ามเป็นคนเดียวกับช่างผู้ปฏิบัติงาน (${tech}) ใน Task "${t.task_name || t.name}"`);
          return;
        }
      }
    }

    convertMutation.mutate({
      base_start_date: baseStartDate,
      areas
    });
  };

  const totalTasks = areas.reduce((sum, a) => sum + (a.tasks?.length || 0), 0);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-white text-black shadow-2xl focus:outline-none flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-black" />
              <div>
                <Dialog.Title className="text-base font-bold text-black">
                  Preview โครงสร้างโครงการ 3 ระดับ (Project → งานหลัก → Task)
                </Dialog.Title>
                <span className="text-xs text-black font-mono">
                  {job.job_no} | Booking: {job.booking_no || '-'}
                </span>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="text-black hover:bg-gray-100 p-1.5 rounded-full transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-black" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden text-black">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Level 1: Project Details */}
              <div className="bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-soft)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-black text-white">LEVEL 1</span>
                    <h3 className="font-bold text-sm text-black">ข้อมูลโครงการ (Project)</h3>
                  </div>
                  <span className="text-xs font-medium text-black">
                    ลูกค้า: {typeof job.customer === 'string' ? job.customer : job.customer?.name || 'ลูกค้าทั่วไป'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-black block mb-1 font-semibold">Booking No</span>
                    <Input value={job.booking_no || job.job_no} readOnly className="bg-white text-black font-mono font-bold" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-black block mb-1">วันเริ่มงานตามแผน (Base Start Date)</label>
                    <DatePicker value={baseStartDate} onChange={setBaseStartDate} />
                  </div>
                </div>
              </div>

              {/* Level 2 & 3: Areas & Tasks */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">LEVEL 2 & 3</span>
                    <h4 className="font-bold text-black text-sm">
                      งานหลัก (Areas: {areas.length}) และงานย่อย (Tasks: {totalTasks})
                    </h4>
                  </div>
                  <span className="text-xs text-black font-medium">
                    * กฎ: 1 Area มี QC 1 คน และ QC ห้ามเป็นช่างใน Task
                  </span>
                </div>

                {isLoadingPreview ? (
                  <div className="p-8 text-center text-black font-medium">กำลังเตรียม Preview โครงสร้าง...</div>
                ) : (
                  <div className="space-y-4">
                    {areas.map((area, aIdx) => (
                      <div key={area.id || aIdx} className="border border-[var(--border-soft)] rounded-xl overflow-hidden bg-white shadow-sm">
                        
                        {/* Area Header */}
                        <div className="bg-gray-50 p-3.5 border-b border-[var(--border-soft)] flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-900 text-xs font-bold flex items-center justify-center">
                              {aIdx + 1}
                            </span>
                            <span className="font-bold text-black text-sm">งานหลัก: {area.name}</span>
                          </div>

                          {/* QC Assignment per Area */}
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs text-black font-semibold">QC ประจำพื้นที่:</span>
                            <Input
                              value={area.assigned_qc || ''}
                              onChange={(e) => handleUpdateAreaQc(aIdx, e.target.value)}
                              placeholder="ระบุชื่อช่าง QC"
                              className="h-8 w-56 text-xs bg-white text-black font-medium border-emerald-300"
                            />
                          </div>
                        </div>

                        {/* Task List under Area */}
                        <div className="p-3 space-y-2.5">
                          {(area.tasks || []).map((task: any, tIdx: number) => {
                            const isQcConflict = area.assigned_qc && 
                              task.assigned_tech && 
                              String(area.assigned_qc).trim().toLowerCase() === String(task.assigned_tech).trim().toLowerCase();

                            return (
                              <div 
                                key={task.id || tIdx} 
                                className={`flex flex-col sm:flex-row gap-2 sm:items-center p-2.5 rounded-lg border transition ${
                                  isQcConflict ? 'border-red-400 bg-red-50/50' : 'border-gray-200 bg-gray-50/40'
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                  <Hammer className="w-4 h-4 text-black shrink-0" />
                                  <span className="text-xs font-medium text-black">{task.task_name || task.name}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="w-20">
                                    <Input
                                      type="number"
                                      value={task.duration_days || 1}
                                      onChange={(e) => handleUpdateTaskDuration(aIdx, tIdx, parseInt(e.target.value) || 1)}
                                      min="1"
                                      className="h-8 text-xs bg-white text-black font-mono text-center"
                                      placeholder="วัน"
                                    />
                                  </div>

                                  <div className="w-48">
                                    <Input
                                      value={task.assigned_tech || task.tech || ''}
                                      onChange={(e) => handleUpdateTaskTech(aIdx, tIdx, e.target.value)}
                                      placeholder="ระบุช่างผู้ปฏิบัติงาน"
                                      className={`h-8 text-xs bg-white text-black font-medium ${
                                        isQcConflict ? 'border-red-500 ring-1 ring-red-500' : ''
                                      }`}
                                    />
                                  </div>

                                  <span className="px-2 py-1 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                    {task.status || 'PLANNED'}
                                  </span>
                                </div>

                                {isQcConflict && (
                                  <div className="w-full text-xs text-red-600 flex items-center gap-1 font-semibold pt-1">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>ข้อผิดพลาด: ช่างผู้ปฏิบัติงานห้ามเป็นคนเดียวกับ QC ประจำพื้นที่</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 sm:p-6 border-t border-gray-200 bg-[var(--bg-subtle)] flex items-center justify-between">
              <span className="text-xs text-black font-medium">
                พร้อมแปลง {areas.length} งานหลัก และ {totalTasks} Tasks เข้าสู่โครงการ
              </span>
              <div className="flex space-x-3">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-black font-medium">
                  ยกเลิก
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={convertMutation.isPending || isLoadingPreview} 
                  className="text-black font-semibold bg-primary hover:bg-primary/90 shadow-sm"
                >
                  {convertMutation.isPending ? 'กำลังแปลงเข้า Project...' : '🚀 ยืนยันแปลงเข้า Project'}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
