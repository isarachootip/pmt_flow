import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  JobActiveWorkspace,
  isQuickJob,
  isRenovateJob,
} from '../job-active-workspace';
import { Job } from '../api';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

const baseJob: Job = {
  id: 777,
  job_no: 'JOB-2026-ADV01',
  booking_no: 'BK-ADV01',
  external_ref_id: 'REF-ADV01',
  property_type: 'คอนโดมิเนียม',
  customer: {
    name: 'ชาญวิทย์ วงศ์ดี',
    phone: '0811112222',
    address: 'สุขุมวิท 21',
  },
  status: 'IN_PROGRESS',
  project_type: 'Quick Service',
  services: ['ตรวจเช็กระบบไฟฟ้า'],
  assigned_tech: 'ช่างทดสอบ',
  overall_progress: 10,
  grand_total: 1500,
  created_at: '2026-09-25T08:00:00.000Z',
  updated_at: '2026-09-25T08:00:00.000Z',
};

describe('Adversarial Test Suite 1: Job Type Edge Cases', () => {
  describe('Quick Service edge cases', () => {
    const quickEdgeCases = [
      { name: "project_type: 'Quick Service'", job: { project_type: 'Quick Service' } },
      { name: "project_type: 'quick'", job: { project_type: 'quick' } },
      { name: "project_type: 'QUICK'", job: { project_type: 'QUICK' } },
      { name: "project_type: 'Quick'", job: { project_type: 'Quick' } },
      { name: "project_type: 'QuIcK sErViCe'", job: { project_type: 'QuIcK sErViCe' } },
      { name: "project_type: '  quick  ' with whitespace", job: { project_type: '  quick  ' } },
      { name: "project_type: '  Quick Service  ' with whitespace", job: { project_type: '  Quick Service  ' } },
      { name: "project_type: '\t\\n QUICK \\n\t' with tabs and newlines", job: { project_type: '\t\n QUICK \n\t' } },
      { name: "job_type: 'quick'", job: { job_type: 'quick' } },
      { name: "job_type: 'QUICK'", job: { job_type: 'QUICK' } },
      { name: "job_type: 'q'", job: { job_type: 'q' } },
      { name: "job_type: 'Q'", job: { job_type: 'Q' } },
      { name: "job_type: '  q  ' with whitespace", job: { job_type: '  q  ' } },
      { name: "project_type: 'Quick Service (ล้างแอร์)' substring", job: { project_type: 'Quick Service (ล้างแอร์)' } },
    ];

    quickEdgeCases.forEach(({ name, job }) => {
      it(`correctly identifies Quick job for ${name}`, () => {
        expect(isQuickJob(job as any)).toBe(true);
        expect(isRenovateJob(job as any)).toBe(false);
      });
    });
  });

  describe('Renovate edge cases', () => {
    const renovateEdgeCases = [
      { name: "project_type: 'Renovate'", job: { project_type: 'Renovate' } },
      { name: "project_type: 'renovate'", job: { project_type: 'renovate' } },
      { name: "project_type: 'RENOVATE'", job: { project_type: 'RENOVATE' } },
      { name: "project_type: 'rEnOvAtE'", job: { project_type: 'rEnOvAtE' } },
      { name: "project_type: 'R'", job: { project_type: 'R' } },
      { name: "project_type: 'r'", job: { project_type: 'r' } },
      { name: "project_type: '  Renovate  ' with whitespace", job: { project_type: '  Renovate  ' } },
      { name: "project_type: '  R  ' with whitespace", job: { project_type: '  R  ' } },
      { name: "project_type: '\t\\n RENOVATE \\n\t' with tabs and newlines", job: { project_type: '\t\n RENOVATE \n\t' } },
      { name: "job_type: 'renovate'", job: { job_type: 'renovate' } },
      { name: "job_type: 'RENOVATE'", job: { job_type: 'RENOVATE' } },
      { name: "job_type: 'r'", job: { job_type: 'r' } },
      { name: "job_type: 'R'", job: { job_type: 'R' } },
      { name: "job_type: '  r  ' with whitespace", job: { job_type: '  r  ' } },
      { name: "project_type: 'Renovate Kitchen' substring", job: { project_type: 'Renovate Kitchen' } },
    ];

    renovateEdgeCases.forEach(({ name, job }) => {
      it(`correctly identifies Renovate job for ${name}`, () => {
        expect(isRenovateJob(job as any)).toBe(true);
        expect(isQuickJob(job as any)).toBe(false);
      });
    });
  });

  describe('Negative & Falsy boundary cases', () => {
    const negativeCases = [
      { name: 'null job', job: null },
      { name: 'undefined job', job: undefined },
      { name: 'empty object', job: {} },
      { name: "project_type: null", job: { project_type: null } },
      { name: "project_type: undefined", job: { project_type: undefined } },
      { name: "project_type: ''", job: { project_type: '' } },
      { name: "project_type: 'General'", job: { project_type: 'General' } },
      { name: "project_type: 'Maintenance'", job: { project_type: 'Maintenance' } },
      { name: "job_type: 'repair'", job: { job_type: 'repair' } },
      { name: "project_type: 'Solar Rooftop'", job: { project_type: 'Solar Rooftop' } },
    ];

    negativeCases.forEach(({ name, job }) => {
      it(`evaluates to false for both Quick and Renovate for ${name}`, () => {
        expect(isQuickJob(job as any)).toBe(false);
        expect(isRenovateJob(job as any)).toBe(false);
      });
    });
  });
});

