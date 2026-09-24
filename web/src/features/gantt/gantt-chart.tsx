import * as React from 'react';
import { cn } from '@/lib/utils';
import { Task } from './api';
import { format, parseISO, differenceInDays, addDays, startOfDay, isToday } from 'date-fns';
import { th } from 'date-fns/locale';

interface GanttChartProps {
  tasks: Task[];
  selectedTaskId?: number;
  onSelectTask?: (task: Task) => void;
  className?: string;
}

export function GanttChart({ tasks, selectedTaskId, onSelectTask, className }: GanttChartProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { startDate, days } = React.useMemo(() => {
    if (!tasks || tasks.length === 0) {
      const today = startOfDay(new Date());
      return { startDate: today, days: Array.from({ length: 15 }, (_, i) => addDays(today, i)) };
    }

    let minDate = parseISO(tasks[0].plan_start_date);
    let maxDate = parseISO(tasks[0].plan_end_date);

    tasks.forEach(t => {
      const start = parseISO(t.plan_start_date);
      const end = parseISO(t.plan_end_date);
      if (start < minDate) minDate = start;
      if (end > maxDate) maxDate = end;
      if (t.actual_start_date) {
        const actualStart = parseISO(t.actual_start_date);
        if (actualStart < minDate) minDate = actualStart;
      }
      if (t.actual_end_date) {
        const actualEnd = parseISO(t.actual_end_date);
        if (actualEnd > maxDate) maxDate = actualEnd;
      }
    });

    // Add buffer: 3 days before, 7 days after
    minDate = addDays(minDate, -3);
    maxDate = addDays(maxDate, 7);

    const totalDays = differenceInDays(maxDate, minDate) + 1;
    const daysArr = Array.from({ length: totalDays }, (_, i) => addDays(minDate, i));

    return { startDate: minDate, days: daysArr };
  }, [tasks]);

  const getDayOffset = (dateStr: string) => {
    const d = parseISO(dateStr);
    return differenceInDays(d, startDate);
  };

  const getDuration = (startStr: string, endStr: string) => {
    return differenceInDays(parseISO(endStr), parseISO(startStr)) + 1;
  };

  const todayOffset = differenceInDays(startOfDay(new Date()), startDate);
  const cellWidth = 40; // px per day

  return (
    <div className={cn("border border-border-soft rounded-md bg-white overflow-hidden flex flex-col shadow-sm text-sm", className)}>
      {/* Header */}
      <div className="flex border-b border-border-soft bg-bg-subtle text-text-secondary font-medium select-none sticky top-0 z-20">
        <div className="w-[300px] shrink-0 border-r border-border-soft p-3 sticky left-0 bg-bg-subtle z-30 shadow-[1px_0_0_0_var(--border-soft)] flex items-center">
          ชื่องาน / ผู้รับผิดชอบ
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar flex" ref={scrollRef}>
          <div className="relative flex" style={{ width: days.length * cellWidth }}>
            {days.map((day, i) => (
              <div
                key={i}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center justify-center border-r border-border-soft text-[10px]",
                  isToday(day) ? "bg-primary-soft text-primary font-bold" : ""
                )}
                style={{ width: cellWidth }}
              >
                <div>{format(day, 'd')}</div>
                <div>{format(day, 'MMM', { locale: th })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto relative">
        <div className="flex min-w-full relative">
          
          {/* Tasks Column (Sticky Left) */}
          <div className="w-[300px] shrink-0 border-r border-border-soft bg-white sticky left-0 z-10 shadow-[1px_0_0_0_var(--border-soft)]">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "h-[60px] border-b border-border-soft p-3 flex flex-col justify-center cursor-pointer hover:bg-bg-subtle transition-colors",
                  selectedTaskId === task.id ? "bg-primary-softer" : ""
                )}
                onClick={() => onSelectTask?.(task)}
              >
                <div className="font-semibold text-text truncate">{task.task_name}</div>
                <div className="text-xs text-text-secondary flex justify-between mt-1">
                  <span className="truncate">{task.assigned_tech || 'ไม่ได้ระบุช่าง'}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-sm text-[10px] font-bold text-white",
                    task.status === 'DONE' ? "bg-st-done" :
                    task.status === 'IN_PROGRESS' ? "bg-st-progress" :
                    task.status === 'REWORK' ? "bg-st-rework" : "bg-st-neutral"
                  )}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline Area */}
          <div className="relative overflow-x-hidden flex-1 border-b border-border-soft">
            <div className="absolute inset-0 flex pointer-events-none" style={{ width: days.length * cellWidth }}>
              {days.map((_, i) => (
                <div key={i} className="flex-shrink-0 border-r border-border-soft/50 h-full" style={{ width: cellWidth }} />
              ))}
            </div>

            {/* Today Line */}
            {todayOffset >= 0 && todayOffset < days.length && (
              <div 
                className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none border-l border-dashed border-red-500"
                style={{ left: todayOffset * cellWidth + cellWidth / 2 }}
              />
            )}

            {tasks.map((task) => {
              const pOffset = getDayOffset(task.plan_start_date);
              const pDays = getDuration(task.plan_start_date, task.plan_end_date);
              const hasActual = !!task.actual_start_date;
              const aOffset = hasActual ? getDayOffset(task.actual_start_date!) : 0;
              const aDays = hasActual ? getDuration(task.actual_start_date!, task.actual_end_date || format(new Date(), 'yyyy-MM-dd')) : 0;

              return (
                <div 
                  key={task.id} 
                  className={cn(
                    "h-[60px] border-b border-border-soft relative group hover:bg-bg-subtle/50 transition-colors"
                  )}
                  style={{ width: days.length * cellWidth }}
                >
                  {/* Plan Bar */}
                  <div 
                    className="absolute top-2 h-4 bg-primary-soft rounded-sm shadow-sm"
                    style={{ left: pOffset * cellWidth, width: pDays * cellWidth }}
                    title={`Plan: ${task.plan_start_date} to ${task.plan_end_date}`}
                  />
                  
                  {/* Actual Bar */}
                  {hasActual && (
                    <div 
                      className="absolute top-7 h-4 rounded-sm shadow-sm overflow-hidden bg-gray-200"
                      style={{ left: aOffset * cellWidth, width: aDays * cellWidth }}
                      title={`Actual: ${task.actual_start_date} to ${task.actual_end_date || 'In Progress'}\nProgress: ${task.progress_percent}%`}
                    >
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${task.progress_percent}%` }}
                      />
                    </div>
                  )}

                  {/* Text % */}
                  {hasActual && (
                    <div 
                      className="absolute top-7 text-[10px] font-bold text-text"
                      style={{ left: aOffset * cellWidth + aDays * cellWidth + 4 }}
                    >
                      {task.progress_percent}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
