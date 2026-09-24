import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Ticket {
  id: string;
  ticket_no: string;
  job_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  slip_url?: string;
  status: string;
  created_at: string;
  updated_at: string;
  job_no?: string;
}

export function useTickets(jobId?: string) {
  return useQuery({
    queryKey: ['tickets', jobId],
    queryFn: async () => {
      const url = jobId ? `/tickets?job_id=${jobId}` : '/tickets';
      // api.get unwraps 'data' if present
      const result = await api.get<Ticket[]>(url);
      // Ensure we return { data: ... } for the component
      return { data: Array.isArray(result) ? result : (result as any)?.data || [] };
    },
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Ticket>) => {
      const result = await api.post<Ticket>('/tickets', payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Ticket> & { id: string }) => {
      const result = await api.patch<Ticket>(`/tickets/${id}`, payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.delete<boolean>(`/tickets/${id}`);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