describe('Adversarial Test Suite 2: Update Button Toast Messages Exact Phrasing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'patch').mockResolvedValue({ success: true, data: {} });
  });

  const EXPECTED_QUICK_TOAST =
    '⚡ งานด่วน (Quick Service) อัปเดตข้อมูลและส่งต่อไปยังขั้นตอนตรวจ QC เรียบร้อยแล้ว';
  const EXPECTED_RENOVATE_TOAST =
    '🏗️ งานรีโนเวท (Renovate) อัปเดตข้อมูลและย้ายไปยังขั้นตอน Project & BOQ เรียบร้อยแล้ว';
  const EXPECTED_GENERIC_TOAST = 'อัปเดตและบันทึกข้อมูลเรียบร้อยแล้ว';

  it('triggers exact Quick toast for project_type: "QUICK"', async () => {
    const user = userEvent.setup();
    const job = { ...baseJob, id: 1, project_type: 'QUICK' } as unknown as Job;
    renderWithProviders(<JobActiveWorkspace job={job} />);

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(toast.success).toHaveBeenCalledWith(EXPECTED_QUICK_TOAST);
    expect(toast.success).not.toHaveBeenCalledWith(EXPECTED_RENOVATE_TOAST);
  });

  it('triggers exact Quick toast for job_type: "quick"', async () => {
    const user = userEvent.setup();
    const job = { ...baseJob, id: 2, project_type: undefined, job_type: 'quick' } as any;
    renderWithProviders(<JobActiveWorkspace job={job} />);

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(toast.success).toHaveBeenCalledWith(EXPECTED_QUICK_TOAST);
  });

  it('triggers exact Quick toast for mixed-case project_type: "QuIcK sErViCe"', async () => {
    const user = userEvent.setup();
    const job = { ...baseJob, id: 21, project_type: 'QuIcK sErViCe' } as unknown as Job;
    renderWithProviders(<JobActiveWorkspace job={job} />);

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(toast.success).toHaveBeenCalledWith(EXPECTED_QUICK_TOAST);
  });

  it('triggers exact Renovate toast for project_type: "R"', async () => {
    const user = userEvent.setup();
    const job = { ...baseJob, id: 3, project_type: 'R' } as unknown as Job;
    renderWithProviders(<JobActiveWorkspace job={job} />);

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(toast.success).toHaveBeenCalledWith(EXPECTED_RENOVATE_TOAST);
    expect(toast.success).not.toHaveBeenCalledWith(EXPECTED_QUICK_TOAST);
  });

  it('triggers exact Renovate toast for project_type: "renovate" (lowercase)', async () => {
    const user = userEvent.setup();
    const job = { ...baseJob, id: 4, project_type: 'renovate' } as unknown as Job;
    renderWithProviders(<JobActiveWorkspace job={job} />);

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(toast.success).toHaveBeenCalledWith(EXPECTED_RENOVATE_TOAST);
  });

  it('triggers exact Renovate toast for job_type: "R"', async () => {
    const user = userEvent.setup();
    const job = { ...baseJob, id: 41, project_type: undefined, job_type: 'R' } as any;
    renderWithProviders(<JobActiveWorkspace job={job} />);

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(toast.success).toHaveBeenCalledWith(EXPECTED_RENOVATE_TOAST);
  });

  it('triggers generic toast for unrecognized project_type', async () => {
    const user = userEvent.setup();
    const job = { ...baseJob, id: 5, project_type: 'Solar Installation' } as unknown as Job;
    renderWithProviders(<JobActiveWorkspace job={job} />);

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(toast.success).toHaveBeenCalledWith(EXPECTED_GENERIC_TOAST);
  });

  it('still triggers toast and transitions even when backend API fails (resilience check)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'patch').mockRejectedValueOnce(new Error('Network Error 500'));

    const job: Job = { ...baseJob, id: 6, project_type: 'Quick Service' };
    const handleTabChange = vi.fn();

    renderWithProviders(
      <JobActiveWorkspace job={job} onTabChange={handleTabChange} />
    );

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    // Finalize should still execute
    expect(toast.success).toHaveBeenCalledWith(EXPECTED_QUICK_TOAST);
    expect(handleTabChange).toHaveBeenCalledWith('qc');
  });
});

