import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OrdersPage from '@/pages/orders';
import * as jobsApi from '../api';
import { getOverdueDays, isJobClosedOrPassed } from '@/features/orders/orders-overdue';
import { COLUMN_STORAGE_KEY } from '@/features/orders/orders-column-visibility';

const mockPhase2Jobs: jobsApi.Job[] = [
  {
    id: 101,
    job_no: 'JOB-Q-101',
    booking_no: 'BK-Q-101',
    external_ref_id: 'REF-101',
    customer: {
      name: 'สมชาย ใจดี',
      phone: '0812345678',
    },
    status: 'NEW',
    project_type: 'Quick Service',
    services: ['ติดตั้งโคมไฟ', 'เปลี่ยนปลั๊กไฟ'],
    branch_name: 'สาขาบางนา',
    plan_date: '2026-09-20',
    plan_time: '09:00',
    created_at: '2026-09-15T08:00:00.000Z',
  } as any,
  {
    id: 102,
    job_no: 'JOB-R-102',
    booking_no: 'BK-R-102',
    external_ref_id: 'REF-102',
    ticket_no: 'TK-9999',
    customer: {
      name: 'วิภาดา รักเรียน',
      phone: '0899887766',
    },
    status: 'NEW',
    project_type: 'Renovate',
    services: ['รีโนเวทห้องน้ำ'],
    branch_name: 'สาขารังสิต',
    plan_date: '2026-09-25',
    plan_time: '13:30',
    created_at: '2026-09-18T10:00:00.000Z',
  } as any,
  {
    id: 103,
    job_no: 'JOB-Q-103',
    customer: 'ประสิทธิ์ วิโรจน์',
    customer_phone: '0823456789',
    status: 'NEW',
    project_type: 'Quick Service',
    services: ['ซ่อมท่อประปา'],
    branch_name: 'สาขาพระราม 2',
    plan_date: null,
    plan_time: null,
    created_at: '2026-09-19T14:00:00.000Z',
  } as any
];

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Phase 2 — Queue Table Redesign & Mobile Cards', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(jobsApi, 'useJobs').mockReturnValue({
      data: mockPhase2Jobs,
      isLoading: false,
    } as any);
  });

  describe('1. Overdue Calculation & Logic', () => {
    it('correctly calculates overdue days based on Asia/Bangkok date', () => {
      const pastJob = {
        plan_date: '2026-09-20',
        status: 'NEW'
      };
      // Comparison date: 2026-09-25
      const days = getOverdueDays(pastJob, '2026-09-25');
      expect(days).toBe(5);
    });

    it('returns null for future appointments and today appointments', () => {
      const futureJob = {
        plan_date: '2026-09-30',
        status: 'NEW'
      };
      expect(getOverdueDays(futureJob, '2026-09-25')).toBeNull();

      const todayJob = {
        plan_date: '2026-09-25',
        status: 'NEW'
      };
      expect(getOverdueDays(todayJob, '2026-09-25')).toBeNull();
    });

    it('does not flag closed or completed jobs as overdue', () => {
      const closedJob = {
        plan_date: '2026-09-10',
        status: 'COMPLETED'
      };
      expect(isJobClosedOrPassed(closedJob)).toBe(true);
      expect(getOverdueDays(closedJob, '2026-09-25')).toBeNull();
    });

    it('returns null for unscheduled jobs (null plan_date)', () => {
      const unscheduled = { plan_date: null, status: 'NEW' };
      expect(getOverdueDays(unscheduled, '2026-09-25')).toBeNull();
    });
  });

  describe('2. Table Structure & Column Ordering', () => {
    it('renders reordered columns: Type, Job No + Booking, Customer + Phone, Appointment Date, Status, Store, Services', () => {
      renderWithProviders(<OrdersPage />);

      // Headers should match specified schema
      expect(screen.getByText('ประเภท')).toBeInTheDocument();
      expect(screen.getByText('รหัสงาน & Booking')).toBeInTheDocument();
      expect(screen.getByText('ลูกค้า & เบอร์โทร')).toBeInTheDocument();
      expect(screen.getByText('วันนัดหมาย')).toBeInTheDocument();
      expect(screen.getByText('สถานะ')).toBeInTheDocument();
      expect(screen.getByText('สาขา/Store')).toBeInTheDocument();
      expect(screen.getByText('บริการ')).toBeInTheDocument();

      // Table does NOT have '#' column
      const thElements = screen.getAllByRole('columnheader');
      const headerTexts = thElements.map(th => th.textContent?.trim());
      expect(headerTexts).not.toContain('#');
    });

    it('displays Type pill (Q / R) with distinctive styling', () => {
      renderWithProviders(<OrdersPage />);
      expect(screen.getAllByText('Q')[0]).toBeInTheDocument();
      expect(screen.getAllByText('R')[0]).toBeInTheDocument();
    });

    it('combines Job No and Booking No in one cell', () => {
      renderWithProviders(<OrdersPage />);
      expect(screen.getByText('JOB-Q-101')).toBeInTheDocument();
      expect(screen.getByText('BK-Q-101')).toBeInTheDocument();
    });

    it('combines Customer Name and Phone in one cell', () => {
      renderWithProviders(<OrdersPage />);
      expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
      expect(screen.getByText('0812345678')).toBeInTheDocument();
    });
  });

  describe('3. Column Sorting by Earliest Appointment Date', () => {
    it('defaults table sorting to earliest appointment date ascending with unscheduled at bottom', () => {
      renderWithProviders(<OrdersPage />);

      // Sorted order by plan_date asc:
      // 1. JOB-Q-101 (2026-09-20)
      // 2. JOB-R-102 (2026-09-25)
      // 3. JOB-Q-103 (null -> bottom)
      const jobRows = screen.getAllByText(/JOB-[QR]-10[1-3]/);
      expect(jobRows[0]).toHaveTextContent('JOB-Q-101');
      expect(jobRows[1]).toHaveTextContent('JOB-R-102');
      expect(jobRows[2]).toHaveTextContent('JOB-Q-103');
    });
  });

  describe('4. Column Visibility & LocalStorage Persistence', () => {
    it('toggles column visibility and persists changes to localStorage', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrdersPage />);

      // Find "คอลัมน์" dropdown button
      const colBtn = screen.getByRole('button', { name: /คอลัมน์/i });
      expect(colBtn).toBeInTheDocument();
      await user.click(colBtn);

      // Checkbox for "สาขา/Store" is present
      const storeItem = screen.getByRole('menuitemcheckbox', { name: /สาขา\/Store/i });
      expect(storeItem).toBeInTheDocument();

      // Click to hide Store column
      await user.click(storeItem);

      // Verify localStorage is updated
      const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
      expect(saved).not.toBeNull();
      const parsed = JSON.parse(saved!);
      expect(parsed.store).toBe(false);
    });
  });
});
