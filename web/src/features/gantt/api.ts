import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';

export interface GanttArea {
  id: string | number;
  area_name: string;
  assigned_qc?: string;
  status?: string;
  qc_manual_questions?: string[];
  tasks?: Task[];
}

export interface Task {
  id: number | string;
  job_id?: number | string;
  job_no?: string;
  booking_no?: string;
  customer_name?: string;
  service_type?: string;
  area_id?: number | string;
  area_name?: string;
  assigned_qc?: string;
  task_name: string;
  assigned_tech: string;
  plan_start_date: string;
  plan_end_date: string;
  duration_days: number;
  actual_start_date?: string;
  actual_end_date?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'WAIT_QC' | 'PASSED' | 'REWORK' | 'ESCALATED' | 'DONE' | 'PENDING';
  progress_percent: number;
  qc_type?: 'ONLINE' | 'ONSITE';
  qc_score?: number | null;
  rework_count?: number;
  unit?: string;
  qty?: number;
  unit_price?: number;
  total_price?: number;
  remark?: string;
  is_delayed?: boolean;
  delay_days?: number;
  is_active_today?: boolean;
}

export interface GanttJob {
  id: string | number;
  job_no: string;
  booking_no?: string;
  ref_no?: string;
  customer_name: string;
  customer_phone?: string;
  service_type?: string;
  status: string;
  progress: number;
  areas?: GanttArea[];
  tasks?: Task[];
}

/**
 * Determine task computed status: 'DELAY' | 'ON_PROCESS' | 'WAIT_QC' | 'PASSED' | 'REWORK' | 'ESCALATED' | 'PLANNED'
 */
export function computeTaskStatus(task: Task): {
  computedStatus: 'DELAY' | 'ON_PROCESS' | 'WAIT_QC' | 'PASSED' | 'REWORK' | 'ESCALATED' | 'PLANNED';
  isDelayed: boolean;
  delayDays: number;
  isActiveToday: boolean;
} {
  const today = startOfDay(new Date());
  let isDelayed = false;
  let delayDays = 0;
  let isActiveToday = false;

  const planStart = task.plan_start_date ? parseISO(task.plan_start_date) : today;
  const planEnd = task.plan_end_date ? parseISO(task.plan_end_date) : today;

  // Check if active today
  if (today >= planStart && today <= planEnd) {
    isActiveToday = true;
  }

  // Check delay condition
  const isFinished = task.status === 'PASSED' || task.status === 'DONE' || task.progress_percent >= 100;
  if (!isFinished && today > planEnd) {
    delayDays = differenceInDays(today, planEnd);
    if (delayDays > 0) {
      isDelayed = true;
    }
  }

  let computedStatus: 'DELAY' | 'ON_PROCESS' | 'WAIT_QC' | 'PASSED' | 'REWORK' | 'ESCALATED' | 'PLANNED' = 'PLANNED';

  if (task.status === 'ESCALATED') {
    computedStatus = 'ESCALATED';
  } else if (task.status === 'REWORK') {
    computedStatus = isDelayed ? 'DELAY' : 'REWORK';
  } else if (task.status === 'WAIT_QC') {
    computedStatus = 'WAIT_QC';
  } else if (task.status === 'PASSED' || task.status === 'DONE') {
    computedStatus = 'PASSED';
  } else if (isDelayed) {
    computedStatus = 'DELAY';
  } else if (task.status === 'IN_PROGRESS' || task.progress_percent > 0) {
    computedStatus = 'ON_PROCESS';
  } else {
    computedStatus = 'PLANNED';
  }

  return {
    computedStatus,
    isDelayed,
    delayDays,
    isActiveToday,
  };
}

/**
 * Hook to fetch all jobs for the Gantt Project Selector
 */
export const useGanttJobs = () => {
  return useQuery({
    queryKey: ['ganttJobs'],
    queryFn: async () => {
      try {
        const res = await api.get<{ success: boolean; total?: number; data?: GanttJob[] } | GanttJob[]>('/api/v1/jobs');
        const list = Array.isArray(res) ? res : (res as any).data || [];
        return list as GanttJob[];
      } catch (err) {
        console.error('Failed to fetch gantt jobs:', err);
        return [] as GanttJob[];
      }
    },
  });
};

/**
 * Hook to fetch tasks flattened or grouped for the Gantt Chart
 */
