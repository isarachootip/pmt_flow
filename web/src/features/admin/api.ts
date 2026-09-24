import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: 'ADMIN' | 'AE' | 'QC' | 'CONTACT_CENTER';
  user_code: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface LoginLog {
  id: string;
  username: string;
  user_id?: string;
  success: boolean;
  ip_address?: string;
  fail_reason?: string;
  created_at: string;
}

export interface ApiLog {
  id: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  ip?: string;
  user_agent?: string;
  created_at: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
}

export function useUsers() {
  const query = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/api/v1/users'),
  });
  
  return {
    data: Array.isArray(query.data) ? query.data : ((query.data as any)?.data || []),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<User>) => api.post('/api/v1/users', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<User> }) => api.patch(`/api/v1/users/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, new_password }: { id: string; new_password: string }) => api.post(`/api/v1/users/${id}/reset-password`, { new_password }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useLoginLogs() {
  const query = useQuery({
    queryKey: ['login-logs'],
    queryFn: () => api.get<PaginatedResponse<LoginLog>>('/api/v1/auth/login-logs'),
  });

  return {
    data: Array.isArray(query.data) ? query.data : ((query.data as any)?.data || []),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useApiLogs(searchQuery: string = '') {
  const query = useQuery({
    queryKey: ['api-logs', searchQuery],
    queryFn: () => api.get<PaginatedResponse<ApiLog>>(`/api/v1/system/api-logs${searchQuery}`),
  });

  return {
    data: Array.isArray(query.data) ? query.data : ((query.data as any)?.data || []),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useClearApiLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/api/v1/system/api-logs'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-logs'] });
    },
  });
}

export function useWipeTransactions() {
  return useMutation({
    mutationFn: () => api.delete('/api/v1/system/wipe-transactions'),
  });
}
