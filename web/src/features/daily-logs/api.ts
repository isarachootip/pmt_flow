import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DailyLog {
  id: number | string;
  job_id: number | string;
  job_no?: string;
  task_id: number | string;
  task_name: string;
  log_date: string;
  start_time: string;
  end_time: string;
  work_hours?: number | string;
  day_number: number;
  total_days: number;
  technician: string;
  recorded_by?: string;
  progress_percent: number;
  work_description: string;
  photos: string[];
  is_completed: boolean;
  user_confirmed: boolean;
  created_at?: string;
}

export const useDailyLogs = (jobId?: string | number, taskId?: string | number) => {
  return useQuery({
    queryKey: ['dailyLogs', jobId, taskId],
    queryFn: async () => {
      let url = '/api/v1/daily-logs';
      if (jobId && !taskId) {
        url = `/api/v1/jobs/${jobId}/daily-logs`;
      } else if (jobId || taskId) {
        const params = new URLSearchParams();
        if (jobId) params.append('jobId', String(jobId));
        if (taskId) params.append('taskId', String(taskId));
        url = `${url}?${params.toString()}`;
      }
      const res = await api.get<any>(url);
      if (Array.isArray(res)) return res as DailyLog[];
      if (res && Array.isArray((res as any).data)) return (res as any).data as DailyLog[];
      return [] as DailyLog[];
    },
  });
};

export const useCreateDailyLog = (jobId?: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<DailyLog>) => {
      const targetJobId = jobId || data.job_id || '1';
      const res = await api.post<any>(`/api/v1/jobs/${targetJobId}/daily-logs`, data);
      return (res && (res as any).data) ? (res as any).data : res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyLogs'] });
      queryClient.invalidateQueries({ queryKey: ['ganttTasks'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useDeleteDailyLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (logId: string | number) => {
      return await api.delete<{ success: boolean }>(`/api/v1/daily-logs/${logId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyLogs'] });
      queryClient.invalidateQueries({ queryKey: ['ganttTasks'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};