export const useGanttTasks = (jobId?: string | number) => {
  return useQuery({
    queryKey: ['ganttTasks', jobId],
    queryFn: async () => {
      try {
        if (jobId && jobId !== 'ALL') {
          // Fetch specific job
          const res = await api.get<{ success: boolean; data?: any } | any>(`/api/v1/jobs/${jobId}`);
          const job = (res as any).data || res;
          if (!job) return [] as Task[];

          const tasks: Task[] = [];
          const areas: GanttArea[] = Array.isArray(job.areas) ? job.areas : [];
          
          if (Array.isArray(job.tasks) && job.tasks.length > 0) {
            job.tasks.forEach((t: any, idx: number) => {
              const matchedArea = areas.find(a => String(a.id) === String(t.area_id));
              const taskObj: Task = {
                id: t.id || `task-${job.id}-${idx}`,
                job_id: job.id,
                job_no: job.job_no,
                booking_no: job.booking_no,
                customer_name: job.customer_name,
                service_type: job.service_type || job.job_type,
                area_id: t.area_id || (matchedArea ? matchedArea.id : 'general'),
                area_name: t.area_name || (matchedArea ? matchedArea.area_name : 'งานทั่วไป'),
                assigned_qc: matchedArea?.assigned_qc || job.assigned_qc,
                task_name: t.task_name || t.name || `งานย่อย ${idx + 1}`,
                assigned_tech: t.assigned_tech || t.tech || job.assigned_tech || 'ยังไม่ระบุช่าง',
                plan_start_date: t.plan_start_date || t.planned_start_date || t.start_date || new Date().toISOString().slice(0, 10),
                plan_end_date: t.plan_end_date || t.planned_end_date || t.end_date || new Date().toISOString().slice(0, 10),
                duration_days: Number(t.duration_days || t.days || 1),
                actual_start_date: t.actual_start_date,
                actual_end_date: t.actual_end_date,
                actual_start_time: t.actual_start_time,
                actual_end_time: t.actual_end_time,
                status: t.status || 'PLANNED',
                progress_percent: Number(t.progress_percent || t.progress || 0),
                qc_score: t.qc_score,
                rework_count: t.rework_count || 0,
              };

              const computed = computeTaskStatus(taskObj);
              taskObj.is_delayed = computed.isDelayed;
              taskObj.delay_days = computed.delayDays;
              taskObj.is_active_today = computed.isActiveToday;

              tasks.push(taskObj);
            });
          }
          return tasks;
        } else {
          // Fetch all jobs and aggregate tasks
          const res = await api.get<{ success: boolean; total?: number; data?: GanttJob[] } | GanttJob[]>('/api/v1/jobs');
          const jobList: any[] = Array.isArray(res) ? res : (res as any).data || [];
          const allTasks: Task[] = [];

          jobList.forEach(job => {
            const areas: GanttArea[] = Array.isArray(job.areas) ? job.areas : [];
            if (Array.isArray(job.tasks)) {
              job.tasks.forEach((t: any, idx: number) => {
                const matchedArea = areas.find(a => String(a.id) === String(t.area_id));
                const taskObj: Task = {
                  id: t.id || `task-${job.id}-${idx}`,
                  job_id: job.id,
                  job_no: job.job_no,
                  booking_no: job.booking_no,
                  customer_name: job.customer_name,
                  service_type: job.service_type || job.job_type,
                  area_id: t.area_id || (matchedArea ? matchedArea.id : 'general'),
                  area_name: t.area_name || (matchedArea ? matchedArea.area_name : 'งานทั่วไป'),
                  assigned_qc: matchedArea?.assigned_qc || job.assigned_qc,
                  task_name: t.task_name || t.name || `งานย่อย ${idx + 1}`,
                  assigned_tech: t.assigned_tech || t.tech || job.assigned_tech || 'ยังไม่ระบุช่าง',
                  plan_start_date: t.plan_start_date || t.planned_start_date || t.start_date || new Date().toISOString().slice(0, 10),
                  plan_end_date: t.plan_end_date || t.planned_end_date || t.end_date || new Date().toISOString().slice(0, 10),
                  duration_days: Number(t.duration_days || t.days || 1),
                  actual_start_date: t.actual_start_date,
                  actual_end_date: t.actual_end_date,
                  actual_start_time: t.actual_start_time,
                  actual_end_time: t.actual_end_time,
                  status: t.status || 'PLANNED',
                  progress_percent: Number(t.progress_percent || t.progress || 0),
                  qc_score: t.qc_score,
                  rework_count: t.rework_count || 0,
                };

                const computed = computeTaskStatus(taskObj);
                taskObj.is_delayed = computed.isDelayed;
                taskObj.delay_days = computed.delayDays;
                taskObj.is_active_today = computed.isActiveToday;

                allTasks.push(taskObj);
              });
            }
          });

          return allTasks;
        }
      } catch (err) {
        console.error('Failed to fetch gantt tasks:', err);
        return [] as Task[];
      }
    },
  });
};

/**
 * Hook to Start a Task (Validates QC Area Guard & sets 24h start time)
 */
export const useStartTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, taskId, startTime }: { jobId: string | number; taskId: string | number; startTime?: string }) => {
      return await api.post(`/api/v1/jobs/${jobId}/tasks/${taskId}/start`, { start_time: startTime });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttTasks'] });
      queryClient.invalidateQueries({ queryKey: ['ganttJobs'] });
    },
  });
};

/**
 * Hook to Complete a Task (Moves to WAIT_QC)
 */
export const useCompleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, taskId, endTime }: { jobId: string | number; taskId: string | number; endTime?: string }) => {
      return await api.post(`/api/v1/jobs/${jobId}/tasks/${taskId}/complete`, { end_time: endTime });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttTasks'] });
      queryClient.invalidateQueries({ queryKey: ['ganttJobs'] });
    },
  });
};
