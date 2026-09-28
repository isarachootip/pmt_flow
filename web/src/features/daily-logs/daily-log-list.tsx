import { useState } from 'react';
import { DailyLog, useDeleteDailyLog } from './api';
import { Button } from '@/components/ui/button';
import { Trash2, Image, Clock, Calendar, List, LayoutGrid, Eye } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDMY } from '@/lib/date';

interface DailyLogListProps {
  logs: DailyLog[];
}

export function DailyLogList({ logs }: DailyLogListProps) {
  const deleteLog = useDeleteDailyLog();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  // Strict standard: Default to List View 100%
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  const handleDelete = async (id: number | string) => {
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
        <p className="text-[11px] text-black">กดปุ่ม "+ บันทึกงานช่าง" เพื่อเพิ่มบันทึกและรูปถ่ายหน้างาน</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top View Mode Switcher: Default Strictly List View */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="text-xs text-black font-semibold">
          ทั้งหมด <span className="font-bold text-black">{logs.length}</span> รายการบันทึก
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
              viewMode === 'list'
                ? "bg-white text-black shadow-xs border border-slate-300"
                : "text-slate-600 hover:text-black"
            )}
            title="แสดงแบบตารางรายการ (List View) - ค่าเริ่มต้น"
          >
            <List className="w-3.5 h-3.5" />
            <span>ตารางรายการ</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
              viewMode === 'cards'
                ? "bg-white text-black shadow-xs border border-slate-300"
                : "text-slate-600 hover:text-black"
            )}
            title="แสดงแบบการ์ด (Card View)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>การ์ด</span>
          </button>
        </div>
      </div>

      {/* 1. STRICT DEFAULT: Table List View */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto border border-border-soft rounded-xl bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-border-soft text-black font-bold select-none">
                <th className="py-2.5 px-3 whitespace-nowrap">รอบที่</th>
                <th className="py-2.5 px-3 whitespace-nowrap">วันที่ปฏิบัติงาน</th>
                <th className="py-2.5 px-3 min-w-[180px]">งานย่อย (Task)</th>
                <th className="py-2.5 px-3 whitespace-nowrap">ช่างผู้บันทึก</th>
                <th className="py-2.5 px-3 whitespace-nowrap">เวลาทำงาน (24 ชม.)</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">ความคืบหน้า</th>
                <th className="py-2.5 px-3 min-w-[200px]">รายละเอียดงานที่ทำ</th>
                <th className="py-2.5 px-3 whitespace-nowrap">รูปถ่าย (5 ช่อง)</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft/60">
              {logs.map((log) => {
                const startTimeStr = (log.start_time || '08:00').substring(0, 5);
                const endTimeStr = (log.end_time || '17:00').substring(0, 5);
                return (
                  <tr 
                    key={log.id} 
                    className="hover:bg-slate-50/80 transition-colors text-black"
                  >
                    {/* Day Number Badge */}
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold font-mono text-[11px]">
                        Day {log.day_number}/{log.total_days}
                      </span>
                    </td>

                    {/* Date DD/MM/YYYY */}
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-bold text-black text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{formatDMY(log.log_date)}</span>
                      </div>
                    </td>

                    {/* Task Name */}
                    <td className="py-3 px-3 align-top">
                      <div className="font-bold text-black text-xs leading-snug">
                        {log.task_name || 'งานประจำวัน'}
                      </div>
                      {log.job_no && (
                        <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                          {log.job_no}
                        </div>
                      )}
                    </td>

                    {/* Technician */}
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <span className="font-semibold text-black text-xs">
                        👨‍🔧 {log.technician}
                      </span>
                    </td>

                    {/* 24-Hour Work Time */}
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1 font-mono font-medium text-black text-xs">
                        <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{startTimeStr} - {endTimeStr} น.</span>
                      </div>
                      {log.work_hours && (
                        <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                          ({log.work_hours} ชม.)
                        </div>
                      )}
                    </td>

                    {/* Progress % */}
                    <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200 font-bold font-mono text-xs">
                        {log.progress_percent}%
                      </span>
                    </td>

                    {/* Description */}
                    <td className="py-3 px-3 align-top">
                      <p className="text-xs text-black font-medium leading-relaxed max-w-[320px] bg-slate-50 p-2 rounded-lg border border-slate-200 whitespace-pre-wrap">
                        {log.work_description || '-'}
                      </p>
                    </td>

                    {/* Photos */}
                    <td className="py-3 px-3 align-top">
                      {log.photos && log.photos.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.photos.map((photo, pIdx) => (
                            <div 
                              key={pIdx} 
                              className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-300 shrink-0 cursor-pointer hover:opacity-80 transition-opacity shadow-2xs group"
                              onClick={() => setSelectedPhoto(photo)}
                              title={`ดูรูปขนาดใหญ่ (รูปที่ ${pIdx + 1})`}
                            >
                              <img src={photo} alt={`Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          ))}
                          <span className="text-[10px] text-slate-600 font-medium ml-1">
                            ({log.photos.length})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-red-600 hover:text-red-800 hover:bg-red-50 cursor-pointer"
                        onClick={() => handleDelete(log.id)}
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. Optional Card View (for user toggle) */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {logs.map((log) => (
            <div 
              key={log.id} 
              className="p-4 rounded-xl bg-white border border-border-soft shadow-2xs hover:shadow-sm transition-shadow space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold font-mono text-[10px]">
                      Day {log.day_number}/{log.total_days}
                    </span>
                    <span className="font-bold text-black text-xs flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDMY(log.log_date)}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200 font-bold text-[11px] font-mono">
                      {log.progress_percent}%
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-red-600 hover:text-red-800 hover:bg-red-50 cursor-pointer"
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
                  <span className="text-[11px] text-black font-medium shrink-0">
                    👨‍🔧 {log.technician}
                  </span>
                </div>

                {/* Time 24h */}
                <div className="flex items-center gap-1.5 text-[11px] text-black font-mono">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{(log.start_time || '08:00').substring(0, 5)} - {(log.end_time || '17:00').substring(0, 5)} น.</span>
                  {log.work_hours && (
                    <span className="text-slate-600">({log.work_hours} ชม.)</span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-black font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
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
                    <span className="text-[10px] text-slate-600 ml-1 shrink-0 font-medium">
                      ({log.photos.length} รูป)
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Zoom Dialog */}
      <Dialog open={Boolean(selectedPhoto)} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-none shadow-2xl">
          {selectedPhoto && (
            <img 
              src={selectedPhoto} 
              alt="Full Preview" 
              className="w-full h-auto max-h-[85vh] rounded-lg object-contain mx-auto" 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
