import { useState, useMemo } from 'react';
import { useGanttJobs, useGanttTasks, useStartTask, useCompleteTask, Task, computeTaskStatus } from '@/features/gantt/api';
import { useDailyLogs } from '@/features/daily-logs/api';
import { GanttChart } from '@/features/gantt/gantt-chart';
import { DailyLogList } from '@/features/daily-logs/daily-log-list';
import { DailyLogModal } from '@/features/daily-logs/daily-log-modal';
import { PageHeader } from '@/components/ui/page-header';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Calendar, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Activity, 
  Search, 
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

export default function GanttPage() {
  const [selectedJob, setSelectedJob] = useState<string>('ALL');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_PROCESS' | 'DELAY' | 'WAIT_QC' | 'PASSED' | 'PLANNED'>('ALL');

  // Fetch real jobs and tasks
  const { data: jobs, isLoading: isJobsLoading } = useGanttJobs();
  const { data: rawTasks, isLoading: isTasksLoading } = useGanttTasks(selectedJob);
  const { data: dailyLogs, isLoading: isLogsLoading } = useDailyLogs(
    selectedJob !== 'ALL' ? selectedJob : selectedTask?.job_id, 
    selectedTask?.id
  );

  const startTaskMutation = useStartTask();
  const completeTaskMutation = useCompleteTask();

  // Compute stats across all tasks
  const stats = useMemo(() => {
    const list = rawTasks || [];
    let total = list.length;
    let onProcess = 0;
    let delayed = 0;
    let waitQc = 0;
    let passed = 0;
    let activeToday = 0;

    list.forEach(t => {
      const computed = computeTaskStatus(t);
      if (computed.computedStatus === 'ON_PROCESS') onProcess++;
      if (computed.computedStatus === 'DELAY') delayed++;
      if (computed.computedStatus === 'WAIT_QC') waitQc++;
      if (computed.computedStatus === 'PASSED') passed++;
      if (computed.isActiveToday) activeToday++;
    });

    return { total, onProcess, delayed, waitQc, passed, activeToday };
  }, [rawTasks]);

  // Filter tasks by search query and status filter
  const filteredTasks = useMemo(() => {
    if (!rawTasks) return [];
    return rawTasks.filter(t => {
      const computed = computeTaskStatus(t);
      
      // Status filter
      if (statusFilter !== 'ALL' && computed.computedStatus !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = t.task_name.toLowerCase().includes(query);
        const matchTech = (t.assigned_tech || '').toLowerCase().includes(query);
        const matchArea = (t.area_name || '').toLowerCase().includes(query);
        const matchBooking = (t.booking_no || '').toLowerCase().includes(query);
        if (!matchName && !matchTech && !matchArea && !matchBooking) {
          return false;
        }
      }

      return true;
    });
  }, [rawTasks, statusFilter, searchQuery]);

  const handleStartTask = async (task: Task) => {
    try {
      const jobId = task.job_id || selectedJob;
      await startTaskMutation.mutateAsync({
        jobId: jobId as any,
        taskId: task.id,
        startTime: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
      });
      toast.success(`เริ่มปฏิบัติงาน: ${task.task_name}`);
    } catch (err: any) {
      toast.error(err?.message || 'ไม่สามารถเริ่มงานได้ (โปรดตรวจสอบว่า Area มี QC แล้วหรือไม่)');
    }
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      const jobId = task.job_id || selectedJob;
      await completeTaskMutation.mutateAsync({
        jobId: jobId as any,
        taskId: task.id,
        endTime: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
      });
      toast.success(`บันทึกส่ง QC สำเร็จ: ${task.task_name}`);
    } catch (err: any) {
      toast.error(err?.message || 'เกิดข้อผิดพลาดในการส่งตรวจ QC');
    }
  };

  const handleOpenDailyLogForTask = (task: Task) => {
    setSelectedTask(task);
    setIsLogModalOpen(true);
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
        <span className="text-xs font-bold text-black pl-2">เลือกโครงการ:</span>
        <select
          value={selectedJob}
          onChange={(e) => {
            setSelectedJob(e.target.value);
            setSelectedTask(null);
          }}
          className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-black focus:outline-none focus:border-indigo-500 shadow-2xs"
        >
          <option value="ALL">📁 ทุกโครงการ ({jobs?.length || 0} โครงการ)</option>
          {jobs?.map((j) => (
            <option key={j.id} value={j.id}>
              {j.job_no} - {j.customer_name} ({j.service_type || 'โครงการ'})
            </option>
          ))}
        </select>
      </div>

      <Button 
        onClick={() => setIsLogModalOpen(true)} 
        className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer text-xs"
      >
        <Plus className="w-4 h-4" />
        <span>บันทึกงานประจำวัน</span>
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader 
        title="แผนงาน Gantt & บันทึกงานช่าง" 
        pageKey="gantt" 
        actions={headerActions} 
      />

      {/* KPI Metric Summary Cards (Top Ribbon) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 py-3">
        {/* Total Tasks */}
        <div className="p-3 rounded-xl bg-white border border-border-soft shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">งานทั้งหมด</span>
            <span className="text-base font-bold text-black font-mono">{stats.total}</span>
          </div>
        </div>

        {/* On Process */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'ON_PROCESS' ? 'ALL' : 'ON_PROCESS')}
          className={`p-3 rounded-xl bg-white border transition-all cursor-pointer flex items-center gap-2.5 ${
            statusFilter === 'ON_PROCESS' ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30' : 'border-border-soft shadow-2xs hover:border-blue-300'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-blue-700 font-medium block">กำลังทำ</span>
            <span className="text-base font-bold text-blue-900 font-mono">{stats.onProcess}</span>
          </div>
        </div>

        {/* Delayed */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'DELAY' ? 'ALL' : 'DELAY')}
          className={`p-3 rounded-xl bg-white border transition-all cursor-pointer flex items-center gap-2.5 ${
            statusFilter === 'DELAY' ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/30' : 'border-border-soft shadow-2xs hover:border-rose-300'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold animate-pulse">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-rose-700 font-bold block">ล่าช้า</span>
            <span className="text-base font-bold text-rose-900 font-mono">{stats.delayed}</span>
          </div>
        </div>

        {/* Wait QC */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'WAIT_QC' ? 'ALL' : 'WAIT_QC')}
          className={`p-3 rounded-xl bg-white border transition-all cursor-pointer flex items-center gap-2.5 ${
            statusFilter === 'WAIT_QC' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30' : 'border-border-soft shadow-2xs hover:border-amber-300'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-amber-800 font-medium block">รอตรวจ QC</span>
            <span className="text-base font-bold text-amber-950 font-mono">{stats.waitQc}</span>
          </div>
        </div>

        {/* Passed */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'PASSED' ? 'ALL' : 'PASSED')}
          className={`p-3 rounded-xl bg-white border transition-all cursor-pointer flex items-center gap-2.5 ${
            statusFilter === 'PASSED' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30' : 'border-border-soft shadow-2xs hover:border-emerald-300'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-emerald-700 font-medium block">เสร็จสิ้น</span>
            <span className="text-base font-bold text-emerald-950 font-mono">{stats.passed}</span>
          </div>
        </div>

        {/* Active Today */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center font-bold shadow-2xs">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-red-800 font-bold block">📍 วันนี้</span>
            <span className="text-base font-bold text-red-900 font-mono">{stats.activeToday} งาน</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 rounded-xl bg-white border border-border-soft shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 mb-2">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาตามชื่องาน, ช่าง, โซนพื้นที่ หรือรหัส Booking..."
            className="pl-9 text-xs text-black font-medium h-9"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
          <button 
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-black text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด
          </button>
          <button 
            type="button"
            onClick={() => setStatusFilter('ON_PROCESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'ON_PROCESS' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            กำลังทำ
          </button>
          <button 
            type="button"
            onClick={() => setStatusFilter('DELAY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'DELAY' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            ล่าช้า (Delay)
          </button>
          <button 
            type="button"
            onClick={() => setStatusFilter('WAIT_QC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'WAIT_QC' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            รอตรวจ QC
          </button>
          <button 
            type="button"
            onClick={() => setStatusFilter('PASSED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'PASSED' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>

      {/* Master Detail Layout: Top Gantt Canvas, Bottom Daily Log List */}
      <div className="flex-1 min-h-0">
        <MasterDetailLayout
          pageKey="gantt"
          masterContent={
            <div className="h-full bg-white border border-border-soft rounded-2xl shadow-sm overflow-hidden p-2">
              {isTasksLoading || isJobsLoading ? (
                <div className="p-8 space-y-4">
                  <Skeleton className="w-48 h-6" />
                  <Skeleton className="w-full h-48 rounded-xl" />
                </div>
              ) : (
                <GanttChart 
                  tasks={filteredTasks} 
                  selectedTaskId={selectedTask?.id} 
                  onSelectTask={setSelectedTask} 
                  onOpenDailyLog={handleOpenDailyLogForTask}
                  onStartTask={handleStartTask}
                  onCompleteTask={handleCompleteTask}
                  className="h-full"
                />
              )}
            </div>
          }
          detailContent={
            <div className="flex flex-col h-full bg-white border border-border-soft rounded-2xl shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 border-b border-border-soft bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-black flex items-center gap-2">
                      <span>ประวัติการบันทึกงานช่างประจำวัน (Daily Logs History)</span>
                      {selectedTask && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-mono">
                          Task: {selectedTask.task_name}
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {selectedTask ? `แสดงเฉพาะประวัติของงาน "${selectedTask.task_name}"` : 'แสดงประวัติการบันทึกงานทั้งหมดในโครงการที่เลือก'}
                    </p>
                  </div>
                </div>

                <Button 
                  size="sm"
                  onClick={() => setIsLogModalOpen(true)}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ เพิ่มบันทึกงานใหม่</span>
                </Button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {isLogsLoading ? (
                  <Skeleton className="w-full h-32 rounded-xl" />
                ) : (
                  <DailyLogList logs={dailyLogs || []} />
                )}
              </div>
            </div>
          }
        />
      </div>

      {/* Daily Log Modal */}
      <DailyLogModal 
        open={isLogModalOpen} 
        onOpenChange={setIsLogModalOpen} 
        preselectedJobId={selectedJob !== 'ALL' ? selectedJob : selectedTask?.job_id}
        preselectedTaskId={selectedTask?.id}
        preselectedTask={selectedTask}
      />
    </div>
  );
}
