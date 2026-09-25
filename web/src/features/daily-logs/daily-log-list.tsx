import { useState } from 'react';
import { DailyLog, useDeleteDailyLog } from './api';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Trash2, Image, Clock, Calendar } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DailyLogListProps {
  logs: DailyLog[];
}

export function DailyLogList({ logs }: DailyLogListProps) {
  const deleteLog = useDeleteDailyLog();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const handleDelete = async (id: number) => {
    if (confirm('ยืนยันการลบประวัติการบันทึกงานนี้?')) {
      try {
        await deleteLog.mutateAsync(id);
        toast.success('ลบประวัติการบันทึกสำเร็จ');
      } catch (err) {
        toast.error('เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    }
  };

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <Calendar className="w-8 h-8 text-slate-300 mb-2" />
        <p className="font-semibold text-black text-xs">ยังไม่มีประวัติการบันทึกงานประจำวัน</p>
        <p className="text-[11px] text-slate-500">กดปุ่ม "บันทึกงานประจำวัน" เพื่อเพิ่มบันทึกและรูปถ่ายหน้างาน</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {logs.map((log) => (
          <div 
            key={log.id} 
            className="p-4 rounded-xl bg-white border border-border-soft shadow-2xs hover:shadow-sm transition-shadow space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold font-mono text-[10px]">
                    Day {log.day_number}/{log.total_days}
                  </span>
                  <span className="font-bold text-black text-xs flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{format(parseISO(log.log_date), 'dd/MM/yyyy')}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[11px] font-mono">
                    {log.progress_percent}%
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(log.id)}
                    title="ลบรายการนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Task name & Tech */}
              <div className="text-xs text-black font-semibold flex items-center justify-between">
                <span className="truncate">{log.task_name || 'งานประจำวัน'}</span>
                <span className="text-[11px] text-slate-600 font-medium shrink-0">
                  👨‍🔧 {log.technician}
                </span>
              </div>

              {/* Time 24h */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-mono">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>{log.start_time.substring(0, 5)} - {log.end_time.substring(0, 5)} น.</span>
                {log.work_hours && (
                  <span className="text-slate-500">({log.work_hours} ชม.)</span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                {log.work_description}
              </p>
            </div>

            {/* Photo Thumbnails */}
            {log.photos && log.photos.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {log.photos.map((photo, pIdx) => (
                    <div 
                      key={pIdx} 
                      className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity shadow-2xs group"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <img src={photo} alt={`Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <Image className="w-3 h-3" />
                      </div>
                    </div>
                  ))}
                  <span className="text-[10px] text-slate-500 ml-1 shrink-0 font-medium">
                    ({log.photos.length} รูป)
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Zoom Dialog */}
      <Dialog open={Boolean(selectedPhoto)} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-none shadow-2xl">
          {selectedPhoto && (
            <img 
              src={selectedPhoto} 
              alt="Full Preview" 
              className="w-full h-auto max-h-[85vh] rounded-lg object-contain" 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
