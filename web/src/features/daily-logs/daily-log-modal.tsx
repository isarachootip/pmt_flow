import { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker24 } from '@/components/ui/time-picker-24';
import { PhotoSlots5, PhotoSlot } from '@/components/ui/photo-slots-5';
import { useCreateDailyLog, useDailyLogs } from './api';
import { DailyLogList } from './daily-log-list';
import { useGanttJobs, useGanttTasks, Task } from '../gantt/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Clock, Calendar, Sparkles, CheckCircle2, PenLine, History, Plus } from 'lucide-react';

interface DailyLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedJobId?: string | number;
  preselectedTaskId?: string | number;
  preselectedTask?: Task | null;
}

const initialSlots: PhotoSlot[] = [
  { id: 'before', label: '1. ก่อนเริ่มงาน (Before)' },
  { id: 'progress1', label: '2. ระหว่างทำ 1 (Progress 1)' },
  { id: 'progress2', label: '3. ระหว่างทำ 2 (Progress 2)' },
  { id: 'test', label: '4. ทดสอบระบบ (Testing)' },
  { id: 'after', label: '5. หลังเสร็จสิ้น (After)' },
];

export function DailyLogModal({ 
  open, 
  onOpenChange, 
  preselectedJobId, 
  preselectedTaskId,
  preselectedTask 
}: DailyLogModalProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [dayNumber, setDayNumber] = useState(1);
  const [totalDays, setTotalDays] = useState(1);
  const [technician, setTechnician] = useState('');
  const [progress, setProgress] = useState(50);
  const [workDesc, setWorkDesc] = useState('');
  const [issues, setIssues] = useState('');
  const [materials, setMaterials] = useState('');
  const [slots, setSlots] = useState<PhotoSlot[]>(initialSlots);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Fetch available jobs and tasks for selectors
  const { data: jobs } = useGanttJobs();
  const { data: allTasks } = useGanttTasks(selectedJobId || preselectedJobId);

  useEffect(() => {
    if (preselectedJobId) {
      setSelectedJobId(String(preselectedJobId));
    } else if (jobs && jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(String(jobs[0].id));
    }
  }, [preselectedJobId, jobs]);

  useEffect(() => {
    if (preselectedTaskId) {
      setSelectedTaskId(String(preselectedTaskId));
    } else if (preselectedTask) {
      setSelectedTaskId(String(preselectedTask.id));
      if (preselectedTask.assigned_tech) {
        setTechnician(preselectedTask.assigned_tech);
      }
      if (preselectedTask.progress_percent !== undefined) {
        setProgress(preselectedTask.progress_percent);
      }
    }
  }, [preselectedTaskId, preselectedTask]);

  // When task changes or loads, update defaults and ensure valid selection
  useEffect(() => {
    if (allTasks && allTasks.length > 0) {
      const match = allTasks.find(t => String(t.id) === String(selectedTaskId));
      if (!selectedTaskId || !match) {
        const first = allTasks[0];
        setSelectedTaskId(String(first.id));
        if (first.assigned_tech) setTechnician(first.assigned_tech);
        if (first.progress_percent !== undefined) setProgress(first.progress_percent);
        if (first.duration_days) setTotalDays(first.duration_days);
      } else {
        if (match.assigned_tech && !technician) setTechnician(match.assigned_tech);
        if (match.duration_days) setTotalDays(match.duration_days);
      }
    }
  }, [selectedTaskId, allTasks]);

  const activeJobId = selectedJobId || (jobs && jobs.length > 0 ? String(jobs[0].id) : '1');
  const createLog = useCreateDailyLog(activeJobId);
  const { data: logs } = useDailyLogs(activeJobId);

  const applyPreset = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
  };

  const handleJobChange = (newJobId: string) => {
    setSelectedJobId(newJobId);
    setSelectedTaskId('');
  };

  const handleUpload = (slotId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, url: dataUrl } : s));
    };
    reader.readAsDataURL(file);
  };

  const currentTaskObj = allTasks?.find(t => String(t.id) === String(selectedTaskId)) || preselectedTask;
  const currentJobObj = jobs?.find(j => String(j.id) === String(activeJobId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJobId) {
      toast.error('กรุณาเลือกโครงการ');
      return;
    }
    const finalJobId = selectedJobId || activeJobId;
    const finalTaskId = selectedTaskId || (allTasks && allTasks.length > 0 ? String(allTasks[0].id) : '1');
    const matchedTask = allTasks?.find(t => String(t.id) === String(finalTaskId)) || currentTaskObj;
    const matchedJob = jobs?.find(j => String(j.id) === String(finalJobId)) || currentJobObj;

    try {
      const photos = slots.filter(s => s.url).map(s => s.url!);
      await createLog.mutateAsync({
        job_id: finalJobId,
        job_no: matchedJob?.job_no || (typeof finalJobId === 'string' && finalJobId.startsWith('JOB') ? finalJobId : undefined),
        task_id: finalTaskId,
        task_name: matchedTask?.task_name || 'งานที่เลือก',
        log_date: dateStr,
        start_time: startTime,
        end_time: endTime,
        day_number: Number(dayNumber) || 1,
        total_days: Number(totalDays) || 1,
        technician: technician || 'ช่างประจำโครงการ',
        progress_percent: Number(progress) || 0,
        work_description: (workDesc.trim() || 'บันทึกการปฏิบัติงานประจำวัน') + (issues ? `\n\n⚠️ ปัญหา: ${issues}` : '') + (materials ? `\n\n📦 วัสดุ: ${materials}` : ''),
        photos: photos,
        is_completed: userConfirmed || progress >= 100 || dayNumber >= totalDays,
        user_confirmed: userConfirmed
      });
      toast.success('บันทึกงานประจำวันเรียบร้อยแล้ว');
      setActiveTab('history');
      // Reset form
      setWorkDesc('');
      setIssues('');
      setMaterials('');
      setSlots(initialSlots);
    } catch (err: any) {
      toast.error(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-white p-6 rounded-2xl border border-border-soft shadow-2xl">
        <DialogHeader className="border-b border-border-soft pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-black flex items-center gap-2">
                <span>บันทึกการปฏิบัติงานช่างประจำวัน</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-mono font-bold">24-Hour</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                บันทึกความคืบหน้ารายวัน เวลาทำงานจริง 24 ชม. และแนบรูปถ่ายผลงาน 5 ช่องมาตรฐาน
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'form' | 'history')} className="w-full mt-4">
          <div className="flex items-center justify-between border-b border-border-soft pb-2 flex-wrap gap-2">
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="form" className="text-xs font-bold flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 cursor-pointer">
                <PenLine className="w-3.5 h-3.5" />
                <span>📝 ลงบันทึกงานใหม่</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs font-bold flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 cursor-pointer">
                <History className="w-3.5 h-3.5" />
                <span>📋 ประวัติการบันทึกงาน</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-mono">
                  {logs?.length || 0}
                </span>
              </TabsTrigger>
            </TabsList>
            {activeTab === 'history' && (
              <Button 
                type="button" 
                size="sm" 
                onClick={() => setActiveTab('form')}
                className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ลงบันทึกวันใหม่</span>
              </Button>
            )}
          </div>

          <TabsContent value="form" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          
          {/* Project & Task Selection Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-bold text-black">เลือกโครงการ (Project / Booking)</Label>
              <select 
                value={selectedJobId} 
                onChange={(e) => handleJobChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-black focus:outline-none focus:border-indigo-500 shadow-2xs"
              >
                {jobs && jobs.length > 0 ? (
                  jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.job_no} - {j.customer_name} ({j.service_type || 'โครงการ'})
                    </option>
                  ))
                ) : (
                  <option value="1">J2401-001 (โครงการทดสอบ)</option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-black">เลือกงานย่อย (Task)</Label>
              <select 
                value={selectedTaskId} 
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-black focus:outline-none focus:border-indigo-500 shadow-2xs"
              >
                {allTasks && allTasks.length > 0 ? (
                  allTasks.map(t => (
                    <option key={t.id} value={t.id}>
                      [{t.area_name || 'งานหลัก'}] {t.task_name} - ({t.assigned_tech || 'ช่าง'})
                    </option>
                  ))
                ) : (
                  <option value="1">งานเตรียมพื้นผิวและรื้อถอน</option>
                )}
              </select>
            </div>
          </div>

          {/* Date & Technician */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-bold text-black">วันที่บันทึก (DD/MM/YYYY)</Label>
              <DatePicker value={dateStr} onChange={setDateStr} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-black">ช่างผู้รับผิดชอบ / หัวหน้างาน</Label>
              <Input 
                required 
                value={technician} 
                onChange={e => setTechnician(e.target.value)} 
                placeholder="ระบุชื่อช่างผู้ปฏิบัติงาน" 
                className="font-medium text-black"
              />
            </div>
          </div>

          {/* 24-Hour Time Frame with Quick Presets */}
          <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="font-bold text-black flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>เวลาทำงานจริง (24-Hour Format - ไม่มี AM/PM)</span>
              </Label>
              <span className="text-[10px] text-indigo-800 font-mono font-bold">มาตรฐาน 00:00 - 23:59 น.</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <TimePicker24 value={startTime} onChange={setStartTime} />
                <span className="font-bold text-black">ถึง</span>
                <TimePicker24 value={endTime} onChange={setEndTime} />
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px] text-slate-500 font-medium">กะเวลาด่วน:</span>
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] font-bold text-indigo-700 bg-white" onClick={() => applyPreset('08:00', '17:00')}>08:00-17:00</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] font-bold text-indigo-700 bg-white" onClick={() => applyPreset('08:30', '17:30')}>08:30-17:30</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] font-bold text-indigo-700 bg-white" onClick={() => applyPreset('09:00', '18:00')}>09:00-18:00</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] font-bold text-indigo-700 bg-white" onClick={() => applyPreset('13:00', '18:00')}>13:00-18:00</Button>
              </div>
            </div>
          </div>

          {/* Progress Slider & Day Counter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="font-bold text-black">วันที่ปฏิบัติงาน (Day)</Label>
              <Input 
                type="number" 
                min={1} 
                required 
                value={dayNumber} 
                onChange={e => setDayNumber(Number(e.target.value))} 
                className="font-bold text-black"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-black">จำนวนวันตามแผนรวม</Label>
              <Input 
                type="number" 
                min={1} 
                required 
                value={totalDays} 
                onChange={e => setTotalDays(Number(e.target.value))} 
                className="font-bold text-black"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-black">ความคืบหน้ารวม (%)</Label>
                <span className="font-mono font-bold text-indigo-600 text-xs">{progress}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Input 
                  type="number" 
                  min={0} 
                  max={100} 
                  required 
                  value={progress} 
                  onChange={e => setProgress(Math.min(100, Math.max(0, Number(e.target.value))))} 
                  className="font-bold text-black"
                />
                <div className="flex gap-1">
                  <button type="button" onClick={() => setProgress(25)} className="px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-black">25%</button>
                  <button type="button" onClick={() => setProgress(50)} className="px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-black">50%</button>
                  <button type="button" onClick={() => setProgress(75)} className="px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-black">75%</button>
                  <button type="button" onClick={() => setProgress(100)} className="px-1.5 py-1 rounded bg-emerald-100 hover:bg-emerald-200 text-[10px] font-bold text-emerald-800">100%</button>
                </div>
              </div>
            </div>
          </div>

          {/* Description & Notes */}
          <div className="space-y-1.5">
            <Label className="font-bold text-black">รายละเอียดผลการปฏิบัติงานวันนี้ (Work Description) *</Label>
            <Textarea 
              required 
              rows={3} 
              value={workDesc} 
              onChange={e => setWorkDesc(e.target.value)} 
              placeholder="สรุปงานที่ทำเสร็จแล้ว, ปริมาณงานที่ได้..." 
              className="text-black font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-bold text-black">ปัญหา / อุปสรรคหน้างาน (Issues / Roadblocks)</Label>
              <Textarea 
                rows={2} 
                value={issues} 
                onChange={e => setIssues(e.target.value)} 
                placeholder="ระบุปัญหาที่พบ (ถ้ามี)..." 
                className="text-black font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-black">วัสดุและอุปกรณ์ที่ใช้งาน (Materials Used)</Label>
              <Textarea 
                rows={2} 
                value={materials} 
                onChange={e => setMaterials(e.target.value)} 
                placeholder="ระบุรายการวัสดุที่เบิกใช้..." 
                className="text-black font-medium"
              />
            </div>
          </div>

          {/* 5-Slot Photo Upload Gallery */}
          <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <Label className="font-bold text-black flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>รูปภาพผลงาน 5 ช่องมาตรฐาน (5 Photo Slots & Lightbox)</span>
              </Label>
              <span className="text-[10px] text-slate-500">คลิกที่รูปเพื่อเปิดดูขนาดเต็ม</span>
            </div>
            <PhotoSlots5 slots={slots} onUpload={handleUpload} />
          </div>

          {/* 100% Confirmation */}
          <div className="flex items-center space-x-3 p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200">
            <Checkbox 
              id="confirmDone" 
              checked={userConfirmed || progress >= 100} 
              onCheckedChange={(c) => {
                setUserConfirmed(Boolean(c));
                if (c) setProgress(100);
              }} 
            />
            <Label htmlFor="confirmDone" className="font-bold text-emerald-900 cursor-pointer flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>ยืนยันงานใน Task นี้เสร็จสมบูรณ์ 100% (พร้อมส่งเข้าคิวตรวจ QC)</span>
            </Label>
          </div>

          {/* Form Actions */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t border-border-soft flex-wrap">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setActiveTab('history')}
              className="text-indigo-700 hover:bg-indigo-50 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-4 h-4" />
              <span>ดูประวัติที่บันทึกแล้ว ({logs?.length || 0} รายการ)</span>
            </Button>
            <div className="flex items-center gap-3 ml-auto">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="text-black font-medium cursor-pointer"
              >
                ยกเลิก
              </Button>
              <Button 
                type="submit" 
                disabled={createLog.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shadow-md cursor-pointer"
              >
                {createLog.isPending ? 'กำลังบันทึก...' : 'บันทึกรายงานประจำวัน'}
              </Button>
            </div>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="history" className="mt-4 space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-black">รายการประวัติบันทึกงานประจำวัน</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold text-[11px]">
              {logs?.length || 0} รายการ
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setActiveTab('form')}
            className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ ลงบันทึกวันใหม่</span>
          </Button>
        </div>

        <DailyLogList logs={logs || []} />

        <div className="flex justify-end pt-4 border-t border-border-soft">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold text-black cursor-pointer"
          >
            ปิดหน้าต่าง
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>
  );
}
