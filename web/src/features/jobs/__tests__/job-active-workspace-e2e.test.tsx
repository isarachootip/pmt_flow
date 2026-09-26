import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  JobActiveWorkspace,
  QUICK_TAGS,
} from '../job-active-workspace';
import { JobDetailTabs } from '../job-detail-tabs';
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

// Mock react-router-dom useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock FileReader for JSDOM image upload testing
class MockFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  readAsDataURL(file: Blob) {
    this.result = `data:${file.type || 'image/png'};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
    setTimeout(() => {
      this.onload?.();
    }, 10);
  }
}
window.FileReader = MockFileReader as any;

const createQuickJob = (overrides?: Partial<Job>): Job => ({
  id: 101,
  job_no: 'JOB-2026-Q-E2E',
  booking_no: 'BK-QE2E-01',
  external_ref_id: 'REF-QE2E-01',
  property_type: 'บ้านเดี่ยว 2 ชั้น',
  customer: {
    name: 'สิทธิพร เกียรติอนันต์',
    phone: '0812345678',
    address: 'สุขุมวิท 71 กรุงเทพฯ',
  },
  status: 'IN_PROGRESS',
  project_type: 'Quick Service',
  services: ['ติดตั้งเครื่องปรับอากาศด่วน'],
  assigned_tech: 'ช่างสมศักดิ์ น้อมนำ',
  overall_progress: 30,
  grand_total: 4500,
  created_at: '2026-09-20T08:30:00.000Z',
  updated_at: '2026-09-20T08:30:00.000Z',
  ...overrides,
});

const createRenovateJob = (overrides?: Partial<Job>): Job => ({
  id: 202,
  job_no: 'JOB-2026-R-E2E',
  booking_no: 'BK-RE2E-02',
  external_ref_id: 'REF-RE2E-02',
  property_type: 'ทาวน์โฮม 3 ชั้น',
  customer: {
    name: 'พรทิพย์ เจริญกิจ',
    phone: '0898765432',
    address: 'บางใหญ่ นนทบุรี',
  },
  status: 'SURVEYED',
  project_type: 'Renovate',
  services: ['รีโนเวทห้องครัวและระบบน้ำทิ้ง'],
  assigned_tech: 'ช่างประสิทธิ์ บุญมี',
  overall_progress: 15,
  grand_total: 185000,
  created_at: '2026-09-22T09:15:00.000Z',
  updated_at: '2026-09-22T09:15:00.000Z',
  ...overrides,
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

const EXPECTED_QUICK_TOAST =
  '⚡ งานด่วน (Quick Service) อัปเดตข้อมูลและส่งต่อไปยังขั้นตอนตรวจ QC เรียบร้อยแล้ว';
const EXPECTED_RENOVATE_TOAST =
  '🏗️ งานรีโนเวท (Renovate) อัปเดตข้อมูลและย้ายไปยังขั้นตอน Project & BOQ เรียบร้อยแล้ว';

/* ==========================================================================
   TIER 1: FEATURE COVERAGE (F1 - F8)
   Requirement-driven opaque-box verification for each feature
   ========================================================================== */
describe('Tier 1: Feature Coverage (F1 - F8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'patch').mockResolvedValue({ success: true, data: {} });
    vi.spyOn(api, 'get').mockResolvedValue({ success: true, data: [] });
  });

  /* ------------------------------------------------------------------------
     F1: Active Input Workspace replacing empty state
     ------------------------------------------------------------------------ */
  describe('F1: Active Input Workspace', () => {
    it('F1.1: Replaces empty state box ("ไม่มีข้อมูล") when mounted inside JobDetailTabs with 0 tasks', () => {
      const job = createQuickJob({ tasks: [] });
      renderWithProviders(<JobDetailTabs job={job} defaultTab="task" />);

      expect(screen.queryByText('ไม่มีข้อมูล')).not.toBeInTheDocument();
      expect(
        screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
      ).toBeInTheDocument();
    });

    it('F1.2: Renders all 4 core workspace sections: Comments, PhotoSlots, Timeline, Sticky Action Bar', () => {
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(
        screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
      ).toBeInTheDocument();
      expect(
        screen.getByText('รูปถ่ายการปฏิบัติงาน 5 ขั้นตอน (PhotoSlots 5)')
      ).toBeInTheDocument();
      expect(
        screen.getByText('ประวัติกิจกรรมหน้างาน (Activity Timeline)')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i })
      ).toBeInTheDocument();
    });

    it('F1.3: Displays dynamically bound technician author name in header', () => {
      const job = createQuickJob({ assigned_tech: 'ช่างสามารถ เก่งกล้า' });
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(screen.getAllByText('ช่างสามารถ เก่งกล้า').length).toBeGreaterThanOrEqual(1);
    });

    it('F1.4: Automatically initializes default activity timeline entry with job number and project type', () => {
      const job = createQuickJob({ job_no: 'JOB-2026-F1-INIT', project_type: 'Quick Service' });
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(
        screen.getByText(/รับมอบหมายงาน JOB-2026-F1-INIT \(Quick Service\) เรียบร้อย/)
      ).toBeInTheDocument();
    });

    it('F1.5: Strictly complies with Pure Light Theme and 100% pure black text styling', () => {
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
      expect(updateBtn).toHaveClass('text-black');

      const headers = screen.getAllByRole('heading', { level: 3 });
      headers.forEach((h) => {
        expect(h).toHaveClass('text-black');
      });
    });

    it('F1.6: Mounts JobActiveWorkspace when switching view mode to workspace even if tasks exist', async () => {
      const user = userEvent.setup();
      const mockTasks = [
        {
          id: 1,
          task_name: 'งานทดสอบ 1',
          assigned_tech: 'ช่างทดสอบ',
          plan_start_date: '2026-09-20',
          plan_end_date: '2026-09-21',
        },
      ];
      vi.spyOn(api, 'get').mockResolvedValue({ success: true, data: mockTasks });

      const job = createQuickJob({ tasks: mockTasks });
      renderWithProviders(<JobDetailTabs job={job} defaultTab="task" />);

      // Switch to workspace mode
      const workspaceBtn = screen.getByRole('button', {
        name: /พื้นที่ทำงาน & รูปภาพ \(Active Workspace\)/i,
      });
      await user.click(workspaceBtn);

      expect(
        screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
      ).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------------
     F2: Quick Tags & Comment Box
     ------------------------------------------------------------------------ */
  describe('F2: Quick Tags & Comment Box', () => {
    it('F2.1: Renders all 7 predefined Quick Tag buttons', () => {
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(QUICK_TAGS).toHaveLength(7);
      QUICK_TAGS.forEach((tag) => {
        expect(screen.getByRole('button', { name: tag })).toBeInTheDocument();
      });
    });

    it('F2.2: Clicking a Quick Tag appends the tag to the comment textarea', async () => {
      const user = userEvent.setup();
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
      const tagBtn = screen.getByRole('button', { name: '👍 เข้าหน้างานแล้ว' });

      await user.click(tagBtn);
      expect(textarea).toHaveValue('👍 เข้าหน้างานแล้ว');
    });

    it('F2.3: Clicking multiple Quick Tags sequentially concatenates them with single space', async () => {
      const user = userEvent.setup();
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
      await user.click(screen.getByRole('button', { name: '👍 เข้าหน้างานแล้ว' }));
      await user.click(screen.getByRole('button', { name: '⚡ เริ่มดำเนินการ' }));
      await user.click(screen.getByRole('button', { name: '🔌 ทดสอบระบบผ่าน' }));

      expect(textarea).toHaveValue(
        '👍 เข้าหน้างานแล้ว ⚡ เริ่มดำเนินการ 🔌 ทดสอบระบบผ่าน'
      );
    });

    it('F2.4: Character counter dynamically reflects current comment length', async () => {
      const user = userEvent.setup();
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(screen.getByText(/ความยาวข้อความ:\s*0\s*ตัวอักษร/)).toBeInTheDocument();

      const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
      await user.type(textarea, 'กำลังตรวจสอบ');
      expect(screen.getByText(/ความยาวข้อความ:\s*12\s*ตัวอักษร/)).toBeInTheDocument();
    });

    it('F2.5: Textarea maintains pure black text color and high contrast', () => {
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
      expect(textarea).toHaveClass('text-black');
      expect(textarea).toHaveClass('bg-white');
    });
  });

  /* ------------------------------------------------------------------------
     F3: PhotoSlots 5-Step Gallery with Upload & Lightbox
     ------------------------------------------------------------------------ */
  describe('F3: PhotoSlots 5-Step Gallery', () => {
    it('F3.1: Renders exactly 5 standard workflow phases in correct order', () => {
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(screen.getByText('ก่อนเริ่มงาน')).toBeInTheDocument();
      expect(screen.getByText('ระหว่างทำ 1')).toBeInTheDocument();
      expect(screen.getByText('ระหว่างทำ 2')).toBeInTheDocument();
      expect(screen.getByText('ทดสอบระบบ')).toBeInTheDocument();
      expect(screen.getByText('หลังเสร็จสิ้น')).toBeInTheDocument();
    });

    it('F3.2: Uploading an image file sets thumbnail preview and hides upload prompt for that slot', async () => {
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const fileInputs = document.querySelectorAll('input[type="file"]');
      expect(fileInputs.length).toBe(5);

      const fakeFile = new File(['dummy-content'], 'site-before.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInputs[0], { target: { files: [fakeFile] } });

      await waitFor(() => {
        const img = screen.getByAltText('ก่อนเริ่มงาน');
        expect(img).toBeInTheDocument();
        expect(img.getAttribute('src')).toContain('data:image/jpeg;base64');
      });
    });

    it('F3.3: Pre-populates existing photos from job.photos into matching slot IDs', () => {
      const job = createQuickJob({
        photos: [
          { slot_id: 'before', url: 'https://example.com/site-before.jpg' },
          { slot_id: 'after', url: 'https://example.com/site-after.jpg' },
        ],
      });
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(screen.getByAltText('ก่อนเริ่มงาน')).toHaveAttribute('src', 'https://example.com/site-before.jpg');
      expect(screen.getByAltText('หลังเสร็จสิ้น')).toHaveAttribute('src', 'https://example.com/site-after.jpg');
    });

    it('F3.4: Maximizing a photo thumbnail opens Lightbox modal dialog displaying preview image', async () => {
      const user = userEvent.setup();
      const job = createQuickJob({
        photos: [{ slot_id: 'before', url: 'https://example.com/lightbox-zoom.jpg' }],
      });
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const beforeImg = screen.getByAltText('ก่อนเริ่มงาน');
      const zoomBtn = within(beforeImg.parentElement!).getByRole('button');
      await user.click(zoomBtn);

      await waitFor(() => {
        const previewImg = screen.getByAltText('Preview');
        expect(previewImg).toBeInTheDocument();
        expect(previewImg).toHaveAttribute('src', 'https://example.com/lightbox-zoom.jpg');
      });
    });

    it('F3.5: Lightbox dialog closes cleanly upon pressing Escape key', async () => {
      const user = userEvent.setup();
      const job = createQuickJob({
        photos: [{ slot_id: 'before', url: 'https://example.com/lightbox-close.jpg' }],
      });
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const beforeImg = screen.getByAltText('ก่อนเริ่มงาน');
      const zoomBtn = within(beforeImg.parentElement!).getByRole('button');
      await user.click(zoomBtn);

      await waitFor(() => {
        expect(screen.getByAltText('Preview')).toBeInTheDocument();
      });

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
      });
    });
  });

  /* ------------------------------------------------------------------------
     F4: Activity Timeline Stream (DD/MM/YYYY + 24-hr time badges)
     ------------------------------------------------------------------------ */
  describe('F4: Activity Timeline Stream', () => {
    it('F4.1: Displays author name and activity count badge in timeline header', () => {
      const job = createQuickJob({ assigned_tech: 'ช่างอนุชา' });
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(screen.getByText('1 รายการ')).toBeInTheDocument();
      expect(screen.getAllByText('ช่างอนุชา').length).toBeGreaterThanOrEqual(1);
    });

    it('F4.2: Strictly formats activity date in DD/MM/YYYY pattern (never YYYY-MM-DD or MM/DD/YYYY)', () => {
      const job = createQuickJob({
        remarks_data: {
          activities: [
            {
              id: 'act-date-1',
              author: 'ช่างธีระ',
              text: 'ตรวจหน้างานเสร็จสิ้น',
              timestamp: '2026-09-26T14:30:00.000Z',
            },
          ],
        },
      } as any);
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(screen.getByText('26/09/2026')).toBeInTheDocument();
      expect(screen.queryByText('2026-09-26')).not.toBeInTheDocument();
    });

    it('F4.3: Strictly formats time badge in 24-Hour format (HH:mm น.) with no AM or PM', () => {
      const job = createQuickJob({
        remarks_data: {
          activities: [
            {
              id: 'act-time-1',
              author: 'ช่างธีระ',
              text: 'บันทึกรอบบ่าย',
              timestamp: '2026-09-26T07:15:00.000Z',
            },
          ],
        },
      } as any);
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const badges = screen.getAllByText(/\d{2}:\d{2}\s*น\./);
      expect(badges.length).toBeGreaterThanOrEqual(1);

      expect(screen.queryByText(/AM/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/PM/i)).not.toBeInTheDocument();
    });

    it('F4.4: Renders photo thumbnail attachments inside timeline cards', () => {
      const job = createQuickJob({
        remarks_data: {
          activities: [
            {
              id: 'act-photo-1',
              author: 'ช่างธีระ',
              text: 'ภาพแอร์ก่อนถอดล้าง',
              timestamp: '2026-09-26T09:00:00.000Z',
              photos: [{ id: 'p1', url: 'https://example.com/act-thumb.jpg', label: 'แอร์ก่อนล้าง' }],
            },
          ],
        },
      } as any);
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const thumb = screen.getByAltText('แอร์ก่อนล้าง');
      expect(thumb).toBeInTheDocument();
      expect(thumb).toHaveAttribute('src', 'https://example.com/act-thumb.jpg');
    });

    it('F4.5: Clicking timeline photo opens Timeline Lightbox preview dialog', async () => {
      const user = userEvent.setup();
      const job = createQuickJob({
        remarks_data: {
          activities: [
            {
              id: 'act-photo-lightbox',
              author: 'ช่างธีระ',
              text: 'ภาพทดสอบระบบสายดิน',
              timestamp: '2026-09-26T10:00:00.000Z',
              photos: [{ id: 'p2', url: 'https://example.com/grounding-test.jpg', label: 'สายดิน' }],
            },
          ],
        },
      } as any);
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const thumbContainer = screen.getByTitle('คลิกเพื่อดูรูปขนาดเต็ม');
      await user.click(thumbContainer);

      await waitFor(() => {
        const preview = screen.getByAltText('Timeline Preview');
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute('src', 'https://example.com/grounding-test.jpg');
      });
    });
  });

  /* ------------------------------------------------------------------------
     F5: Sticky Bottom Action Bar
     ------------------------------------------------------------------------ */
  describe('F5: Sticky Bottom Action Bar', () => {
    it('F5.1: Positions action bar persistently at bottom using sticky classes', () => {
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const updateBtn = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
      const stickyBar = updateBtn.closest('.sticky');

      expect(stickyBar).not.toBeNull();
      expect(stickyBar).toHaveClass('sticky');
      expect(stickyBar).toHaveClass('bottom-0');
      expect(stickyBar).toHaveClass('z-20');
      expect(stickyBar).toHaveClass('bg-white');
    });

    it('F5.2: Displays Quick Service badge for quick jobs in sticky bar', () => {
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(screen.getByText('⚡ งานด่วน (Quick Service)')).toBeInTheDocument();
    });

    it('F5.3: Displays Renovate badge for renovate jobs in sticky bar', () => {
      const job = createRenovateJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(screen.getByText('🏗️ งานรีโนเวท (Renovate)')).toBeInTheDocument();
    });

    it('F5.4: Displays generic badge for standard jobs in sticky bar', () => {
      const job = createQuickJob({ project_type: undefined, job_type: undefined } as any);
      renderWithProviders(<JobActiveWorkspace job={job} />);

      expect(screen.getByText('งานทั่วไป')).toBeInTheDocument();
    });

    it('F5.5: Renders Close button and calls onClose when provided', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} onClose={handleClose} />);

      const closeBtn = screen.getByRole('button', { name: 'ปิด' });
      await user.click(closeBtn);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  /* ------------------------------------------------------------------------
     F6: Hybrid Quick Action ("ส่งคอมเมนต์ด่วน")
     ------------------------------------------------------------------------ */
  describe('F6: Hybrid Quick Action', () => {
    it('F6.1: Disables "ส่งคอมเมนต์ด่วน" button when comment is empty or blank', () => {
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const quickCommentBtn = screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i });
      expect(quickCommentBtn).toBeDisabled();
    });

    it('F6.2: Enables "ส่งคอมเมนต์ด่วน" button when valid comment text is entered', async () => {
      const user = userEvent.setup();
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
      const quickCommentBtn = screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i });

      await user.type(textarea, 'ช่างเริ่มงานแล้ว');
      expect(quickCommentBtn).toBeEnabled();
    });

    it('F6.3: Clicking "ส่งคอมเมนต์ด่วน" prepends activity to timeline immediately and clears textarea', async () => {
      const user = userEvent.setup();
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
      const quickCommentBtn = screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i });

      await user.type(textarea, 'ตรวจสอบระดับน้ำยาแอร์เรียบร้อย ปกติดี');
      await user.click(quickCommentBtn);

      await waitFor(() => {
        expect(screen.getByText('ตรวจสอบระดับน้ำยาแอร์เรียบร้อย ปกติดี')).toBeInTheDocument();
        expect(textarea).toHaveValue('');
        expect(toast.success).toHaveBeenCalledWith('ส่งคอมเมนต์ด่วนเรียบร้อยแล้ว');
      });
    });

    it('F6.4: Quick comment does not advance job status (stays in current status without advancing to QC)', async () => {
      const user = userEvent.setup();
      const handleTabChange = vi.fn();
      const handleUpdateSuccess = vi.fn();
      const job = createQuickJob({ status: 'IN_PROGRESS' });

      renderWithProviders(
        <JobActiveWorkspace
          job={job}
          onTabChange={handleTabChange}
          onUpdateSuccess={handleUpdateSuccess}
        />
      );

      const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
      await user.type(textarea, 'คอมเมนต์ความคืบหน้าระหว่างวัน');
      await user.click(screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i }));

      expect(handleTabChange).not.toHaveBeenCalled();
      expect(handleUpdateSuccess).not.toHaveBeenCalled();
    });

    it('F6.5: Quick comment attaches currently staged photo thumbnails into the timeline entry', async () => {
      const user = userEvent.setup();
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      // Stage photo in slot 0
      const fileInputs = document.querySelectorAll('input[type="file"]');
      const fakeFile = new File(['img'], 'test.png', { type: 'image/png' });
      fireEvent.change(fileInputs[0], { target: { files: [fakeFile] } });

      await waitFor(() => {
        expect(screen.getByAltText('ก่อนเริ่มงาน')).toBeInTheDocument();
      });

      // Type and submit quick comment
      const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
      await user.type(textarea, 'แนบรูปภาพก่อนเริ่มงาน');
      await user.click(screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i }));

      await waitFor(() => {
        expect(screen.getByText('แนบรูปภาพก่อนเริ่มงาน')).toBeInTheDocument();
        const timelineThumbs = screen.getAllByAltText('ก่อนเริ่มงาน');
        expect(timelineThumbs.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  /* ------------------------------------------------------------------------
     F7: Quick Service Workflow Routing (Quick -> QC)
     ------------------------------------------------------------------------ */
  describe('F7: Quick Service Workflow Routing', () => {
    it('F7.1: Mutates status to QC_PENDING with overall_progress elevated to >= 85%', async () => {
      const user = userEvent.setup();
      const handleUpdateSuccess = vi.fn();
      const job = createQuickJob({ overall_progress: 25 });

      renderWithProviders(
        <JobActiveWorkspace job={job} onUpdateSuccess={handleUpdateSuccess} />
      );

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(handleUpdateSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'QC_PENDING',
          overall_progress: 85,
          qc_inspection_type: 'ONLINE',
        })
      );
    });

    it('F7.2: Fires exact Quick Service toast notification', async () => {
      const user = userEvent.setup();
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(toast.success).toHaveBeenCalledWith(EXPECTED_QUICK_TOAST);
    });

    it('F7.3: Invokes onTabChange with "qc" to navigate to QC inspection tab', async () => {
      const user = userEvent.setup();
      const handleTabChange = vi.fn();
      const job = createQuickJob();

      renderWithProviders(
        <JobActiveWorkspace job={job} onTabChange={handleTabChange} />
      );

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(handleTabChange).toHaveBeenCalledTimes(1);
      expect(handleTabChange).toHaveBeenCalledWith('qc');
    });

    it('F7.4: Navigates to "/qc" route fallback when onTabChange callback is undefined', async () => {
      const user = userEvent.setup();
      const job = createQuickJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/qc');
    });

    it('F7.5: Sets qc_pending_at ISO timestamp in step_timestamps payload', async () => {
      const user = userEvent.setup();
      const handleUpdateSuccess = vi.fn();
      const job = createQuickJob();

      renderWithProviders(
        <JobActiveWorkspace job={job} onUpdateSuccess={handleUpdateSuccess} />
      );

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(handleUpdateSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          step_timestamps: expect.objectContaining({
            qc_pending_at: expect.any(String),
          }),
        })
      );
    });
  });

  /* ------------------------------------------------------------------------
     F8: Renovate Workflow Routing (Renovate -> BOQ)
     ------------------------------------------------------------------------ */
  describe('F8: Renovate Workflow Routing', () => {
    it('F8.1: Fires exact Renovate toast notification', async () => {
      const user = userEvent.setup();
      const job = createRenovateJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(toast.success).toHaveBeenCalledWith(EXPECTED_RENOVATE_TOAST);
    });

    it('F8.2: Invokes onTabChange with "boq" to navigate to Project & BOQ tab', async () => {
      const user = userEvent.setup();
      const handleTabChange = vi.fn();
      const job = createRenovateJob();

      renderWithProviders(
        <JobActiveWorkspace job={job} onTabChange={handleTabChange} />
      );

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(handleTabChange).toHaveBeenCalledTimes(1);
      expect(handleTabChange).toHaveBeenCalledWith('boq');
    });

    it('F8.3: Navigates to "/boq" route fallback when onTabChange callback is undefined', async () => {
      const user = userEvent.setup();
      const job = createRenovateJob();
      renderWithProviders(<JobActiveWorkspace job={job} />);

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/boq');
    });

    it('F8.4: Sets step3_boq_at ISO timestamp in step_timestamps payload', async () => {
      const user = userEvent.setup();
      const handleUpdateSuccess = vi.fn();
      const job = createRenovateJob();

      renderWithProviders(
        <JobActiveWorkspace job={job} onUpdateSuccess={handleUpdateSuccess} />
      );

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(handleUpdateSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          step_timestamps: expect.objectContaining({
            step3_boq_at: expect.any(String),
          }),
        })
      );
    });

    it('F8.5: Appends newly uploaded photos into Renovate payload without overwriting existing photos', async () => {
      const user = userEvent.setup();
      const handleUpdateSuccess = vi.fn();
      const existingPhoto = { slot_id: 'prelim', url: 'https://example.com/prelim.jpg' };
      const job = createRenovateJob({ photos: [existingPhoto] });

      renderWithProviders(
        <JobActiveWorkspace job={job} onUpdateSuccess={handleUpdateSuccess} />
      );

      const fileInputs = document.querySelectorAll('input[type="file"]');
      const file = new File(['renovate-site'], 'site.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInputs[0], { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByAltText('ก่อนเริ่มงาน')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

      expect(handleUpdateSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: expect.arrayContaining([
            expect.objectContaining({ slot_id: 'prelim' }),
            expect.objectContaining({ slot_id: 'before' }),
          ]),
        })
      );
    });
  });
});

/* ==========================================================================
   TIER 2: BOUNDARY & CORNER CASES
   Extreme lengths, empty values, rapid events, missing fields, errors
   ========================================================================== */
describe('Tier 2: Boundary & Corner Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'patch').mockResolvedValue({ success: true, data: {} });
    vi.spyOn(api, 'get').mockResolvedValue({ success: true, data: [] });
  });

  it('B1: Empty and whitespace-only comments cannot trigger quick comment submit', async () => {
    const user = userEvent.setup();
    const job = createQuickJob();
    renderWithProviders(<JobActiveWorkspace job={job} />);

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    const quickCommentBtn = screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i });

    await user.type(textarea, '     ');
    expect(quickCommentBtn).toBeDisabled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('B2: Handles extremely long comments (1,000+ characters) with Unicode & emoji characters without clipping', async () => {
    const user = userEvent.setup();
    const handleUpdateSuccess = vi.fn();
    const job = createQuickJob();
    renderWithProviders(
      <JobActiveWorkspace job={job} onUpdateSuccess={handleUpdateSuccess} />
    );

    const longComment = 'ช่างได้ตรวจสอบระบบไฟฟ้าอย่างละเอียดทุกจุด ⚡🔌 '.repeat(35);
    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');

    fireEvent.change(textarea, { target: { value: longComment } });
    expect(screen.getByText(new RegExp(`ความยาวข้อความ:\\s*${longComment.length}\\s*ตัวอักษร`))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        additional_notes: longComment.trim(),
      })
    );
  });

  it('B3: Handles rapid sequential clicks of all 7 Quick Tags without duplicates or missed tokens', async () => {
    const user = userEvent.setup();
    const job = createQuickJob();
    renderWithProviders(<JobActiveWorkspace job={job} />);

    for (const tag of QUICK_TAGS) {
      await user.click(screen.getByRole('button', { name: tag }));
    }

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า') as HTMLTextAreaElement;
    for (const tag of QUICK_TAGS) {
      expect(textarea.value).toContain(tag);
    }
  });

  it('B4: Handles 0 photos uploaded without error or corrupted payload array', async () => {
    const user = userEvent.setup();
    const handleUpdateSuccess = vi.fn();
    const job = createQuickJob({ photos: [] });

    renderWithProviders(
      <JobActiveWorkspace job={job} onUpdateSuccess={handleUpdateSuccess} />
    );

    await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        photos: [],
      })
    );
  });

  it('B5: Handles all 5 photo slots populated simultaneously with distinct data URLs', async () => {
    const user = userEvent.setup();
    const handleUpdateSuccess = vi.fn();
    const job = createQuickJob();

    renderWithProviders(
      <JobActiveWorkspace job={job} onUpdateSuccess={handleUpdateSuccess} />
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(5);

    for (let i = 0; i < 5; i++) {
      const fakeFile = new File([`data-${i}`], `photo-${i}.png`, { type: 'image/png' });
      fireEvent.change(fileInputs[i], { target: { files: [fakeFile] } });
    }

    await waitFor(() => {
      expect(screen.getByAltText('ก่อนเริ่มงาน')).toBeInTheDocument();
      expect(screen.getByAltText('ระหว่างทำ 1')).toBeInTheDocument();
      expect(screen.getByAltText('ระหว่างทำ 2')).toBeInTheDocument();
      expect(screen.getByAltText('ทดสอบระบบ')).toBeInTheDocument();
      expect(screen.getByAltText('หลังเสร็จสิ้น')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        photos: expect.arrayContaining([
          expect.objectContaining({ slot_id: 'before' }),
          expect.objectContaining({ slot_id: 'progress1' }),
          expect.objectContaining({ slot_id: 'progress2' }),
          expect.objectContaining({ slot_id: 'test' }),
          expect.objectContaining({ slot_id: 'after' }),
        ]),
      })
    );
  });

  it('B6: Dismissing Lightbox with Escape does not interfere with textarea form state', async () => {
    const user = userEvent.setup();
    const job = createQuickJob({
      photos: [{ slot_id: 'test', url: 'https://example.com/test-modal.jpg' }],
    });
    renderWithProviders(<JobActiveWorkspace job={job} />);

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    await user.type(textarea, 'ข้อความก่อนเปิดรูป');

    const testImg = screen.getByAltText('ทดสอบระบบ');
    const zoomBtn = within(testImg.parentElement!).getByRole('button');
    await user.click(zoomBtn);

    await waitFor(() => {
      expect(screen.getByAltText('Preview')).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    });

    expect(textarea).toHaveValue('ข้อความก่อนเปิดรูป');
  });

  it('B7: Gracefully renders when job has undefined, null, or empty optional fields', () => {
    const bareJob: Job = {
      id: 999,
      job_no: 'JOB-BARE',
      customer: 'ลูกค้าทั่วไป',
      status: 'IN_PROGRESS',
      project_type: 'Quick Service',
      services: [],
      property_type: 'อาคารพาณิชย์',
      overall_progress: 0,
      grand_total: 0,
      created_at: '2026-09-26T00:00:00.000Z',
      updated_at: '2026-09-26T00:00:00.000Z',
      tasks: undefined,
      photos: undefined,
      daily_logs: undefined,
      step_timestamps: undefined,
      assigned_tech: undefined,
    };

    expect(() => {
      renderWithProviders(<JobActiveWorkspace job={bareJob} />);
    }).not.toThrow();

    expect(screen.getByText('ช่างหน้างาน')).toBeInTheDocument();
    expect(screen.getByText('⚡ งานด่วน (Quick Service)')).toBeInTheDocument();
  });

  it('B8: Backend API failure is caught gracefully without breaking UI flow or crashing', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'patch').mockRejectedValueOnce(new Error('Internal Server Error 500'));

    const handleTabChange = vi.fn();
    const job = createQuickJob();

    renderWithProviders(
      <JobActiveWorkspace job={job} onTabChange={handleTabChange} />
    );

    await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

    expect(handleTabChange).toHaveBeenCalledWith('qc');
    expect(toast.success).toHaveBeenCalledWith(EXPECTED_QUICK_TOAST);
  });
});

/* ==========================================================================
   TIER 3: CROSS-FEATURE INTERACTIONS
   Compound user workflows combining multiple features in sequence
   ========================================================================== */
describe('Tier 3: Cross-Feature Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'patch').mockResolvedValue({ success: true, data: {} });
    vi.spyOn(api, 'get').mockResolvedValue({ success: true, data: [] });
  });

  it('C1: Staged photo + Quick Tag + Quick Comment followed by additional photos and Primary Update', async () => {
    const user = userEvent.setup();
    const handleTabChange = vi.fn();
    const handleUpdateSuccess = vi.fn();
    const job = createQuickJob();

    renderWithProviders(
      <JobActiveWorkspace
        job={job}
        onTabChange={handleTabChange}
        onUpdateSuccess={handleUpdateSuccess}
      />
    );

    // 1. Stage Before photo (slot 0)
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const beforeFile = new File(['before-data'], 'before.png', { type: 'image/png' });
    fireEvent.change(fileInputs[0], { target: { files: [beforeFile] } });

    await waitFor(() => {
      expect(screen.getByAltText('ก่อนเริ่มงาน')).toBeInTheDocument();
    });

    // 2. Click Quick Tag "👍 เข้าหน้างานแล้ว" and post quick comment
    await user.click(screen.getByRole('button', { name: '👍 เข้าหน้างานแล้ว' }));
    await user.click(screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i }));

    await waitFor(() => {
      const timeline = screen.getByText('ประวัติกิจกรรมหน้างาน (Activity Timeline)').closest('section')!;
      expect(within(timeline).getByText('👍 เข้าหน้างานแล้ว')).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith('ส่งคอมเมนต์ด่วนเรียบร้อยแล้ว');
    });

    // 3. Stage After photo (slot 4)
    const afterFile = new File(['after-data'], 'after.png', { type: 'image/png' });
    fireEvent.change(fileInputs[4], { target: { files: [afterFile] } });

    await waitFor(() => {
      expect(screen.getByAltText('หลังเสร็จสิ้น')).toBeInTheDocument();
    });

    // 4. Append final note and execute primary Update
    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    await user.type(textarea, 'งานเสร็จเรียบร้อย 100% พร้อมตรวจ QC');
    await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

    // 5. Verify workflow state transitions
    expect(toast.success).toHaveBeenCalledWith(EXPECTED_QUICK_TOAST);
    expect(handleTabChange).toHaveBeenCalledWith('qc');
    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'QC_PENDING',
        overall_progress: 85,
        photos: expect.arrayContaining([
          expect.objectContaining({ slot_id: 'before' }),
          expect.objectContaining({ slot_id: 'after' }),
        ]),
      })
    );
  });

  it('C2: Dynamic workspace re-rendering when job prop switches from Quick Service to Renovate', () => {
    const quickJob = createQuickJob();
    const { rerender } = renderWithProviders(<JobActiveWorkspace job={quickJob} />);

    expect(screen.getByText('⚡ งานด่วน (Quick Service)')).toBeInTheDocument();

    const renovateJob = createRenovateJob();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <JobActiveWorkspace job={renovateJob} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('🏗️ งานรีโนเวท (Renovate)')).toBeInTheDocument();
    expect(screen.queryByText('⚡ งานด่วน (Quick Service)')).not.toBeInTheDocument();
  });
});

/* ==========================================================================
   TIER 4: REAL-WORLD WORKLOAD SCENARIOS
   Full end-to-end operational scenarios simulating realistic technician behavior
   ========================================================================== */
describe('Tier 4: Real-World Workload Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'patch').mockResolvedValue({ success: true, data: {} });
    vi.spyOn(api, 'get').mockResolvedValue({ success: true, data: [] });
  });

  it('S1: Complete on-site technician Quick Service repair, multi-photo logging, and QC handover', async () => {
    const user = userEvent.setup();
    const handleTabChange = vi.fn();
    const handleUpdateSuccess = vi.fn();

    const technicianJob = createQuickJob({
      id: 555,
      job_no: 'JOB-2026-REAL-Q1',
      assigned_tech: 'ช่างวีระศักดิ์ มั่นคง',
      overall_progress: 20,
    });

    renderWithProviders(
      <JobActiveWorkspace
        job={technicianJob}
        onTabChange={handleTabChange}
        onUpdateSuccess={handleUpdateSuccess}
      />
    );

    // Step A: Technician arrives on site -> Check-in comment
    await user.click(screen.getByRole('button', { name: '👍 เข้าหน้างานแล้ว' }));
    await user.click(screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i }));

    await waitFor(() => {
      const timeline = screen.getByText('ประวัติกิจกรรมหน้างาน (Activity Timeline)').closest('section')!;
      expect(within(timeline).getByText('👍 เข้าหน้างานแล้ว')).toBeInTheDocument();
    });

    // Step B: Progressive photo upload during inspection
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const photoBefore = new File(['b-content'], 'site-before.jpg', { type: 'image/jpeg' });
    const photoProg1 = new File(['p1-content'], 'site-progress1.jpg', { type: 'image/jpeg' });
    const photoTest = new File(['t-content'], 'site-test.jpg', { type: 'image/jpeg' });
    const photoAfter = new File(['a-content'], 'site-after.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInputs[0], { target: { files: [photoBefore] } });
    fireEvent.change(fileInputs[1], { target: { files: [photoProg1] } });
    fireEvent.change(fileInputs[3], { target: { files: [photoTest] } });
    fireEvent.change(fileInputs[4], { target: { files: [photoAfter] } });

    await waitFor(() => {
      expect(screen.getByAltText('ก่อนเริ่มงาน')).toBeInTheDocument();
      expect(screen.getByAltText('ระหว่างทำ 1')).toBeInTheDocument();
      expect(screen.getByAltText('ทดสอบระบบ')).toBeInTheDocument();
      expect(screen.getByAltText('หลังเสร็จสิ้น')).toBeInTheDocument();
    });

    // Step C: Technician verifies thumbnail preview in Lightbox
    const beforeImg = screen.getByAltText('ก่อนเริ่มงาน');
    const zoomBtn = within(beforeImg.parentElement!).getByRole('button');
    await user.click(zoomBtn);

    await waitFor(() => {
      expect(screen.getByAltText('Preview')).toBeInTheDocument();
    });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    });

    // Step D: Final completion report
    await user.click(screen.getByRole('button', { name: '✨ ติดตั้งเสร็จ 100%' }));
    await user.click(screen.getByRole('button', { name: '🔌 ทดสอบระบบผ่าน' }));
    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    await user.type(textarea, ' ล้างแอร์และวัดแรงดันน้ำยาปกติ 140 PSI ส่งตรวจ QC');

    // Step E: Advance workflow
    await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

    // Verifications
    expect(toast.success).toHaveBeenCalledWith(EXPECTED_QUICK_TOAST);
    expect(handleTabChange).toHaveBeenCalledWith('qc');
    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'QC_PENDING',
        overall_progress: 85,
        qc_inspection_type: 'ONLINE',
        step_timestamps: expect.objectContaining({
          qc_pending_at: expect.any(String),
        }),
      })
    );
  });

  it('S2: Complete Renovate site survey and BOQ preparation handover flow', async () => {
    const user = userEvent.setup();
    const handleTabChange = vi.fn();
    const handleUpdateSuccess = vi.fn();

    const surveyJob = createRenovateJob({
      id: 666,
      job_no: 'JOB-2026-REAL-R1',
      assigned_tech: 'วิศวกรสำรวจ อนุวัฒน์',
    });

    renderWithProviders(
      <JobActiveWorkspace
        job={surveyJob}
        onTabChange={handleTabChange}
        onUpdateSuccess={handleUpdateSuccess}
      />
    );

    // Initial check
    expect(screen.getByText('🏗️ งานรีโนเวท (Renovate)')).toBeInTheDocument();

    // Stage site survey photos
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const photoBefore = new File(['survey-before'], 'survey1.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInputs[0], { target: { files: [photoBefore] } });

    await waitFor(() => {
      expect(screen.getByAltText('ก่อนเริ่มงาน')).toBeInTheDocument();
    });

    // Enter survey report
    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    await user.type(
      textarea,
      'สำรวจพื้นที่อาคารชั้น 1-2 เรียบร้อย โครงสร้างเดิมแข็งแรง ส่งข้อมูลเพื่อประเมินราคา BOQ'
    );

    // Execute update
    await user.click(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i }));

    // Verifications
    expect(toast.success).toHaveBeenCalledWith(EXPECTED_RENOVATE_TOAST);
    expect(handleTabChange).toHaveBeenCalledWith('boq');
    expect(handleUpdateSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        step_timestamps: expect.objectContaining({
          step3_boq_at: expect.any(String),
        }),
        additional_notes: expect.stringContaining('ประเมินราคา BOQ'),
      })
    );
  });
});
