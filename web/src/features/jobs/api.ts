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
  status: 
    | 'NEW'
    | 'ACCEPTED'
    | 'NEED_REVIEW'
    | 'WAIT_QC'
    | 'PLANNED'
    | 'IN_PROGRESS'
    | 'PASSED'
    | 'QC_PENDING'
    | 'QC_PASS'
    | 'QC_PASSED'
    | 'REWORK'
    | 'ESCALATED'
    | 'COMPLETED'
    | 'CLOSED'
    | 'SENT'
    | 'SYNC_FAILED'
    | 'DRAFT'
    | 'SURVEYED'
    | 'DESIGNING'
    | 'BOQ'
    | (string & {});
  property_type: string;
  project_type: 'Renovate' | 'Quick Service' | 'Q' | 'R' | (string & {});
  job_type?: string;
  pmt_accepted?: boolean;
  pmt_accepted_at?: string;
  project_sub_type?: string;
  services: string[];
  assigned_tech?: string;
  plan_date?: string;
  plan_time?: string;
  plan_start_date?: string;
  appointment_date?: string;
  overall_progress: number;
  grand_total: number;
  areas?: any[];
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  phone?: string;
  address?: string;
  google_map_url?: string;
  branch_name?: string;
  branch_code?: string;
  store_code?: string;
  job_details?: Array<{
    job_type?: string;
    installation_detail?: string;
    product_quantity?: number;
    remark?: string;
  }>;
  special_instructions?: string;
  additional_notes?: string;
  remarks?: any;
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

export const useAcceptJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, job_type }: { id: number | string; job_type?: 'Q' | 'R' }) => {
      const res = await api.post<any>(`/api/v1/jobs/${id}/accept`, { job_type });
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobSummary'] });
      queryClient.invalidateQueries({ queryKey: ['jobAuditLogs', variables.id] });
    },
  });
};

export const useJobAuditLogs = (jobId: number | string) => {
  return useQuery({
    queryKey: ['jobAuditLogs', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const res = await api.get<any>(`/api/v1/jobs/${jobId}/audit-logs`);
      return Array.isArray(res) ? res : (res?.data || []);
    },
    enabled: !!jobId,
  });
};