describe('Adversarial Test Suite 3: Tab Transitions & State Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'patch').mockResolvedValue({ success: true, data: {} });
  });

  it('calls onTabChange with "qc" for Quick job variants and mutates status to QC_PENDING with overall_progress >= 85', async () => {
    const user = userEvent.setup();
    const handleTabChange = vi.fn();
    const handleUpdateSuccess = vi.fn();

    const quickJob: Job = {
      ...baseJob,
      id: 888,
      project_type: 'Quick Service',
      overall_progress: 20, // initial low progress
    };

    renderWithProviders(
      <JobActiveWorkspace
        job={quickJob}
        onTabChange={handleTabChange}
        onUpdateSuccess={handleUpdateSuccess}
      />
    );

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(handleTabChange).toHaveBeenCalledTimes(1);
    expect(handleTabChange).toHaveBeenCalledWith('qc');

    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'QC_PENDING',
        overall_progress: 85,
        qc_inspection_type: 'ONLINE',
      })
    );
  });

  it('preserves existing overall_progress if already above 85 for Quick job', async () => {
    const user = userEvent.setup();
    const handleUpdateSuccess = vi.fn();

    const quickJob: Job = {
      ...baseJob,
      id: 889,
      project_type: 'Quick Service',
      overall_progress: 95,
    };

    renderWithProviders(
      <JobActiveWorkspace
        job={quickJob}
        onUpdateSuccess={handleUpdateSuccess}
      />
    );

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'QC_PENDING',
        overall_progress: 95,
      })
    );
  });

  it('preserves existing photos and step_timestamps during Quick update', async () => {
    const user = userEvent.setup();
    const handleUpdateSuccess = vi.fn();

    const jobWithExisting: Job = {
      ...baseJob,
      id: 890,
      project_type: 'Quick Service',
      photos: [{ slot_id: 'prelim', tag: 'prelim', label: 'ภาพเบื้องต้น', url: 'http://img.com/1.jpg' }] as any,
      step_timestamps: {
        assigned_at: '2026-09-25T08:00:00.000Z',
      } as any,
    };

    renderWithProviders(
      <JobActiveWorkspace
        job={jobWithExisting}
        onUpdateSuccess={handleUpdateSuccess}
      />
    );

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        photos: expect.arrayContaining([
          expect.objectContaining({ slot_id: 'prelim' }),
        ]),
        step_timestamps: expect.objectContaining({
          assigned_at: '2026-09-25T08:00:00.000Z',
          qc_pending_at: expect.any(String),
        }),
      })
    );
  });

  it('calls onTabChange with "boq" for Renovate job variants and sets step3_boq_at timestamp', async () => {
    const user = userEvent.setup();
    const handleTabChange = vi.fn();
    const handleUpdateSuccess = vi.fn();

    const renovateJob: Job = {
      ...baseJob,
      id: 999,
      project_type: 'Renovate',
    };

    renderWithProviders(
      <JobActiveWorkspace
        job={renovateJob}
        onTabChange={handleTabChange}
        onUpdateSuccess={handleUpdateSuccess}
      />
    );

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);

    expect(handleTabChange).toHaveBeenCalledTimes(1);
    expect(handleTabChange).toHaveBeenCalledWith('boq');

    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        step_timestamps: expect.objectContaining({
          step3_boq_at: expect.any(String),
        }),
      })
    );
  });

  it('falls back to react-router navigate when onTabChange is undefined', async () => {
    const user = userEvent.setup();

    // Quick job -> navigate('/qc')
    const quickJob = { ...baseJob, id: 1001, project_type: 'quick' } as unknown as Job;
    const { unmount } = renderWithProviders(<JobActiveWorkspace job={quickJob} />);

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/qc');

    unmount();
    vi.clearAllMocks();

    // Renovate job -> navigate('/boq')
    const renovateJob = { ...baseJob, id: 1002, project_type: 'renovate' } as unknown as Job;
    renderWithProviders(<JobActiveWorkspace job={renovateJob} />);

    const updateBtn2 = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    await user.click(updateBtn2);
    expect(mockNavigate).toHaveBeenCalledWith('/boq');
  });
});

