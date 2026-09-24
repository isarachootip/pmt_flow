import { useState } from 'react';
import { useGanttTasks, Task } from '@/features/gantt/api';
import { useDailyLogs } from '@/features/daily-logs/api';
import { GanttChart } from '@/features/gantt/gantt-chart';
import { DailyLogList } from '@/features/daily-logs/daily-log-list';
import { DailyLogModal } from '@/features/daily-logs/daily-log-modal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

export default function GanttPage() {
  const [selectedJob, setSelectedJob] = useState<string>('ALL');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // In a real app, you'd fetch jobs here to populate the dropdown.
  // We'll mock some jobs for the UI based on standard behavior.
  const jobs = [
    { id: '1', name: 'J2401-001 (ซ่อมหลังคา)' },
    { id: '2', name: 'J2401-002 (ทาสีภายนอก)' },
  ];

  const jobIdParam = selectedJob === 'ALL' ? undefined : selectedJob;
  const { data: tasks, isLoading: isTasksLoading } = useGanttTasks(jobIdParam);
  const { data: dailyLogs, isLoading: isLogsLoading } = useDailyLogs(jobIdParam, selectedTask?.id);

  return (
    <div className="flex flex-col h-full bg-bg-subtle space-y-4 p-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-border-soft">
        <h1 className="text-xl font-bold text-text">แผนงาน Gantt</h1>
        <div className="flex items-center gap-4">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="เลือกงาน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทั้งหมด</SelectItem>
              {jobs.map(j => (
                <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setIsLogModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            บันทึกงานประจำวัน
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-[400px]">
        {isTasksLoading ? (
          <Skeleton className="w-full h-full rounded-xl" />
        ) : (
          <GanttChart 
            tasks={tasks || []} 
            selectedTaskId={selectedTask?.id} 
            onSelectTask={setSelectedTask} 
            className="h-full rounded-xl"
          />
        )}
      </div>

      {selectedTask && (
        <div className="h-[300px] shrink-0 bg-white border border-border-soft rounded-xl shadow-sm p-4 flex flex-col">
          <h2 className="text-lg font-bold mb-4">
            บันทึกประจำวัน: {selectedTask.task_name}
          </h2>
          <div className="flex-1 overflow-auto">
            {isLogsLoading ? (
              <Skeleton className="w-full h-[200px]" />
            ) : (
              <DailyLogList logs={dailyLogs || []} />
            )}
          </div>
        </div>
      )}

      <DailyLogModal 
        open={isLogModalOpen} 
        onOpenChange={setIsLogModalOpen} 
        preselectedJobId={selectedJob !== 'ALL' ? selectedJob : undefined}
        preselectedTaskId={selectedTask?.id ? String(selectedTask.id) : undefined}
      />
    </div>
  );
}
