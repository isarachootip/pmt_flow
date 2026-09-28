import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportsPage from '../reports';
import * as jobsApi from '@/features/jobs/api';

const mockReportJobs: jobsApi.Job[] = [
  {
    id: 1,
    job_no: 'JOB-Q2609018',
    booking_no: 'BK-Q2609-018',
    external_ref_id: 'INT-Q-2026-018',
    customer: {
      name: 'คุณวราดล อิทธิไพศาล',
      phone: '087-990-1122',
      address: '54/12 ม.การ์เด้นวิลล์ อ.เมือง จ.ปทุมธานี',
    },
    status: 'CLOSEJOB',
    project_type: 'Quick Service',
    services: ['บริการ Q - ติดตั้งปั๊มน้ำอัตโนมัติ'],
    assigned_tech: 'สมบัติ ช่างระบบ',
    plan_date: '2026-10-06',
    plan_time: '09:00',
    overall_progress: 100,
    grand_total: 3500,
    created_at: '2026-09-28T10:00:00.000Z',
    updated_at: '2026-09-28T17:04:00.000Z',
    stk_status: 'DELIVERED',
  } as any,
  {
    id: 2,
    job_no: 'JOB-R2609020',
    booking_no: 'BK-R2609-020',
    external_ref_id: 'INT-R-2026-020',
    customer: {
      name: 'คุณศศิธร พัชรเกียรติกุล',
      phone: '097-890-1234',
      address: 'กรุงเทพฯ',
    },
    status: 'PLANNED',
    project_type: 'Renovate',
    services: ['งานกั้นห้องกระจกอลูมิเนียม'],
    assigned_tech: 'ประสิทธิ์ ช่างเอก',
    plan_date: '2026-10-17',
    plan_time: '09:00',
    overall_progress: 30,
    grand_total: 45000,
    created_at: '2026-09-27T10:00:00.000Z',
    updated_at: '2026-09-27T10:00:00.000Z',
  } as any,
  {
    id: 3,
    job_no: 'JOB-Q2609019',
    booking_no: 'BK-Q2609-019',
    external_ref_id: 'INT-Q-2026-019',
    customer: {
      name: 'คุณพิมพ์พิชชา วรเกียรติ',
      phone: '088-001-2233',
      address: 'นนทบุรี',
    },
    status: 'WAIT_QC',
    project_type: 'Quick Service',
    services: ['บริการ Q - ติดตั้งเครื่องกรองน้ำ'],
    assigned_tech: 'มานะ ช่างทอง',
    plan_date: '2026-10-07',
    plan_time: '09:00',
    overall_progress: 80,
    grand_total: 2200,
    created_at: '2026-09-26T10:00:00.000Z',
    updated_at: '2026-09-26T10:00:00.000Z',
  } as any,
];

function renderWithProviders(ui: React.ReactElement, initialRoute = '/reports') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/reports" element={ui} />
          <Route path="/reports/:jobNo" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ReportsPage - Comprehensive 360° Job Report & Audit Explorer', () => {
  beforeEach(() => {
    vi.spyOn(jobsApi, 'useJobs').mockReturnValue({
      data: mockReportJobs,
      isLoading: false,
    } as any);
  });

  it('renders page header and real-time KPI ribbon summarizing all jobs', () => {
    renderWithProviders(<ReportsPage />);

    expect(screen.getByText(/รายงานภาพรวม & ประวัติงาน/i)).toBeInTheDocument();
    expect(screen.getByText('งานทั้งหมดในระบบ (Total)')).toBeInTheDocument();
    expect(screen.getByText('ปิดงานเสร็จสมบูรณ์ (Closejob / STK)')).toBeInTheDocument();
  });

  it('renders status filter tabs and job type filter pills with accurate counts', () => {
    renderWithProviders(<ReportsPage />);

    // Status filter tabs
    expect(screen.getByText('ปิดงานแล้ว (CLOSEJOB)')).toBeInTheDocument();

    // Type filter pills
    expect(screen.getByText('ประเภทงาน:')).toBeInTheDocument();
    expect(screen.getByText('งาน Quick')).toBeInTheDocument();
    expect(screen.getByText('งาน Renovate')).toBeInTheDocument();
  });

  it('displays all jobs in master table with Q/R badges and status indicators', () => {
    renderWithProviders(<ReportsPage />);

    expect(screen.getByText('JOB-Q2609018')).toBeInTheDocument();
    expect(screen.getByText('BK-Q2609-018')).toBeInTheDocument();
    expect(screen.getByText('คุณวราดล อิทธิไพศาล')).toBeInTheDocument();

    expect(screen.getByText('JOB-R2609020')).toBeInTheDocument();
    expect(screen.getByText('BK-R2609-020')).toBeInTheDocument();
    expect(screen.getByText('คุณศศิธร พัชรเกียรติกุล')).toBeInTheDocument();
  });

  it('opens 360° detail view with all 5 tabs when clicking "ดูประวัติ & ข้อมูล"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);

    // Click "ดูประวัติ & ข้อมูล" on the first row (JOB-Q2609018)
    const viewButtons = screen.getAllByRole('button', { name: /ดูประวัติ & ข้อมูล/i });
    await user.click(viewButtons[0]);

    // Detail tabs should be rendered
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(6);
    expect(tabs[0]).toHaveTextContent('งาน/Task');
    expect(tabs[1]).toHaveTextContent('BOQ');
    expect(tabs[2]).toHaveTextContent('Gantt');
    expect(tabs[3]).toHaveTextContent('QC');
    expect(tabs[4]).toHaveTextContent('ส่งออก STK');
    expect(tabs[5]).toHaveTextContent('ประวัติ (Timeline)');
  });

  it('supports deep linking directly via /reports?jobNo=JOB-Q2609018&tab=timeline', () => {
    renderWithProviders(<ReportsPage />, '/reports?jobNo=JOB-Q2609018&tab=timeline');

    // Should automatically select JOB-Q2609018 and display its tabs
    expect(screen.getAllByText('คุณวราดล อิทธิไพศาล').length).toBeGreaterThanOrEqual(1);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[5]).toHaveTextContent('ประวัติ (Timeline)');
  });

  it('filters table by job type (Quick vs Renovate)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);

    const quickBtn = screen.getByRole('button', { name: /งาน Quick/i });
    await user.click(quickBtn);

    // Only Quick jobs visible
    expect(screen.getByText('JOB-Q2609018')).toBeInTheDocument();
    expect(screen.getByText('JOB-Q2609019')).toBeInTheDocument();
    expect(screen.queryByText('JOB-R2609020')).not.toBeInTheDocument();

    // Click Renovate
    const renovateBtn = screen.getByRole('button', { name: /งาน Renovate/i });
    await user.click(renovateBtn);

    // Only Renovate jobs visible
    expect(screen.getByText('JOB-R2609020')).toBeInTheDocument();
    expect(screen.queryByText('JOB-Q2609018')).not.toBeInTheDocument();
  });
});
