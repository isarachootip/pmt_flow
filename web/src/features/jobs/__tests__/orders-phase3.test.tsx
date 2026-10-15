import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OrdersPage from '@/pages/orders';
import * as jobsApi from '../api';
import { getBangkokTodayISO } from '@/features/orders/orders-overdue';

const today = getBangkokTodayISO();
const pastDate = '2026-09-01'; // Past date guaranteed to be overdue

const mockPhase3Jobs: jobsApi.Job[] = [
  {
    id: 301,
    job_no: 'JOB-Q-301',
    booking_no: 'BK-Q-301',
    customer: { name: 'กิตติศักดิ์ พูนทรัพย์', phone: '0811112222' },
    status: 'NEW',
    project_type: 'Quick Service',
    services: ['ติดตั้งปั๊มน้ำ'],
    branch_name: 'สาขารามอินทรา',
    plan_date: pastDate, // Overdue!
    plan_time: '09:00',
    created_at: '2026-09-01T08:00:00.000Z',
  } as any,
  {
    id: 302,
    job_no: 'JOB-R-302',
    booking_no: 'BK-R-302',
    customer: { name: 'สุนิสา เจริญผล', phone: '0822223333' },
    status: 'SURVEYED',
    project_type: 'Renovate',
    services: ['รีโนเวทห้องครัว'],
    branch_name: 'สาขาบางแค',
    plan_date: today, // Today
    plan_time: '13:00',
    created_at: '2026-09-10T10:00:00.000Z',
  } as any,
  {
    id: 303,
    job_no: 'JOB-Q-303',
    customer: 'ธีรเดช รุ่งเรือง',
    customer_phone: '0833334444',
    status: 'NEW',
    project_type: 'Quick Service',
    services: ['ซ่อมท่อ'],
    branch_name: 'สาขารังสิต',
    plan_date: null, // Unscheduled
    created_at: '2026-09-15T14:00:00.000Z',
  } as any
];

