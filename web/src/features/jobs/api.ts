import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Job {
  id: number;
  job_no: string;
  external_ref_id?: string;
  booking_no?: string;
  ticket_no?: string;
  customer: {
    name: string;
    phone: string;
    address: string;
  } | string;
  status: 'SURVEYED'|'DESIGNING'|'BOQ'|'IN_PROGRESS'|'QC_PENDING'|'QC_PASS'|'REWORK'|'COMPLETED'|'CLOSED';
  property_type: string;
  project_type: 'Renovate'|'Quick Service';
  project_sub_type?: string;
  services: string[];
  assigned_tech?: string;
  plan_date?: string;
  plan_time?: string;
  overall_progress: number;
  grand_total: number;
  tasks?: Task[];
  boq_items?: any[];
  photos?: any[];
  daily_logs?: any[];
  qc_bookings?: any[];
  step_timestamps?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  task_name: string;
  assigned_tech: string;
  plan_start_date: string;
  plan_end_date: string;
  // more task fields
}

export const useJobs = (filters: Record<string, any>) => {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as Record<string, string>).toString();
      const res = await api.get<any>(`/api/v1/jobs?${params}`);
      return res;
    }
  });
};

export const useJobSummary = () => {
  return useQuery({
    queryKey: ['jobSummary'],
    queryFn: async () => {
      const res = await api.get<any>('/api/v1/jobs/summary');
      return res;
    }
  });
};

export const useJob = (id?: number | string) => {
  return useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      if (!id) throw new Error('ID required');
      const res = await api.get<any>(`/api/v1/jobs/${id}`);
      return res;
    },
    enabled: !!id,
  });
};

export const useJobTasks = (jobId?: number | string) => {
  return useQuery({
    queryKey: ['jobTasks', jobId],
    queryFn: async () => {
      if (!jobId) throw new Error('Job ID required');
      const res = await api.get<any>(`/api/v1/jobs/${jobId}/tasks`);
      return res;
    },
    enabled: !!jobId,
  });
};

export const useCreateJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post<any>('/api/v1/jobs', data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobSummary'] });
    },
  });
};

export const useUpdateJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: any }) => {
      const res = await api.patch<any>(`/api/v1/jobs/${id}`, data);
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, data }: { jobId: number | string; data: any }) => {
      const res = await api.post<any>(`/api/v1/jobs/${jobId}/tasks`, data);
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobTasks', variables.jobId] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, taskId, data }: { jobId: number | string; taskId: number | string; data: any }) => {
      const res = await api.put<any>(`/api/v1/jobs/${jobId}/tasks/${taskId}`, data);
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobTasks', variables.jobId] });
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, taskId }: { jobId: number | string; taskId: number | string }) => {
      const res = await api.delete<any>(`/api/v1/jobs/${jobId}/tasks/${taskId}`);
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobTasks', variables.jobId] });
    },
  });
};
