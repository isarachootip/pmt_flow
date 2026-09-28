import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JobDetailTabs } from '../job-detail-tabs';
import { Job } from '../api';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mockJob: Job = {
  id: 1,
  job_no: 'JOB-R2609018',
  booking_no: 'BK-R2609-018',
  customer: 'คุณพิชญ์สินี อัครวิวัฒน์',
  customer_address: '620/14 โฮมออฟฟิศ 4 ชั้น ถ.นวลจันทร์',
  special_instructions: 'พื้นที่พร้อมเริ่มงาน ตรวจสอบจุดขนย้ายเศษวัสดุ',
  status: 'PLANNED',
  property_type: 'บ้านเดี่ยว',
  project_type: 'RENOVATE',
  overall_progress: 30,
  grand_total: 45000,
  services: ['งานต่อเติมห้องครัว คสล.'],
  created_at: '2026-09-25T08:00:00Z',
  updated_at: '2026-09-25T08:00:00Z',
} as unknown as Job;

describe('JobDetailTabs - hideOrderSummary prop isolation', () => {
  it('renders OrderCustomerSummary when hideOrderSummary is omitted (default behavior for Orders, QC, etc.)', () => {
    renderWithProviders(<JobDetailTabs job={mockJob} defaultTab="task" />);
    // Address label must exist
    expect(screen.getByText('สถานที่ติดตั้ง:')).toBeInTheDocument();
    expect(screen.getByText('หมายเหตุ:')).toBeInTheDocument();
  });

  it('omits OrderCustomerSummary when hideOrderSummary={true} (specifically for Project & Gantt window)', () => {
    renderWithProviders(<JobDetailTabs job={mockJob} defaultTab="gantt" hideOrderSummary={true} />);
    // Address and remarks labels must NOT exist in the window
    expect(screen.queryByText('สถานที่ติดตั้ง:')).not.toBeInTheDocument();
    expect(screen.queryByText('หมายเหตุ:')).not.toBeInTheDocument();
  });
});
