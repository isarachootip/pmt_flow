import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface QCBooking {
  id: number;
  job_id: number;
  job_no: string;
  task_id?: number;
  task_name?: string;
  booking_date: string;
  time_slot: string;
  status: 'PENDING' | 'CONFIRMED' | 'DONE';
  inspector?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  customer?: any;
}

export const useQCBookings = (filters?: Record<string, any>) => {
  return useQuery({
    queryKey: ['qcBookings', filters],
    queryFn: async () => {
      const params = filters ? new URLSearchParams(filters as Record<string, string>).toString() : '';
      const res = await api.get<any>(`/api/v1/qc/bookings${params ? '?' + params : ''}`);
      return res;
    }
  });
};

export const useConfirmBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: any }) => {
      const res = await api.put<any>(`/api/v1/qc/bookings/${id}/confirm`, data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcBookings'] });
    },
  });
};

export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: any }) => {
      const res = await api.put<any>(`/api/v1/qc/bookings/${id}`, data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcBookings'] });
    },
  });
};

export const useSyncBookings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<any>(`/api/v1/qc/bookings/sync-all`, {});
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcBookings'] });
    },
  });
};

export const useQCInspection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, data }: { jobId: number | string; data: any }) => {
      const res = await api.post<any>(`/api/v1/jobs/${jobId}/qc-inspection`, data);
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['qcBookings'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId] });
    },
  });
};

export const useCSAT = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, data }: { jobId: number | string; data: any }) => {
      const res = await api.post<any>(`/api/v1/jobs/${jobId}/after-sale/csat`, data);
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId] });
    },
  });
};

export const useCloseJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: number | string) => {
      const res = await api.post<any>(`/api/v1/jobs/${jobId}/close-and-export-bmt`, {});
      return res;
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });
};

export const useExportSTK = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: number | string) => {
      const res = await api.post<any>(`/api/v1/jobs/${jobId}/export-stk`, {});
      return res;
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });
};
