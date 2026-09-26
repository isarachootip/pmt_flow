import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  JobActiveWorkspace,
  isQuickJob,
  isRenovateJob,
  QUICK_TAGS,
} from '../job-active-workspace';
import { JobDetailTabs } from '../job-detail-tabs';
import { Job } from '../api';
import { api } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock FileReader for JSDOM image upload testing
class MockFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  readAsDataURL(_file: Blob) {
    this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    setTimeout(() => {
      this.onload?.();
    }, 10);
  }
}
window.FileReader = MockFileReader as any;

const mockQuickJob: Job = {
  id: 101,
  job_no: 'JOB-2026-Q01',
  booking_no: 'BK-Q1001',
  external_ref_id: 'REF-Q1001',
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
  overall_progress: 50,
  grand_total: 2500,
  created_at: '2026-09-20T10:00:00.000Z',
  updated_at: '2026-09-20T10:00:00.000Z',
};

const mockRenovateJob: Job = {
  id: 202,
  job_no: 'JOB-2026-R02',
  booking_no: 'BK-R2002',
  external_ref_id: 'REF-R2002',
  property_type: 'ทาวน์โฮม',
  customer: {
    name: 'วิภาดา รักเรียน',
    phone: '0899887766',
    address: 'นนทบุรี',
  },
  status: 'SURVEYED',
  project_type: 'Renovate',
  services: ['รีโนเวทห้องน้ำ'],
  assigned_tech: 'ช่างประสิทธิ์',
  overall_progress: 20,
  grand_total: 45000,
  created_at: '2026-09-24T14:30:00.000Z',
  updated_at: '2026-09-24T14:30:00.000Z',
};

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

describe('Job Classification Helpers', () => {
  it('correctly classifies Quick Service jobs', () => {
    expect(isQuickJob({ project_type: 'Quick Service' } as any)).toBe(true);
    expect(isQuickJob({ project_type: 'quick' } as any)).toBe(true);
    expect(isQuickJob({ job_type: 'quick' } as any)).toBe(true);
    expect(isQuickJob({ job_type: 'q' } as any)).toBe(true);
    expect(isQuickJob({ project_type: 'Renovate' } as any)).toBe(false);
  });

  it('correctly classifies Renovate jobs', () => {
    expect(isRenovateJob({ project_type: 'Renovate' } as any)).toBe(true);
    expect(isRenovateJob({ project_type: 'R' } as any)).toBe(true);
    expect(isRenovateJob({ job_type: 'renovate' } as any)).toBe(true);
    expect(isRenovateJob({ job_type: 'r' } as any)).toBe(true);
    expect(isRenovateJob({ project_type: 'Quick Service' } as any)).toBe(false);
  });
});

