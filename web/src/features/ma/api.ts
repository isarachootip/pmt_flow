import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MAContract {
  id: string;
  contract_no: string;
  customer_name: string;
  phone: string;
  address: string;
  start_date: string;
  end_date: string;
  contract_value: number;
  rounds_per_year: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  services: string[];
  created_at: string;
}

export interface MARound {
  id: string;
  contract_id: string;
  round_no: number;
  scheduled_date: string;
  actual_date?: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  technician?: string;
  remark?: string;
  created_at: string;
}

export function useMAContracts() {
  const query = useQuery({
    queryKey: ['ma-contracts'],
    queryFn: () => api.get<MAContract[]>('/api/v1/ma-contracts'),
  });

  return {
    data: Array.isArray(query.data) ? query.data : ((query.data as any)?.data || []),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useMAContract(id: string) {
  const query = useQuery({
    queryKey: ['ma-contracts', id],
    queryFn: () => api.get<MAContract>(`/api/v1/ma-contracts/${id}`),
    enabled: !!id,
  });

  return {
    data: (query.data as any)?.data || query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useCreateMAContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<MAContract>) => api.post('/api/v1/ma-contracts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ma-contracts'] });
    },
  });
}

export function useCreateMARound() {
  return useMutation({
    mutationFn: (payload: Partial<MARound>) => api.post('/api/v1/ma-rounds', payload),
  });
}

export function useUpdateMARound() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<MARound> }) => api.patch(`/api/v1/ma-rounds/${id}`, payload),
  });
}
