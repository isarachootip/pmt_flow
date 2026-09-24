import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Task {
  id: number;
  task_name: string;
  assigned_tech: string;
  plan_start_date: string;
  plan_end_date: string;
  duration_days: number;
  actual_start_date?: string;
  actual_end_date?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REWORK';
  progress_percent: number;
  qc_type?: 'ONLINE' | 'ONSITE';
  unit?: string;
  qty?: number;
  unit_price?: number;
  total_price?: number;
  remark?: string;
}

export const useGanttTasks = (jobId?: string | number) => {
  return useQuery({
    queryKey: ['ganttTasks', jobId],
    queryFn: async () => {
      const url = jobId ? `/api/v1/tasks/gantt?job_id=${jobId}` : `/api/v1/tasks/gantt`;
      const res = await api.get<{ success: boolean; total: number; data: Task[] }>(url);
      return res.data; // Assumes api.get returns the generic type directly, or res is the payload
    },
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, data }: { jobId: string | number; data: Partial<Task> }) => {
      return await api.post(`/api/v1/jobs/${jobId}/tasks`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ganttTasks'] });
      queryClient.invalidateQueries({ queryKey: ['jobTasks', variables.jobId] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, taskId, data }: { jobId: string | number; taskId: string | number; data: Partial<Task> }) => {
      return await api.put(`/api/v1/jobs/${jobId}/tasks/${taskId}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ganttTasks'] });
      queryClient.invalidateQueries({ queryKey: ['jobTasks', variables.jobId] });
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, taskId }: { jobId: string | number; taskId: string | number }) => {
      return await api.delete(`/api/v1/jobs/${jobId}/tasks/${taskId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ganttTasks'] });
      queryClient.invalidateQueries({ queryKey: ['jobTasks', variables.jobId] });
    },
  });
};

export const useReorderTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, taskIds }: { jobId: string | number; taskIds: string[] }) => {
      return await api.post(`/api/v1/jobs/${jobId}/tasks/reorder`, { task_ids: taskIds });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ganttTasks'] });
      queryClient.invalidateQueries({ queryKey: ['jobTasks', variables.jobId] });
    },
  });
};
