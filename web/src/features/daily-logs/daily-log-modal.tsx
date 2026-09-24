import React, { useState } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker24 } from '@/components/ui/time-picker-24';
import { PhotoSlots5, PhotoSlot } from '@/components/ui/photo-slots-5';
import { useCreateDailyLog } from './api';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DailyLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedJobId?: string;
  preselectedTaskId?: string;
}

const initialSlots: PhotoSlot[] = [
  { id: 'before', label: 'ก่อนเริ่ม' },
  { id: 'progress1', label: 'ระหว่างทำ 1' },
  { id: 'progress2', label: 'ระหว่างทำ 2' },
  { id: 'test', label: 'ทดสอบ' },
  { id: 'after', label: 'เสร็จ' },
];

export function DailyLogModal({ open, onOpenChange, preselectedJobId, preselectedTaskId }: DailyLogModalProps) {
  const [dateStr, setDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [dayNumber, setDayNumber] = useState(1);
  const [totalDays, setTotalDays] = useState(1);
  const [technician, setTechnician] = useState('');
  const [progress, setProgress] = useState(0);
  const [workDesc, setWorkDesc] = useState('');
  const [issues, setIssues] = useState('');
  const [materials, setMaterials] = useState('');
  const [slots, setSlots] = useState<PhotoSlot[]>(initialSlots);
  const [userConfirmed, setUserConfirmed] = useState(false);

  // Hardcoded for now. In reality, you might let user select job/task if not preselected.
  const jobId = preselectedJobId || '1'; 
  const taskId = preselectedTaskId || '1';

  const createLog = useCreateDailyLog(jobId);

  const applyPreset = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
  };

  const handleUpload = (slotId: string, file: File) => {
    // Mocking file upload by using URL.createObjectURL for now
    const url = URL.createObjectURL(file);
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, url } : s));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const photos = slots.filter(s => s.url).map(s => s.url!);
      await createLog.mutateAsync({
        task_id: Number(taskId),
        task_name: 'งานที่เลือก', // Fallback, normally fetched or passed
        log_date: dateStr,
        start_time: startTime,
        end_time: endTime,
        day_number: dayNumber,
        total_days: totalDays,
        technician: technician,
        progress_percent: progress,
        work_description: workDesc + (issues ? `\n\nปัญหา: ${issues}` : '') + (materials ? `\n\nวัสดุ: ${materials}` : ''),
        photos: photos,
        is_completed: userConfirmed || dayNumber >= totalDays,
        user_confirmed: userConfirmed
      });
      toast('บันทึกสำเร็จ');
      onOpenChange(false);
    } catch (err) {
      toast('เกิดข้อผิดพลาด');
    }
  };

  const showConfirmCheckbox = dayNumber >= totalDays || userConfirmed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>บันทึกงานประจำวัน</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>วันที่บันทึก</Label>
              <DatePicker value={dateStr} onChange={setDateStr} />
            </div>
            <div className="space-y-2">
              <Label>ช่างผู้รับผิดชอบ</Label>
              <Input required value={technician} onChange={e => setTechnician(e.target.value)} placeholder="ระบุชื่อช่าง" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>เวลาทำงาน</Label>
            <div className="flex items-center gap-2">
              <TimePicker24 value={startTime} onChange={setStartTime} />
              <span>-</span>
              <TimePicker24 value={endTime} onChange={setEndTime} />
            </div>
            <div className="flex gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('08:00', '17:00')}>08:00-17:00</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('08:30', '17:30')}>08:30-17:30</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('09:00', '18:00')}>09:00-18:00</Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>วันที่ทำ</Label>
              <Input type="number" min={1} required value={dayNumber} onChange={e => setDayNumber(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>จำนวนวันรวม</Label>
              <Input type="number" min={1} required value={totalDays} onChange={e => setTotalDays(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>ความคืบหน้า (%)</Label>
              <Input type="number" min={0} max={100} required value={progress} onChange={e => setProgress(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>รายละเอียดงาน</Label>
            <Textarea required value={workDesc} onChange={e => setWorkDesc(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>ปัญหา/อุปสรรค</Label>
            <Textarea value={issues} onChange={e => setIssues(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>วัสดุที่ใช้</Label>
            <Textarea value={materials} onChange={e => setMaterials(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>รูปภาพผลงาน (สูงสุด 5 รูป)</Label>
            <PhotoSlots5 slots={slots} onUpload={handleUpload} />
          </div>

          {showConfirmCheckbox && (
            <div className="flex items-center space-x-2 p-4 bg-primary-softer rounded-lg border border-primary-soft">
              <Checkbox id="confirmDone" checked={userConfirmed} onCheckedChange={(c) => setUserConfirmed(c as boolean)} />
              <Label htmlFor="confirmDone" className="font-bold cursor-pointer">ยืนยันงานเสร็จ 100%</Label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-border-soft">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={createLog.isPending}>บันทึกข้อมูล</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
