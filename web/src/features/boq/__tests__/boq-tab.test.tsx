import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BoqTab } from '../boq-tab';
import { Job } from '@/features/jobs/api';

const sampleJob: Job = {
  id: 1,
  job_no: 'JOB-R2609020',
  booking_no: 'BK-R2609-020',
  property_type: 'บ้านเดี่ยว',
  project_type: 'Renovate',
  overall_progress: 20,
  customer: {
    name: 'คุณศศิธร พัชรเกียรติกุล',
    phone: '089-112-3344',
    address: '89/12 เดอะ ปาล์ม พัฒนาการ'
  },
  status: 'PLANNED',
  services: ['งานติดตั้งโครงอลูมิเนียม'],
  boq_items: [
    { name: 'งานติดตั้งโครงอลูมิเนียมหนา 1.5mm อบดำ Powder Coated', unit: 'ตร.ม.', qty: 18, unit_price: 1800 },
    { name: 'งานติดตั้งกระจกนิรภัย Laminate หนา 8mm ตัดแสง UV', unit: 'ตร.ม.', qty: 18, unit_price: 1200 },
  ],
  grand_total: 54000,
  created_at: '2026-09-20T10:00:00.000Z',
  updated_at: '2026-09-20T10:00:00.000Z'
};

function renderBoqTab(job = sampleJob) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BoqTab job={job} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BoqTab - Price and Total Columns Removal', () => {
  it('displays รายการ, หน่วย, จำนวน column headers and does not display ราคา/หน่วย or รวม headers', () => {
    renderBoqTab();

    expect(screen.getByText('รายการ')).toBeInTheDocument();
    expect(screen.getByText('หน่วย')).toBeInTheDocument();
    expect(screen.getByText('จำนวน')).toBeInTheDocument();

    expect(screen.queryByText('ราคา/หน่วย')).not.toBeInTheDocument();
    expect(screen.queryByText('รวม')).not.toBeInTheDocument();
  });

  it('does not display price summary section (รวมเป็นเงิน, ส่วนลด, ยอดสุทธิ)', () => {
    renderBoqTab();

    expect(screen.queryByText('รวมเป็นเงิน:')).not.toBeInTheDocument();
    expect(screen.queryByText('ส่วนลด:')).not.toBeInTheDocument();
    expect(screen.queryByText('ยอดสุทธิ:')).not.toBeInTheDocument();
  });

  it('still renders the button to convert BOQ into tasks', () => {
    renderBoqTab();

    expect(screen.getByText(/แปลง BOQ เป็น Task/)).toBeInTheDocument();
  });
});
