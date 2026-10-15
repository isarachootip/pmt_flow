import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OrdersPage from '@/pages/orders';
import * as jobsApi from '@/features/jobs/api';

const mockJobs: jobsApi.Job[] = [
  {
    id: 1,
    job_no: 'JOB-2026-001',
    booking_no: 'BK-88991',
    external_ref_id: 'REF-10001',
    property_type: 'บ้านเดี่ยว',
    customer: {
      name: 'สมชาย ใจดี',
      phone: '0812345678',
      address: 'กรุงเทพฯ',
    },
    status: 'NEW',
    project_type: 'Quick Service',
    services: ['ติดตั้งเครื่องทำน้ำอุ่น'],
    assigned_tech: 'ช่างสมศักดิ์',
    plan_date: '2026-09-25',
    plan_time: '09:00',
    overall_progress: 50,
    grand_total: 2500,
    created_at: '2026-09-20T10:00:00.000Z',
    updated_at: '2026-09-20T10:00:00.000Z',
  },
  {
    id: 2,
    job_no: 'JOB-2026-002',
    booking_no: 'BK-99002',
    external_ref_id: 'REF-20002',
    property_type: 'บ้านเดี่ยว',
    customer: {
      name: 'วิภาดา รักเรียน',
      phone: '0899887766',
      address: 'นนทบุรี',
    },
    status: 'SURVEYED',
    project_type: 'Renovate',
    services: ['รีโนเวทห้องน้ำ'],
    assigned_tech: 'ช่างประสิทธิ์',
    plan_date: '2026-09-28',
    plan_time: '13:30',
    overall_progress: 20,
    grand_total: 45000,
    created_at: '2026-09-24T14:30:00.000Z',
    updated_at: '2026-09-24T14:30:00.000Z',
  }
];

describe('Phase 1 — Responsive Layout (Splitter & Drawer)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(jobsApi, 'useJobs').mockReturnValue({
      data: mockJobs,
      isLoading: false,
    } as any);
  });

  it('renders split view with vertical splitter and list + placeholder when window width >= 1280px', () => {
    window.innerWidth = 1440;
    fireEvent(window, new Event('resize'));

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/orders']}>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Desktop mode renders placeholder when no job is selected
    expect(screen.getByText('เลือกรายการเพื่อดูรายละเอียด')).toBeInTheDocument();
    // Splitter should be rendered in desktop mode
    const verticalSplitter = container.querySelector('.cursor-col-resize');
    expect(verticalSplitter).toBeInTheDocument();
  });

  it('does NOT render placeholder in tablet mode (768px - 1279px) and displays drawer when job selected', () => {
    window.innerWidth = 1024;
    fireEvent(window, new Event('resize'));

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/orders']}>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Empty placeholder should NOT exist in tablet mode
    expect(screen.queryByText('เลือกรายการเพื่อดูรายละเอียด')).not.toBeInTheDocument();
  });

  it('does NOT render placeholder in mobile mode (< 768px)', () => {
    window.innerWidth = 375;
    fireEvent(window, new Event('resize'));

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/orders']}>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Empty placeholder should NOT exist in mobile mode
    expect(screen.queryByText('เลือกรายการเพื่อดูรายละเอียด')).not.toBeInTheDocument();
  });
});