describe('JobActiveWorkspace Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'patch').mockResolvedValue({ success: true, data: {} });
    vi.spyOn(api, 'get').mockResolvedValue({ success: true, data: [] });
  });

  it('renders ready-to-use form replacing empty state ("ไม่มีข้อมูล")', () => {
    renderWithProviders(<JobActiveWorkspace job={mockQuickJob} />);

    // Must NOT show empty state box "ไม่มีข้อมูล"
    expect(screen.queryByText('ไม่มีข้อมูล')).not.toBeInTheDocument();

    // Must render Comment Box & Quick Tags header
    expect(
      screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
    ).toBeInTheDocument();

    // Must render PhotoSlots 5 header
    expect(
      screen.getByText('รูปถ่ายการปฏิบัติงาน 5 ขั้นตอน (PhotoSlots 5)')
    ).toBeInTheDocument();

    // Must render Activity Timeline header
    expect(
      screen.getByText('ประวัติกิจกรรมหน้างาน (Activity Timeline)')
    ).toBeInTheDocument();

    // Must render Sticky Action Bar button
    expect(screen.getByText('อัปเดตและบันทึกข้อมูล')).toBeInTheDocument();
  });

  it('renders all 7 Quick Tag pills and appends tag text into comment textarea on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobActiveWorkspace job={mockQuickJob} />);

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    expect(textarea).toHaveValue('');

    // Verify all 7 standard tags exist
    expect(QUICK_TAGS).toHaveLength(7);
    for (const tag of QUICK_TAGS) {
      expect(screen.getByRole('button', { name: tag })).toBeInTheDocument();
    }

    // Click 1st tag: "👍 เข้าหน้างานแล้ว"
    await user.click(screen.getByRole('button', { name: '👍 เข้าหน้างานแล้ว' }));
    expect(textarea).toHaveValue('👍 เข้าหน้างานแล้ว');

    // Click 2nd tag: "⚡ เริ่มดำเนินการ" -> should append with space
    await user.click(screen.getByRole('button', { name: '⚡ เริ่มดำเนินการ' }));
    expect(textarea).toHaveValue('👍 เข้าหน้างานแล้ว ⚡ เริ่มดำเนินการ');
  });

  it('renders PhotoSlots 5 with standard slot labels, supports thumbnail preview and Lightbox dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobActiveWorkspace job={mockQuickJob} />);

    // Check all 5 slot labels
    expect(screen.getByText('ก่อนเริ่มงาน')).toBeInTheDocument();
    expect(screen.getByText('ระหว่างทำ 1')).toBeInTheDocument();
    expect(screen.getByText('ระหว่างทำ 2')).toBeInTheDocument();
    expect(screen.getByText('ทดสอบระบบ')).toBeInTheDocument();
    expect(screen.getByText('หลังเสร็จสิ้น')).toBeInTheDocument();

    // Find file inputs inside PhotoSlots5
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(5);

    // Upload an image into slot 1 (ก่อนเริ่มงาน)
    const mockFile = new File(['mock content'], 'site-before.png', { type: 'image/png' });
    fireEvent.change(fileInputs[0], { target: { files: [mockFile] } });

    // Wait for FileReader to load and thumbnail image to appear
    await waitFor(() => {
      const img = screen.getByAltText('ก่อนเริ่มงาน');
      expect(img).toBeInTheDocument();
    });

    // Check maximize/lightbox button appears on thumbnail
    const maximizeBtns = document.querySelectorAll('button:has(svg.lucide-maximize2)');
    expect(maximizeBtns.length).toBeGreaterThan(0);

    // Click maximize button to open Lightbox Dialog
    await user.click(maximizeBtns[0]);

    // Dialog preview image should appear
    await waitFor(() => {
      const previewImg = screen.getByAltText('Preview');
      expect(previewImg).toBeInTheDocument();
    });
  });

  it('renders Activity Timeline with author, DD/MM/YYYY date, and 24-hr time badge (NO AM/PM)', () => {
    const jobWithActivity: Job = {
      ...mockQuickJob,
      remarks_data: {
        activities: [
          {
            id: 'act-1',
            author: 'สมเกียรติ (ช่างติดตั้ง)',
            text: 'เข้าหน้างานและติดตั้งอุปกรณ์ชุดแรกเรียบร้อย',
            timestamp: '2026-09-25T13:30:00.000Z',
            time: '13:30',
          },
        ],
      },
    } as any;

    renderWithProviders(<JobActiveWorkspace job={jobWithActivity} />);

    // Author
    expect(screen.getByText('สมเกียรติ (ช่างติดตั้ง)')).toBeInTheDocument();

    // Date formatted as DD/MM/YYYY
    expect(screen.getByText('25/09/2026')).toBeInTheDocument();

    // Time badge in 24-hour format
    expect(screen.getByText(/13:30 น\./i)).toBeInTheDocument();

    // Strictly NO AM/PM anywhere
    expect(screen.queryByText(/AM/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PM/i)).not.toBeInTheDocument();

    // Comment text
    expect(screen.getByText('เข้าหน้างานและติดตั้งอุปกรณ์ชุดแรกเรียบร้อย')).toBeInTheDocument();
  });

  it('supports Hybrid Comment Action ("ส่งคอมเมนต์ด่วน") without advancing workflow status', async () => {
    const user = userEvent.setup();
    const handleTabChange = vi.fn();
    renderWithProviders(
      <JobActiveWorkspace job={mockQuickJob} onTabChange={handleTabChange} />
    );

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    await user.type(textarea, 'แจ้งอัปเดตหน้างาน: รอสายไฟเพิ่มเติม');

    const quickSubmitBtn = screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i });
    expect(quickSubmitBtn).toBeEnabled();

    await user.click(quickSubmitBtn);

    // Check toast fired
    expect(toast.success).toHaveBeenCalledWith('ส่งคอมเมนต์ด่วนเรียบร้อยแล้ว');

    // Textarea cleared
    expect(textarea).toHaveValue('');

    // Activity timeline contains the new entry
    expect(screen.getByText('แจ้งอัปเดตหน้างาน: รอสายไฟเพิ่มเติม')).toBeInTheDocument();

    // Workflow status did NOT transition (tab change was NOT called)
    expect(handleTabChange).not.toHaveBeenCalled();
  });

  it('executes Quick Service Workflow Routing: status QC_PENDING, ⚡ toast, tab switch to "qc"', async () => {
    const user = userEvent.setup();
    const handleTabChange = vi.fn();
    const handleUpdateSuccess = vi.fn();

    renderWithProviders(
      <JobActiveWorkspace
        job={mockQuickJob}
        onTabChange={handleTabChange}
        onUpdateSuccess={handleUpdateSuccess}
      />
    );

    // Click primary update button
    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    // Verify Toast notification with exact required emoji and text
    expect(toast.success).toHaveBeenCalledWith(
      '⚡ งานด่วน (Quick Service) อัปเดตข้อมูลและส่งต่อไปยังขั้นตอนตรวจ QC เรียบร้อยแล้ว'
    );

    // Verify tab transition to 'qc'
    expect(handleTabChange).toHaveBeenCalledWith('qc');

    // Verify callback received QC_PENDING status
    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'QC_PENDING',
      })
    );
  });

  it('executes Renovate Workflow Routing: 🏗️ toast, tab switch to "boq"', async () => {
    const user = userEvent.setup();
    const handleTabChange = vi.fn();
    const handleUpdateSuccess = vi.fn();

    renderWithProviders(
      <JobActiveWorkspace
        job={mockRenovateJob}
        onTabChange={handleTabChange}
        onUpdateSuccess={handleUpdateSuccess}
      />
    );

    // Click primary update button
    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    // Verify Toast notification with exact required emoji and text
    expect(toast.success).toHaveBeenCalledWith(
      '🏗️ งานรีโนเวท (Renovate) อัปเดตข้อมูลและย้ายไปยังขั้นตอน Project & BOQ เรียบร้อยแล้ว'
    );

    // Verify tab transition to 'boq'
    expect(handleTabChange).toHaveBeenCalledWith('boq');
    expect(handleUpdateSuccess).toHaveBeenCalled();
  });

  it('renders Sticky Bottom Action Bar with required layout classes and job type indicator', () => {
    renderWithProviders(<JobActiveWorkspace job={mockQuickJob} />);

    // Check sticky bar container
    const stickyBar = screen.getByText('อัปเดตและบันทึกข้อมูล').closest('div');
    expect(stickyBar?.parentElement).toHaveClass('sticky');
    expect(stickyBar?.parentElement).toHaveClass('bottom-0');
    expect(stickyBar?.parentElement).toHaveClass('z-20');
    expect(stickyBar?.parentElement).toHaveClass('bg-white');
    expect(stickyBar?.parentElement).toHaveClass('border-t');

    // Job type indicator for Quick Service
    expect(screen.getByText('⚡ งานด่วน (Quick Service)')).toBeInTheDocument();
  });
});

describe('JobDetailTabs Integration with JobActiveWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'patch').mockResolvedValue({ success: true, data: {} });
    vi.spyOn(api, 'get').mockResolvedValue({ success: true, data: [] });
  });

  it('mounts JobActiveWorkspace in Tab 1 ("งาน/Task") replacing empty state when tasks is empty', () => {
    // When job has no tasks, tasksData is empty
    renderWithProviders(<JobDetailTabs job={mockQuickJob} />);

    // Must NOT have empty state box
    expect(screen.queryByText('ไม่มีข้อมูล')).not.toBeInTheDocument();

    // Must display Active Workspace form directly
    expect(
      screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('รูปถ่ายการปฏิบัติงาน 5 ขั้นตอน (PhotoSlots 5)')
    ).toBeInTheDocument();
    expect(screen.getByText('อัปเดตและบันทึกข้อมูล')).toBeInTheDocument();
  });
});
