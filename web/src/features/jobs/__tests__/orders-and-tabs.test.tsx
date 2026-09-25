import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JobDetailTabs } from '../job-detail-tabs';
import OrdersPage from '@/pages/orders';
import * as jobsApi from '../api';

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
    status: 'IN_PROGRESS',
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
  },
  {
    id: 3,
    job_no: 'JOB-2026-003',
    booking_no: 'BK-77113',
    external_ref_id: 'REF-30003',
    property_type: 'บ้านเดี่ยว',
    customer: {
      name: 'กมลชนก ยิ้มหวาน',
      phone: '0855554433',
      address: 'ปทุมธานี',
    },
    status: 'QC_PENDING',
    project_type: 'Quick Service',
    services: ['เปลี่ยนปลั๊กไฟ'],
    assigned_tech: 'ช่างมานะ',
    plan_date: '2026-09-22',
    plan_time: '15:00',
    overall_progress: 90,
    grand_total: 1200,
    created_at: '2026-09-22T08:00:00.000Z',
    updated_at: '2026-09-22T08:00:00.000Z',
  },
  {
    id: 4,
    job_no: 'JOB-2026-004',
    vfix_no: 'VF-44556',
    stk_ref: 'STK-99004',
    property_type: 'คอนโด',
    customer: 'ประสิทธิ์ วิโรจน์',
    customer_phone: '082-345-6789',
    status: 'SURVEYED',
    project_type: 'Quick Service',
    services: ['ตรวจเช็คระบบไฟ'],
    assigned_tech: 'ช่างสมศักดิ์',
    plan_date: null,
    plan_time: null,
    overall_progress: 10,
    grand_total: 800,
    created_at: '2026-09-24T14:30:00.000Z', // Same created_at as JOB-2026-002 to test secondary sort by ID
    updated_at: '2026-09-24T14:30:00.000Z',
  } as any,
  {
    id: 5,
    job_no: 'JOB-2026-005',
    booking_no: 'BK-55667',
    external_ref_id: 'REF-55005',
    property_type: 'บ้านเดี่ยว',
    customer: {
      name: 'อัญชลี พูลผล',
      phone: '0831112233',
      address: 'นนทบุรี',
    },
    status: 'IN_PROGRESS',
    project_type: 'Renovate',
    services: ['ต่อเติมครัว'],
    assigned_tech: 'ช่างประสิทธิ์',
    plan_date: '2026-09-30',
    plan_time: '01:30 PM', // 12-hour PM input to test 24-hr badge normalization
    overall_progress: 40,
    grand_total: 85000,
    created_at: '2026-09-18T10:00:00.000Z',
    updated_at: '2026-09-18T10:00:00.000Z',
  },
  {
    id: 6,
    job_no: 'JOB-2026-006',
    booking_no: 'BK-66778',
    external_ref_id: 'REF-66006',
    property_type: 'ทาวน์โฮม',
    customer: {
      name: 'ธนากร มิ่งขวัญ',
      phone: '0842223344',
      address: 'สมุทรปราการ',
    },
    status: 'COMPLETED',
    project_type: 'Quick Service',
    services: ['ล้างแอร์'],
    assigned_tech: 'ช่างมานะ',
    plan_date: '2026-10-01',
    plan_time: 'ช่วงบ่าย', // Thai preset slot to test 24-hr normalization
    overall_progress: 100,
    grand_total: 1500,
    created_at: '2026-09-15T09:00:00.000Z',
    updated_at: '2026-09-15T09:00:00.000Z',
  }
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('JobDetailTabs - Core Workflow Pipeline Alignment (R4)', () => {
  const sampleJob = mockJobs[0];

  it('renders all 5 detail tabs strictly in order: [งาน/Task] -> [BOQ] -> [เงินสำรอง] -> [QC] -> [ส่งออก STK]', () => {
    renderWithProviders(<JobDetailTabs job={sampleJob} />);

    // Get all tab triggers
    const tabTriggers = screen.getAllByRole('tab');
    expect(tabTriggers).toHaveLength(5);

    expect(tabTriggers[0]).toHaveTextContent('งาน/Task');
    expect(tabTriggers[1]).toHaveTextContent('BOQ');
    expect(tabTriggers[2]).toHaveTextContent('เงินสำรอง');
    expect(tabTriggers[3]).toHaveTextContent('QC');
    expect(tabTriggers[4]).toHaveTextContent('ส่งออก STK');
  });

  it('navigates to "เงินสำรอง" (Petty Cash) tab and displays advance budget and records', () => {
    renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="petty_cash" />);

    // Check Petty Cash tab content
    expect(screen.getByText('วงเงินสำรองตั้งต้น')).toBeInTheDocument();
    expect(screen.getByText('ยอดเบิกจ่ายแล้ว')).toBeInTheDocument();
    expect(screen.getByText('วงเงินคงเหลือ')).toBeInTheDocument();
    expect(screen.getByText('+ ขอเบิกเงินสำรอง')).toBeInTheDocument();
    expect(screen.getByText('ค่าน้ำมันและค่าเดินทางหน้างาน')).toBeInTheDocument();
  });

  it('navigates to "QC" tab and displays inspection checklist with pass indicators', () => {
    renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="qc" />);

    expect(screen.getByText('Checklist คุณภาพงานมาตรฐาน (QC Checklist)')).toBeInTheDocument();
    expect(screen.getByText('1. ความเรียบร้อยของงานติดตั้งและโครงสร้าง')).toBeInTheDocument();
    expect(screen.getByText('2. ความปลอดภัยตามมาตรฐานวิศวกรรม')).toBeInTheDocument();
    expect(screen.getByText('เปิดแบบฟอร์มตรวจ QC')).toBeInTheDocument();
  });

  it('navigates to "ส่งออก STK" tab and displays STK ref, status, and export button', () => {
    renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="stk" />);

    expect(screen.getByText('การส่งออกข้อมูลไปยังระบบ STK / BMT')).toBeInTheDocument();
    expect(screen.getByText('เลขที่อ้างอิง STK (Ref)')).toBeInTheDocument();
    expect(screen.getByText('🚀 ส่งออก STK')).toBeInTheDocument();
    expect(screen.getByText('สรุปยอดรวมทางการเงินเพื่อเบิกจ่าย')).toBeInTheDocument();
  });

  it('displays Booking No and Ref ID badges in header bar', () => {
    renderWithProviders(<JobDetailTabs job={sampleJob} />);
    expect(screen.getByText('BK-88991')).toBeInTheDocument();
    expect(screen.getByText('REF-10001')).toBeInTheDocument();
  });

  it('renders "-" under วันนัดหมาย for unscheduled job (does NOT show created_at)', () => {
    const unscheduledJob = mockJobs[3]; // JOB-2026-004 has plan_date: null
    renderWithProviders(<JobDetailTabs job={unscheduledJob} />);
    const appointmentSection = screen.getByText('วันนัดหมาย').parentElement;
    expect(appointmentSection).toHaveTextContent('-');
    expect(appointmentSection).not.toHaveTextContent('24/09/2026');
  });

  it('renders DD/MM/YYYY and 24-hr badge under วันนัดหมาย for scheduled job', () => {
    renderWithProviders(<JobDetailTabs job={sampleJob} />);
    const appointmentSection = screen.getByText('วันนัดหมาย').parentElement;
    expect(appointmentSection).toHaveTextContent('25/09/2026');
    expect(appointmentSection).toHaveTextContent('09:00 น.');
  });

  it('supports case-insensitive tab routing and aliases (e.g. BOQ)', () => {
    renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="BOQ" />);
    expect(screen.getByText('รายการประเมินราคา')).toBeInTheDocument();
  });

  it('supports all pipeline tab aliases (pettycash, advance, pricing, inspection, export)', () => {
    const { unmount: u1 } = renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="pettycash" />);
    expect(screen.getByText('รายการเบิกเงินสำรอง (Petty Cash Records)')).toBeInTheDocument();
    u1();

    const { unmount: u2 } = renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="advance" />);
    expect(screen.getByText('วงเงินสำรองตั้งต้น')).toBeInTheDocument();
    u2();

    const { unmount: u3 } = renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="pricing" />);
    expect(screen.getByText('รายการประเมินราคา')).toBeInTheDocument();
    u3();

    const { unmount: u4 } = renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="inspection" />);
    expect(screen.getByText('Checklist คุณภาพงานมาตรฐาน (QC Checklist)')).toBeInTheDocument();
    u4();

    const { unmount: u5 } = renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="export" />);
    expect(screen.getByText('การส่งออกข้อมูลไปยังระบบ STK / BMT')).toBeInTheDocument();
    u5();
  });
});