const renderWithProviders = (ui: React.ReactElement, initialRoute = '/orders') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Phase 3 — Toolbar, Filters, Bulk Accept & INT Sync', () => {
  let mockRefetch: any;
  let mockAcceptJob: any;
  let mockBulkAccept: any;

  beforeEach(() => {
    localStorage.clear();
    mockRefetch = vi.fn();
    mockAcceptJob = vi.fn().mockResolvedValue({ success: true });
    mockBulkAccept = vi.fn().mockResolvedValue({ success: true, message: 'รับงานสำเร็จ' });

    vi.spyOn(jobsApi, 'useJobs').mockReturnValue({
      data: mockPhase3Jobs,
      isLoading: false,
      refetch: mockRefetch
    } as any);

    vi.spyOn(jobsApi, 'useAcceptJob').mockReturnValue({
      mutateAsync: mockAcceptJob,
      isPending: false,
    } as any);

    vi.spyOn(jobsApi, 'useBulkAcceptJobs').mockReturnValue({
      mutateAsync: mockBulkAccept,
      isPending: false,
    } as any);
  });

  describe('1. Status Filter Chips with Counts & Overdue Red Chip', () => {
    it('renders all status chips with accurate counts', () => {
      renderWithProviders(<OrdersPage />);

      // Status chips: ทั้งหมด (3), รอรับงาน (2), สำรวจ/ร่าง (1), เกินกำหนด (1)
      expect(screen.getByText('สถานะคิว:')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /ทั้งหมด 3/i })).toHaveLength(2);
      expect(screen.getByRole('button', { name: /รอรับงาน \(NEW\) 2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /สำรวจ\/ร่าง 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /เกินกำหนด 1/i })).toBeInTheDocument();
    });

    it('filters list to only NEW jobs when "รอรับงาน (NEW)" chip is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrdersPage />);

      const newChip = screen.getByRole('button', { name: /รอรับงาน \(NEW\)/i });
      await user.click(newChip);

      expect(screen.getByText('กิตติศักดิ์ พูนทรัพย์')).toBeInTheDocument(); // JOB-Q-301 (NEW)
      expect(screen.getByText('ธีรเดช รุ่งเรือง')).toBeInTheDocument(); // JOB-Q-303 (NEW)
      expect(screen.queryByText('สุนิสา เจริญผล')).not.toBeInTheDocument(); // JOB-R-302 (SURVEYED)
    });

    it('filters list to only Overdue jobs when "เกินกำหนด" red chip is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrdersPage />);

      const overdueChip = screen.getByRole('button', { name: /เกินกำหนด/i });
      await user.click(overdueChip);

      expect(screen.getByText('กิตติศักดิ์ พูนทรัพย์')).toBeInTheDocument(); // past date
      expect(screen.queryByText('สุนิสา เจริญผล')).not.toBeInTheDocument(); // today
      expect(screen.queryByText('ธีรเดช รุ่งเรือง')).not.toBeInTheDocument(); // unscheduled
    });
  });

  describe('2. Date Presets (วันนี้, 7 วัน, เดือนนี้)', () => {
    it('applies "วันนี้" preset and sets date range inputs', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrdersPage />);

      const todayBtn = screen.getByRole('button', { name: 'วันนี้' });
      await user.click(todayBtn);

      // Only JOB-R-302 (plan_date: today) matches
      expect(screen.getByText('สุนิสา เจริญผล')).toBeInTheDocument();
      expect(screen.queryByText('กิตติศักดิ์ พูนทรัพย์')).not.toBeInTheDocument();
    });
  });

  describe('3. Checkbox Row Selection & Floating Bulk Action Bar', () => {
    it('shows floating bulk bar when a row checkbox is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrdersPage />);

      // Initially, no bulk bar
      expect(screen.queryByText(/เลือกแล้ว/i)).not.toBeInTheDocument();

      // Find row checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      // checkboxes[0] is header (select all), checkboxes[1] is row 1
      await user.click(checkboxes[1]);

      // Floating bar appears
      expect(screen.getByText(/เลือกแล้ว/i)).toBeInTheDocument();
      expect(screen.getByText(/รับงาน \(1\)/i)).toBeInTheDocument();

      // Click "รับงาน (1)"
      const bulkAcceptBtn = screen.getByRole('button', { name: /รับงาน \(1\)/i });
      await user.click(bulkAcceptBtn);

      expect(mockBulkAccept).toHaveBeenCalledTimes(1);
    });

    it('selects all rows when header checkbox is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrdersPage />);

      const checkboxes = screen.getAllByRole('checkbox');
      const selectAllCheckbox = checkboxes[0];

      // Click select all
      await user.click(selectAllCheckbox);

      expect(screen.getByText(/รับงาน \(3\)/i)).toBeInTheDocument();

      // Click "ยกเลิก"
      const clearBtn = screen.getByRole('button', { name: /ยกเลิก/i });
      await user.click(clearBtn);

      expect(screen.queryByText(/เลือกแล้ว/i)).not.toBeInTheDocument();
    });
  });

  describe('4. Hover Quick Action "รับ" for NEW jobs', () => {
    it('renders "รับ" quick accept button for NEW jobs and triggers single-job acceptance', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrdersPage />);

      // Quick accept buttons exist for the 2 NEW jobs
      const quickAcceptBtns = screen.getAllByRole('button', { name: 'รับ' });
      expect(quickAcceptBtns.length).toBeGreaterThanOrEqual(1);

      await user.click(quickAcceptBtns[0]);
      expect(mockAcceptJob).toHaveBeenCalled();
    });
  });

  describe('5. INT Sync Status Indicator & Manual Refresh', () => {
    it('renders INT sync indicator and triggers refetch on click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrdersPage />);

      expect(screen.getByText(/ซิงค์ INT ล่าสุด/i)).toBeInTheDocument();

      const refreshBtn = screen.getByTitle('รีเฟรชคิวงาน INT');
      await user.click(refreshBtn);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
