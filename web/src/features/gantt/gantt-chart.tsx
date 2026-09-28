import * as React from 'react';
import { cn } from '@/lib/utils';
import { Task, computeTaskStatus } from './api';
import { format, parseISO, differenceInDays, addDays, startOfDay, isToday } from 'date-fns';
import { th } from 'date-fns/locale';
import { 
  Clock, 
  AlertTriangle, 
  Play, 
  CheckCircle2, 
  FileEdit, 
  ChevronDown, 
  ChevronRight, 
  UserCheck, 
  Calendar,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { formatDMY } from '@/lib/date';
import { DailyLog } from '@/features/daily-logs/api';

interface GanttChartProps {
  tasks: Task[];
  dailyLogs?: DailyLog[];
  onViewDailyLogs?: () => void;
  selectedTaskId?: number | string;
  onSelectTask?: (task: Task) => void;
  onOpenDailyLog?: (task: Task) => void;
  onStartTask?: (task: Task) => void;
  onCompleteTask?: (task: Task) => void;
  className?: string;
}

export function GanttChart({ 
  tasks, 
  dailyLogs = [],
  selectedTaskId, 
  onSelectTask, 
  onOpenDailyLog,
  onStartTask,
  onCompleteTask,
  className 
}: GanttChartProps) {
  const timelineContainerRef = React.useRef<HTMLDivElement>(null);
  const [collapsedAreas, setCollapsedAreas] = React.useState<Record<string, boolean>>({});
  const today = React.useMemo(() => startOfDay(new Date()), []);

  const toggleArea = (areaKey: string) => {
    setCollapsedAreas(prev => ({ ...prev, [areaKey]: !prev[areaKey] }));
  };

  // Group tasks by Area
  const groupedTasks = React.useMemo(() => {
    const map = new Map<string, { areaName: string; assignedQc?: string; tasks: Task[] }>();
    tasks.forEach(t => {
      const areaKey = String(t.area_id || t.area_name || 'general');
      const areaName = t.area_name || 'งานทั่วไป / แผนงานหลัก';
      if (!map.has(areaKey)) {
        map.set(areaKey, {
          areaName,
          assignedQc: t.assigned_qc,
          tasks: [],
        });
      }
      map.get(areaKey)!.tasks.push(t);
    });
    return Array.from(map.entries());
  }, [tasks]);

  // Calculate timeline date range
  const { startDate, days } = React.useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return { 
        startDate: addDays(today, -3), 
        days: Array.from({ length: 25 }, (_, i) => addDays(addDays(today, -3), i)) 
      };
    }

    let minDate = parseISO(tasks[0].plan_start_date || new Date().toISOString().slice(0, 10));
    let maxDate = parseISO(tasks[0].plan_end_date || new Date().toISOString().slice(0, 10));

    tasks.forEach(t => {
      if (t.plan_start_date) {
        const start = parseISO(t.plan_start_date);
        if (start < minDate) minDate = start;
      }
      if (t.plan_end_date) {
        const end = parseISO(t.plan_end_date);
        if (end > maxDate) maxDate = end;
      }
      if (t.actual_start_date) {
        const actualStart = parseISO(t.actual_start_date);
        if (actualStart < minDate) minDate = actualStart;
      }
      if (t.actual_end_date) {
        const actualEnd = parseISO(t.actual_end_date);
        if (actualEnd > maxDate) maxDate = actualEnd;
      }
    });

    // Ensure today (current date) is ALWAYS included in timeline range
    if (today < minDate) {
      minDate = today;
    }
    if (today > maxDate) {
      maxDate = today;
    }

    // Add buffer: 2 days before, 5 days after
    minDate = addDays(minDate, -2);
    maxDate = addDays(maxDate, 5);

    const totalDays = Math.max(15, differenceInDays(maxDate, minDate) + 1);
    const daysArr = Array.from({ length: totalDays }, (_, i) => addDays(minDate, i));

    return { startDate: minDate, days: daysArr };
  }, [tasks, today]);

  const getDayOffset = (dateStr?: string) => {
    if (!dateStr) return 0;
    try {
      const d = parseISO(dateStr);
      return differenceInDays(d, startDate);
    } catch {
      return 0;
    }
  };

  const getDuration = (startStr?: string, endStr?: string) => {
    if (!startStr || !endStr) return 1;
    try {
      return Math.max(1, differenceInDays(parseISO(endStr), parseISO(startStr)) + 1);
    } catch {
      return 1;
    }
  };

  const todayOffset = differenceInDays(today, startDate);
  const cellWidth = 44; // px per day
  const totalTimelineWidth = days.length * cellWidth;
  const totalCanvasWidth = 380 + totalTimelineWidth;

  // Auto-scroll so Today line is nicely in view
  React.useEffect(() => {
    if (todayOffset >= 0 && timelineContainerRef.current) {
      const targetScroll = Math.max(0, todayOffset * cellWidth - 120);
      timelineContainerRef.current.scrollLeft = targetScroll;
    }
  }, [todayOffset, cellWidth]);

  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn("border border-border-soft rounded-2xl bg-white overflow-hidden flex flex-col shadow-sm text-xs", className)}>
        
        {/* Legend & Summary Ribbon */}
        <div className="bg-slate-50/80 px-3 py-1.5 border-b border-border-soft flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-black text-xs">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>ผังแถบเวลา (Timeline Status):</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 shadow-2xs"></span>
              <span className="text-black font-semibold">กำลังดำเนินการ (On Process)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gradient-to-r from-rose-500 to-red-600 shadow-2xs animate-pulse"></span>
              <span className="text-rose-700 font-bold">ล่าช้า (Delay)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-slate-200 border border-slate-300"></span>
              <span className="text-slate-800">ตามแผนงาน (Planned)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-amber-500 shadow-2xs"></span>
              <span className="text-amber-800 font-semibold">รอตรวจ (Wait QC)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 border border-emerald-600 shadow-2xs"></span>
              <span className="text-emerald-900 font-bold">🟢 บันทึกงานแล้ว (Hover ดูสรุป)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-500 shadow-2xs"></span>
              <span className="text-emerald-800 font-semibold">เสร็จสมบูรณ์ (Passed)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-red-500"></span>
              <span className="text-red-600 font-bold">📍 วันนี้ (Current Date Line)</span>
            </span>
          </div>
        </div>

        {/* Gantt Timeline Container */}
        <div ref={timelineContainerRef} className="flex-1 overflow-auto relative">
          <div className="flex flex-col relative" style={{ minWidth: totalCanvasWidth, width: totalCanvasWidth }}>
            
            {/* Header Row */}
            <div className="flex border-b border-border-soft bg-slate-100/90 text-black font-semibold select-none sticky top-0 z-30 shadow-2xs">
              {/* Left Header Column */}
              <div className="w-[380px] shrink-0 border-r border-border-soft px-4 py-3 sticky left-0 bg-slate-100 z-40 shadow-[2px_0_4px_rgba(0,0,0,0.03)] flex items-center justify-between">
                <span className="font-bold text-black">โครงสร้าง 3 ระดับ: พื้นที่ & งานย่อย (Tasks)</span>
                <span className="text-[10px] text-slate-600 font-mono">ช่าง / สถานะ</span>
              </div>

              {/* Date Header Timeline */}
              <div className="flex" style={{ width: totalTimelineWidth }}>
                {days.map((day, i) => {
                  const todayFlag = isToday(day);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-shrink-0 flex flex-col items-center justify-center border-r border-border-soft py-1.5 text-center transition-colors relative",
                        todayFlag ? "bg-red-50 text-red-700 font-bold border-r-red-400" : "text-black"
                      )}
                      style={{ width: cellWidth }}
                    >
                      <span className="text-[10px] uppercase font-mono">{format(day, 'EEE', { locale: th })}</span>
                      <span className={cn(
                        "text-xs font-bold leading-none mt-0.5",
                        todayFlag ? "px-1.5 py-0.5 rounded-full bg-red-600 text-white shadow-2xs font-extrabold" : ""
                      )}>
                        {format(day, 'd')}
                      </span>
                      <span className="text-[9px] text-slate-600 mt-0.5">{format(day, 'MMM', { locale: th })}</span>
                      {todayFlag && (
                        <span className="text-[9px] text-red-600 font-extrabold leading-none mt-0.5">วันนี้</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body Rows */}
            <div className="relative flex-1">
              
              {/* Full Canvas Background Grid Lines */}
              <div className="absolute inset-0 flex pointer-events-none pl-[380px]" style={{ width: totalCanvasWidth }}>
                {days.map((day, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex-shrink-0 border-r border-border-soft/40 h-full",
                      isToday(day) ? "bg-red-50/25 border-r-red-300" : ""
                    )} 
                    style={{ width: cellWidth }} 
                  />
                ))}
              </div>

              {/* Today Vertical Line Indicator (Current Date Line) */}
              {todayOffset >= 0 && todayOffset < days.length && (
                <div 
                  className="absolute top-0 bottom-0 z-25 pointer-events-none flex flex-col items-center"
                  style={{ left: 380 + todayOffset * cellWidth + Math.floor(cellWidth / 2) - 1, width: 2 }}
                >
                  <div className="sticky top-2 z-30 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold shadow-md whitespace-nowrap border border-red-700">
                    📍 วันนี้ ({format(today, 'd MMM', { locale: th })})
                  </div>
                  <div className="w-[2px] h-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
                </div>
              )}

              {/* Render Area Groups & Tasks */}
              {groupedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-600">
                  <Calendar className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="font-bold text-black text-sm">ยังไม่มีรายการงานในแผนงาน Gantt</p>
                  <p className="text-xs text-slate-500">เลือกโครงการอื่นหรือนำเข้า BOQ เพื่อสร้างแผนงาน 3 ระดับ</p>
                </div>
              ) : (
                groupedTasks.map(([areaKey, areaData]) => {
                  const isCollapsed = collapsedAreas[areaKey];
                  return (
                    <div key={areaKey} className="border-b border-border-soft">
                      
                      {/* Area Header Row */}
                      <div className="flex bg-slate-50/90 border-b border-border-soft/70 hover:bg-slate-100/80 transition-colors">
                        {/* Area Info (Sticky Left) */}
                        <div 
                          className="w-[380px] shrink-0 border-r border-border-soft px-3 py-2 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.02)] flex items-center justify-between cursor-pointer"
                          onClick={() => toggleArea(areaKey)}
                        >
                          <div className="flex items-center gap-2">
                            <button type="button" className="text-slate-600 hover:text-black">
                              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <span className="font-bold text-black text-xs flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span>
                              <span>{areaData.areaName}</span>
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold font-mono">
                              {areaData.tasks.length} งาน
                            </span>
                          </div>

                          {/* Assigned QC Pill (Strictly 1 QC per Area) */}
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-bold" title="ผู้ตรวจสอบคุณภาพประจำพื้นที่ (1 QC ต่อ Area)">
                              <UserCheck className="w-3 h-3 text-purple-600" />
                              <span>QC: {areaData.assignedQc || 'ยังไม่กำหนด'}</span>
                            </span>
                          </div>
                        </div>

                        {/* Area Timeline Space */}
                        <div className="flex-1 bg-slate-50/40" style={{ width: days.length * cellWidth }} />
                      </div>

                      {/* Task Rows under this Area */}
                      {!isCollapsed && areaData.tasks.map((task) => {
                        const computed = computeTaskStatus(task);
                        const isSelected = selectedTaskId === task.id;

                        const pOffset = getDayOffset(task.plan_start_date);
                        const pDays = getDuration(task.plan_start_date, task.plan_end_date);

                        const hasActual = Boolean(task.actual_start_date || task.actual_start_time || task.status !== 'PLANNED');
                        const actualStartStr = task.actual_start_date || task.plan_start_date;
                        const actualEndStr = task.actual_end_date || (task.status === 'PASSED' ? task.plan_end_date : format(new Date(), 'yyyy-MM-dd'));
                        const aOffset = getDayOffset(actualStartStr);
                        const aDays = getDuration(actualStartStr, actualEndStr);

                        // Find all daily work logs recorded for this specific task
                        const taskDailyLogs = (dailyLogs || []).filter(l => 
                          String(l.task_id) === String(task.id) || 
                          (l.task_name && task.task_name && l.task_name.trim().toLowerCase() === task.task_name.trim().toLowerCase())
                        );

                        return (
                          <div 
                            key={task.id}
                            className={cn(
                              "flex border-b border-border-soft/60 group hover:bg-slate-50/60 transition-colors",
                              isSelected ? "bg-indigo-50/40" : ""
                            )}
                          >
                            {/* Task Left Column (Sticky Left) */}
                            <div 
                              className={cn(
                                "w-[380px] shrink-0 border-r border-border-soft p-3 sticky left-0 bg-white z-10 shadow-[2px_0_4px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-colors",
                                isSelected ? "bg-indigo-50/50" : "group-hover:bg-slate-50/70"
                              )}
                              onClick={() => onSelectTask?.(task)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <span className="font-bold text-black block truncate text-xs" title={task.task_name}>
                                    {task.task_name}
                                  </span>
                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-700">
                                    <span className="truncate font-medium text-black">
                                      👨‍🔧 {task.assigned_tech || 'ไม่ได้ระบุช่าง'}
                                    </span>
                                    {task.booking_no && (
                                      <span className="text-[10px] font-mono text-slate-600">
                                        #{task.booking_no}
                                      </span>
                                    )}
                                    {taskDailyLogs.length > 0 && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full border border-emerald-300" title="มีบันทึกงานประจำวัน">
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                        <span>{taskDailyLogs.length} วัน</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Status Badge */}
                                <div className="shrink-0">
                                  {computed.computedStatus === 'DELAY' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[10px] shadow-2xs animate-pulse">
                                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                                      <span>ล่าช้า +{computed.delayDays} วัน</span>
                                    </span>
                                  )}
                                  {computed.computedStatus === 'ON_PROCESS' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-bold text-[10px]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                                      <span>กำลังทำ ({task.progress_percent}%)</span>
                                    </span>
                                  )}
                                  {computed.computedStatus === 'WAIT_QC' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      <span>รอตรวจ QC</span>
                                    </span>
                                  )}
                                  {computed.computedStatus === 'PASSED' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>เสร็จสมบูรณ์ {task.qc_score ? `(คะแนน: ${task.qc_score})` : ''}</span>
                                    </span>
                                  )}
                                  {computed.computedStatus === 'REWORK' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300 font-bold text-[10px]">
                                      <span>รอบแก้ {task.rework_count || 1}/5</span>
                                    </span>
                                  )}
                                  {computed.computedStatus === 'ESCALATED' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-200 text-red-900 border border-red-400 font-bold text-[10px]">
                                      <span>ESCALATED</span>
                                    </span>
                                  )}
                                  {computed.computedStatus === 'PLANNED' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 font-medium text-[10px]">
                                      <span>ตามแผนงาน</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Task Action Bar */}
                              <div className="flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-slate-100">
                                <div className="text-[10px] text-slate-600 font-mono">
                                  {format(parseISO(task.plan_start_date), 'dd/MM')} - {format(parseISO(task.plan_end_date), 'dd/MM/yyyy')}
                                </div>
                                <div className="flex items-center gap-1">
                                  {onOpenDailyLog && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenDailyLog(task);
                                      }}
                                    >
                                      <FileEdit className="w-3 h-3 mr-1" />
                                      บันทึกช่าง
                                    </Button>
                                  )}
                                  {task.status === 'PLANNED' && onStartTask && (
                                    <Button
                                      size="sm"
                                      className="h-6 px-2 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onStartTask(task);
                                      }}
                                    >
                                      <Play className="w-3 h-3 mr-1 fill-white" />
                                      เริ่มงาน
                                    </Button>
                                  )}
                                  {task.status === 'IN_PROGRESS' && onCompleteTask && (
                                    <Button
                                      size="sm"
                                      className="h-6 px-2 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onCompleteTask(task);
                                      }}
                                    >
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      ส่ง QC
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Task Timeline Bar Canvas */}
                            <div 
                              className="relative flex-1 h-[72px] flex items-center" 
                              style={{ width: days.length * cellWidth }}
                            >
                              {/* Plan Bar (Top bar) */}
                              <div 
                                className="absolute top-2.5 h-4.5 rounded-md bg-slate-200/90 border border-slate-300/80 text-[10px] text-slate-800 font-bold px-2 flex items-center overflow-hidden shadow-2xs cursor-pointer hover:bg-slate-300 transition-colors"
                                style={{ 
                                  left: Math.max(0, pOffset * cellWidth), 
                                  width: Math.max(cellWidth, pDays * cellWidth) 
                                }}
                                title={`แผนงาน: ${format(parseISO(task.plan_start_date), 'dd/MM/yyyy')} ถึง ${format(parseISO(task.plan_end_date), 'dd/MM/yyyy')} (${pDays} วัน)`}
                              >
                                <span className="truncate">แผน: {pDays} วัน</span>
                              </div>

                              {/* Actual / Current Status Bar (Bottom bar) */}
                              {hasActual && (
                                <div
                                  className={cn(
                                    "absolute top-8.5 h-6 rounded-md shadow-xs flex items-center px-2 text-white font-bold text-[11px] overflow-hidden transition-all",
                                    computed.computedStatus === 'DELAY' 
                                      ? "bg-gradient-to-r from-rose-500 via-red-600 to-rose-700 border border-rose-600 animate-pulse" :
                                    computed.computedStatus === 'ON_PROCESS'
                                      ? "bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-700 border border-blue-500" :
                                    computed.computedStatus === 'WAIT_QC'
                                      ? "bg-gradient-to-r from-amber-500 to-amber-600 border border-amber-400" :
                                    computed.computedStatus === 'PASSED'
                                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 border border-emerald-400" :
                                    computed.computedStatus === 'REWORK'
                                      ? "bg-gradient-to-r from-orange-500 to-amber-600 border border-orange-400" :
                                    computed.computedStatus === 'ESCALATED'
                                      ? "bg-gradient-to-r from-red-800 to-rose-950 border border-red-700" :
                                      "bg-slate-500"
                                  )}
                                  style={{
                                    left: Math.max(0, aOffset * cellWidth),
                                    width: Math.max(cellWidth * 1.5, aDays * cellWidth),
                                  }}
                                  title={`การปฏิบัติงานจริง: ${task.progress_percent}%\nสถานะ: ${computed.computedStatus}`}
                                >
                                  <div className="flex items-center justify-between w-full gap-1">
                                    <span className="truncate flex items-center gap-1 text-[10px]">
                                      {computed.computedStatus === 'DELAY' && '⚠️ ล่าช้า'}
                                      {computed.computedStatus === 'ON_PROCESS' && '⚡ กำลังทำ'}
                                      {computed.computedStatus === 'WAIT_QC' && '⏳ รอตรวจ'}
                                      {computed.computedStatus === 'PASSED' && '✔️ ผ่าน QC'}
                                    </span>
                                    <span className="bg-black/30 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                      {task.progress_percent}%
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Daily Logged Days Indicators (Green Day Pills with Rich Tooltip Hint) */}
                              {taskDailyLogs.map((log, logIdx) => {
                                const logDateClean = log.log_date ? log.log_date.slice(0, 10) : '';
                                const lOffset = getDayOffset(logDateClean);
                                if (lOffset < 0 || lOffset >= days.length) return null;

                                return (
                                  <Tooltip key={`gantt-log-${log.id || `${task.id}-${logIdx}`}`}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className="absolute z-20 h-6 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-2 border-emerald-300 text-white font-bold text-[10px] shadow-sm flex items-center justify-center gap-1 px-1 cursor-pointer transition-all hover:scale-108 hover:z-30 hover:ring-2 hover:ring-emerald-400"
                                        style={{
                                          left: Math.max(0, lOffset * cellWidth + 2),
                                          width: cellWidth - 4,
                                          top: 34,
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenDailyLog?.(task);
                                        }}
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0 fill-emerald-800" />
                                        <span className="truncate text-[9px] font-mono font-bold leading-none">
                                          D{log.day_number || (logIdx + 1)}
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent 
                                      side="top" 
                                      sideOffset={6}
                                      className="bg-white border-2 border-emerald-500 p-3.5 shadow-2xl rounded-xl z-50 text-black min-w-[270px] max-w-[340px] space-y-2 pointer-events-auto"
                                    >
                                      <div className="flex items-center justify-between border-b border-gray-100 pb-2 gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                          </div>
                                          <span className="font-bold text-xs text-black">
                                            บันทึกช่าง วันที่ {log.day_number || 1}/{log.total_days || 1}
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                                          {log.progress_percent}%
                                        </span>
                                      </div>

                                      <div className="text-xs space-y-1.5 text-black">
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="font-semibold text-black">📅 วันที่:</span>
                                          <span className="font-bold text-black font-mono">{formatDMY(log.log_date)}</span>
                                        </div>
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="font-semibold text-black">👨‍🔧 ช่าง:</span>
                                          <span className="font-bold text-black truncate max-w-[170px]">{log.technician || log.recorded_by || '-'}</span>
                                        </div>
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="font-semibold text-black">⏰ เวลาทำงานจริง:</span>
                                          <span className="font-mono font-bold text-black">
                                            {log.start_time || '-'} - {log.end_time || '-'} น.
                                            {log.work_hours ? ` (${log.work_hours} ชม.)` : ''}
                                          </span>
                                        </div>

                                        {log.work_description && (
                                          <div className="pt-1.5 border-t border-gray-100">
                                            <span className="text-black font-bold block text-[11px] mb-1">📝 ผลงานที่ปฏิบัติในวันนี้:</span>
                                            <p className="text-black font-medium text-[11px] leading-relaxed bg-slate-50 p-2 rounded-lg border border-gray-200">
                                              {log.work_description}
                                            </p>
                                          </div>
                                        )}

                                        {log.photos && log.photos.length > 0 && (
                                          <div className="pt-1 flex items-center justify-between text-[11px] bg-emerald-50 px-2 py-1 rounded-md text-emerald-900 border border-emerald-200 font-bold">
                                            <span>📸 ภาพถ่ายหน้างาน:</span>
                                            <span>{log.photos.length}/5 ช่วง</span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="pt-2 text-[10px] text-emerald-800 font-bold border-t border-emerald-100 flex items-center justify-between">
                                        <span>คลิกเพื่อดูหรือแก้ไขบันทึก</span>
                                        <span className="text-emerald-600">↗</span>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}

            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
