import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Blueprint {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  job_id: string;
  version: number;
  remark?: string;
  created_by: string;
  created_at: string;
  job_no?: string;
}

export function useBlueprints(jobId?: string) {
  return useQuery({
    queryKey: ['blueprints', jobId],
    queryFn: async () => {
      const url = jobId ? `/api/v1/blueprints?job_id=${jobId}` : '/api/v1/blueprints';
      const result = await api.get<Blueprint[]>(url);
      return { data: Array.isArray(result) ? result : (result as any)?.data || [] };
    },
  });
}

export function useCreateBlueprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Blueprint>) => {
      const result = await api.post<Blueprint>('/api/v1/blueprints', payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
    },
  });
}

export function useUpdateBlueprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Blueprint> & { id: string }) => {
      const result = await api.patch<Blueprint>(`/api/v1/blueprints/${id}`, payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
    },
  });
}

export function useDeleteBlueprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.delete<boolean>(`/api/v1/blueprints/${id}`);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
    },
  });
}