describe('Adversarial Test Suite 4: Sticky Bottom Action Bar Styling & Badges', () => {
  it('strictly validates sticky positioning CSS classes: sticky, bottom-0, z-20, bg-white', () => {
    renderWithProviders(<JobActiveWorkspace job={baseJob} />);

    // Locate the container holding the update button
    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    const actionContainer = updateBtn.closest('.sticky');

    expect(actionContainer).not.toBeNull();
    expect(actionContainer).toHaveClass('sticky');
    expect(actionContainer).toHaveClass('bottom-0');
    expect(actionContainer).toHaveClass('z-20');
    expect(actionContainer).toHaveClass('bg-white');
    expect(actionContainer).toHaveClass('border-t');
  });

  it('renders correct job type badge in sticky bottom bar for Quick, Renovate, and Other', () => {
    // 1. Quick badge
    const { rerender } = renderWithProviders(
      <JobActiveWorkspace job={{ ...baseJob, project_type: 'QUICK' } as unknown as Job} />
    );
    expect(screen.getByText('⚡ งานด่วน (Quick Service)')).toBeInTheDocument();

    // 2. Renovate badge
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <JobActiveWorkspace job={{ ...baseJob, project_type: 'Renovate' } as Job} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('🏗️ งานรีโนเวท (Renovate)')).toBeInTheDocument();

    // 3. Unspecified/generic badge
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <JobActiveWorkspace job={{ ...baseJob, project_type: undefined, job_type: undefined } as any} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('งานทั่วไป')).toBeInTheDocument();
  });

  it('complies with 100% pure black text styling on all sticky action bar elements', () => {
    renderWithProviders(<JobActiveWorkspace job={{ ...baseJob, project_type: 'Quick Service' } as Job} />);

    const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    expect(updateBtn).toHaveClass('text-black');

    const badge = screen.getByText('⚡ งานด่วน (Quick Service)');
    expect(badge).toHaveClass('text-black');
  });

  it('renders close button when onClose prop is provided and calls onClose on click', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    renderWithProviders(<JobActiveWorkspace job={baseJob} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /ปิด/i });
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn).toHaveClass('text-black');

    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
