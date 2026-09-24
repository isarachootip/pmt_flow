import { DailyLog, useDeleteDailyLog } from './api';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DailyLogListProps {
  logs: DailyLog[];
}

export function DailyLogList({ logs }: DailyLogListProps) {
  const deleteLog = useDeleteDailyLog();

  const handleDelete = async (id: number) => {
    if (confirm('ยืนยันการลบข้อมูล?')) {
      try {
        await deleteLog.mutateAsync(id);
        toast.success('ลบข้อมูลสำเร็จ');
      } catch (err) {
        toast.error('เกิดข้อผิดพลาด');
      }
    }
  };

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
        <div className="text-4xl mb-2">📄</div>
        <p>ไม่มีข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="border border-border-soft rounded-lg overflow-hidden text-sm">
      <table className="w-full text-left">
        <thead className="bg-bg-subtle text-text-secondary text-xs font-semibold">
          <tr>
            <th className="p-3 border-b border-border-soft">วันที่</th>
            <th className="p-3 border-b border-border-soft">เวลา</th>
            <th className="p-3 border-b border-border-soft">ช่าง</th>
            <th className="p-3 border-b border-border-soft">วัน/รวม</th>
            <th className="p-3 border-b border-border-soft">ความคืบหน้า</th>
            <th className="p-3 border-b border-border-soft">รายละเอียด</th>
            <th className="p-3 border-b border-border-soft text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-border-soft hover:bg-bg-subtle transition-colors">
              <td className="p-3">
                {format(parseISO(log.log_date), 'dd/MM/yyyy')}
              </td>
              <td className="p-3">
                {log.start_time.substring(0, 5)} - {log.end_time.substring(0, 5)}
              </td>
              <td className="p-3 font-medium">{log.technician}</td>
              <td className="p-3">
                {log.day_number} / {log.total_days}
              </td>
              <td className="p-3">
                <span className="font-bold text-primary">{log.progress_percent}%</span>
              </td>
              <td className="p-3 max-w-[200px] truncate" title={log.work_description}>
                {log.work_description}
              </td>
              <td className="p-3 text-right">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => handleDelete(log.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