describe('OrdersPage - Master List Features (R1, R2, R3, R5)', () => {
  beforeEach(() => {
    vi.spyOn(jobsApi, 'useJobs').mockReturnValue({
      data: mockJobs,
      isLoading: false,
    } as any);
  });

  it('displays Ref ID and Booking No columns visibly in the master table (R1)', () => {
    renderWithProviders(<OrdersPage />);

    // Headers
    expect(screen.getByText('Booking No')).toBeInTheDocument();
    expect(screen.getByText('Ref ID')).toBeInTheDocument();

    // Data rows
    expect(screen.getByText('BK-88991')).toBeInTheDocument();
    expect(screen.getByText('REF-10001')).toBeInTheDocument();
    expect(screen.getByText('BK-99002')).toBeInTheDocument();
    expect(screen.getByText('REF-20002')).toBeInTheDocument();
  });

  it('defaults table sorting to created_at descending with secondary sort by id descending (R2)', () => {
    renderWithProviders(<OrdersPage />);

    // created_at dates & IDs:
    // JOB-2026-004: 2026-09-24, id: 4 (1st)
    // JOB-2026-002: 2026-09-24, id: 2 (2nd)
    // JOB-2026-003: 2026-09-22 (3rd)
    // JOB-2026-001: 2026-09-20 (4th)
    const jobCells = screen.getAllByText(/JOB-2026-00[1-6]/);
    expect(jobCells[0]).toHaveTextContent('JOB-2026-004');
    expect(jobCells[1]).toHaveTextContent('JOB-2026-002');
    expect(jobCells[2]).toHaveTextContent('JOB-2026-003');
    expect(jobCells[3]).toHaveTextContent('JOB-2026-001');
    expect(jobCells[4]).toHaveTextContent('JOB-2026-005');
    expect(jobCells[5]).toHaveTextContent('JOB-2026-006');
  });

  it('filters list accurately by Customer Name (R1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'วิภาดา');

    expect(screen.getByText('วิภาดา รักเรียน')).toBeInTheDocument();
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument();
    expect(screen.queryByText('กมลชนก ยิ้มหวาน')).not.toBeInTheDocument();
  });

  it('filters list accurately by Phone Number with or without hyphens (R1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    // Customer has phone stored with hyphen: '082-345-6789'
    // Search typing digits without hyphen:
    await user.type(searchInput, '0823456789');

    expect(screen.getByText('ประสิทธิ์ วิโรจน์')).toBeInTheDocument();
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument();
  });

  it('filters list accurately by multi-token search across fields (R1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    // Search name and partial phone in one query
    await user.type(searchInput, 'วิภาดา 089');

    expect(screen.getByText('วิภาดา รักเรียน')).toBeInTheDocument();
    expect(screen.queryByText('ประสิทธิ์ วิโรจน์')).not.toBeInTheDocument();
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument();
  });

  it('filters list accurately by Booking Number via vfix_no fallback (R1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'VF-44556');

    expect(screen.getByText('ประสิทธิ์ วิโรจน์')).toBeInTheDocument();
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument();
  });

  it('filters list accurately by External Ref ID via stk_ref fallback (R1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'STK-99004');

    expect(screen.getByText('ประสิทธิ์ วิโรจน์')).toBeInTheDocument();
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument();
  });

  it('renders Appointment Date in DD/MM/YYYY with a 24-hour time badge (strictly NO AM/PM) (R3)', () => {
    renderWithProviders(<OrdersPage />);

    // Appointment dates in mock:
    // 2026-09-25 with 09:00 -> "25/09/2026" with badge "09:00 น."
    // 2026-09-28 with 13:30 -> "28/09/2026" with badge "13:30 น."
    // 2026-09-22 with 15:00 -> "22/09/2026" with badge "15:00 น."
    // 2026-09-30 with 01:30 PM -> "30/09/2026" with badge "13:30 น." (normalized, NO PM)
    // 2026-10-01 with ช่วงบ่าย -> "01/10/2026" with badge "13:00 น." (normalized)
    expect(screen.getByText('25/09/2026')).toBeInTheDocument();
    expect(screen.getByText('09:00 น.')).toBeInTheDocument();

    expect(screen.getByText('28/09/2026')).toBeInTheDocument();
    expect(screen.getAllByText('13:30 น.')).toHaveLength(2); // Job 2 and Job 5

    expect(screen.getByText('22/09/2026')).toBeInTheDocument();
    expect(screen.getByText('15:00 น.')).toBeInTheDocument();

    expect(screen.getByText('30/09/2026')).toBeInTheDocument();

    expect(screen.getByText('01/10/2026')).toBeInTheDocument();
    expect(screen.getByText('13:00 น.')).toBeInTheDocument();

    // Verify strictly NO AM/PM appears
    expect(screen.queryByText(/AM/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PM/i)).not.toBeInTheDocument();
  });

  it('filters list by date range accurately using DD/MM/YYYY inputs (R2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    // Inputs with placeholder DD/MM/YYYY for start and end date
    const dateInputs = screen.getAllByPlaceholderText('DD/MM/YYYY');
    expect(dateInputs).toHaveLength(2);

    const [startDateInput, endDateInput] = dateInputs;

    // Filter to range 23/09/2026 to 25/09/2026
    await user.type(startDateInput, '23/09/2026');
    await user.type(endDateInput, '25/09/2026');

    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.getByText('วิภาดา รักเรียน')).toBeInTheDocument();
    expect(screen.getByText('ประสิทธิ์ วิโรจน์')).toBeInTheDocument();
    expect(screen.queryByText('กมลชนก ยิ้มหวาน')).not.toBeInTheDocument();
    expect(screen.queryByText('อัญชลี พูลผล')).not.toBeInTheDocument();
  });

  it('clears active filters and restores all rows when "ล้างตัวกรอง" is clicked (R2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'สมชาย');

    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.queryByText('วิภาดา รักเรียน')).not.toBeInTheDocument();

    // Reset button appears
    const clearBtn = screen.getByText('ล้างตัวกรอง');
    expect(clearBtn).toBeInTheDocument();
    await user.click(clearBtn);

    // All rows restored
    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.getByText('วิภาดา รักเรียน')).toBeInTheDocument();
    expect(screen.getByText('ประสิทธิ์ วิโรจน์')).toBeInTheDocument();
  });

  it('filters list accurately by Booking Number without hyphens (e.g. BK88991) (R1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'BK88991');

    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.queryByText('วิภาดา รักเรียน')).not.toBeInTheDocument();
  });

  it('filters list accurately by External Ref ID without hyphens (e.g. REF10001) (R1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'REF10001');

    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.queryByText('วิภาดา รักเรียน')).not.toBeInTheDocument();
  });

  it('filters list accurately by Job Number without hyphens (e.g. JOB2026001)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'JOB2026001');

    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.queryByText('วิภาดา รักเรียน')).not.toBeInTheDocument();
  });

  it('filters list accurately by Technician name (e.g. ช่างมานะ)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'ช่างมานะ');

    expect(screen.getByText('กมลชนก ยิ้มหวาน')).toBeInTheDocument();
    expect(screen.getByText('ธนากร มิ่งขวัญ')).toBeInTheDocument();
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument();
  });

  it('filters list accurately by Service name (e.g. ติดตั้งเครื่องทำน้ำอุ่น)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'ติดตั้งเครื่องทำน้ำอุ่น');

    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.queryByText('วิภาดา รักเรียน')).not.toBeInTheDocument();
  });

  it('filters list accurately by Project Type (e.g. Renovate)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(/ค้นหา \(ลูกค้า, เบอร์โทร, Booking, Ref ID\)/i);
    await user.type(searchInput, 'Renovate');

    expect(screen.getByText('วิภาดา รักเรียน')).toBeInTheDocument();
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument();
  });

  it('filters list accurately with one-sided date range (only startDate or only endDate)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const [startDateInput] = screen.getAllByPlaceholderText('DD/MM/YYYY');
    // Only from 24/09/2026 onwards
    await user.type(startDateInput, '24/09/2026');

    expect(screen.getByText('วิภาดา รักเรียน')).toBeInTheDocument(); // created 24/09/2026
    expect(screen.getByText('ประสิทธิ์ วิโรจน์')).toBeInTheDocument(); // created 24/09/2026
    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument(); // plan_date 25/09/2026
    expect(screen.queryByText('กมลชนก ยิ้มหวาน')).not.toBeInTheDocument(); // created 22/09, plan 22/09
  });

  it('auto-normalizes reversed date range inputs (e.g. 25/09/2026 to 23/09/2026) (R2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);

    const [startDateInput, endDateInput] = screen.getAllByPlaceholderText('DD/MM/YYYY');
    // Start date is later than end date
    await user.type(startDateInput, '25/09/2026');
    await user.type(endDateInput, '23/09/2026');

    // Should still correctly include jobs within 23/09/2026 - 25/09/2026
    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.getByText('วิภาดา รักเรียน')).toBeInTheDocument();
  });

  it('renders "-" when appointment date is null (no fake 09:00 น. badge)', () => {
    renderWithProviders(<OrdersPage />);

    // JOB-2026-004 has plan_date: null
    // Row 1 is JOB-2026-004 (ประสิทธิ์ วิโรจน์)
    const row = screen.getByText('ประสิทธิ์ วิโรจน์').closest('tr');
    expect(row).toBeInTheDocument();
    // In that row, the plan_date cell should display '-'
    const cells = row!.querySelectorAll('td');
    // plan_date is column index 8 (1-based: #, job_no, booking_no, ref_id, customer, phone, services, project_type, plan_date)
    expect(cells[8]).toHaveTextContent('-');
    expect(cells[8]).not.toHaveTextContent('09:00 น.');
  });

  it('triggers CSV export with correct headers, 24-hr time badges, and no .trim() corruption', async () => {
    let exportedBlobContent = '';
    const originalBlob = globalThis.Blob;
    globalThis.Blob = class MockBlob extends originalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        if (parts) {
          exportedBlobContent = parts.map(p => String(p)).join('');
        }
      }
    } as any;

    try {
      const user = userEvent.setup();
      renderWithProviders(<OrdersPage />);

      const exportBtn = screen.getByText('ส่งออก');
      await user.click(exportBtn);

      // Verify CSV content
      expect(exportedBlobContent).toContain('รหัสงาน,Booking No,Ref ID,ลูกค้า,เบอร์โทร,บริการ,ประเภท,วันนัด,สถานะ,ยอดสุทธิ,ช่าง');
      // Must not contain the literal .trim() bug
      expect(exportedBlobContent).not.toContain('.trim()');
      // Must contain formatted 24-hr time badges
      expect(exportedBlobContent).toContain('25/09/2026 09:00 น.');
      // Unscheduled job (JOB-2026-004) must export "-" instead of fake creation date
      expect(exportedBlobContent).toContain('"JOB-2026-004","VF-44556","STK-99004","ประสิทธิ์ วิโรจน์","082-345-6789","ตรวจเช็คระบบไฟ","Quick Service","-"');
    } finally {
      globalThis.Blob = originalBlob;
    }
  });
});

describe('JobDetailTabs - Petty Cash Interaction & Query Params', () => {
  const sampleJob = mockJobs[0];

  it('submits a new petty cash request and updates list and budget', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobDetailTabs job={sampleJob} defaultTab="petty_cash" />);

    // Initial budget: 5,000, Initial spent: 1,850, Initial remaining: 3,150
    expect(screen.getByText('3,150.00 ฿')).toBeInTheDocument();

    const openModalBtn = screen.getByText('+ ขอเบิกเงินสำรอง');
    await user.click(openModalBtn);

    // Form inputs in modal
    const descInput = screen.getByPlaceholderText('เช่น ค่าน้ำมัน, ค่าอุปกรณ์ด่วน');
    const amtInput = screen.getByPlaceholderText('0.00');

    await user.type(descInput, 'ค่าซื้อหลอดไฟ LED ทดแทน');
    await user.type(amtInput, '350');

    const submitBtn = screen.getByText('บันทึกการเบิก');
    await user.click(submitBtn);

    // Verify new record appears in table
    expect(screen.getByText('ค่าซื้อหลอดไฟ LED ทดแทน')).toBeInTheDocument();
    expect(screen.getByText('350.00 ฿')).toBeInTheDocument();

    // Verify remaining budget updated: 3,150 - 350 = 2,800
    expect(screen.getByText('2,800.00 ฿')).toBeInTheDocument();
  });
});
