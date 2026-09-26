import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  JobActiveWorkspace,
  QUICK_TAGS,
} from '../job-active-workspace';
import { PhotoSlots5, PhotoSlot } from '@/components/ui/photo-slots-5';
import { JobDetailTabs } from '../job-detail-tabs';
import { Job } from '../api';
import { api } from '@/lib/api';
import { format24HourTimeBadge } from '@/lib/date';

// Mock sonner toast
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
  readAsDataURL(file: Blob) {
    this.result = `data:${file.type || 'application/octet-stream'};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
    setTimeout(() => {
      this.onload?.();
    }, 10);
  }
}
window.FileReader = MockFileReader as any;

const baseJob: Job = {
  id: 801,
  job_no: 'JOB-2026-CHALLENGE-01',
  booking_no: 'BK-CHAL01',
  external_ref_id: 'REF-CHAL01',
  property_type: 'บ้านเดี่ยว 2 ชั้น',
  customer: {
    name: 'กิตติศักดิ์ เจริญผล',
    phone: '0819998888',
    address: 'ลาดพร้าว 71',
  },
  status: 'IN_PROGRESS',
  project_type: 'Quick Service',
  services: ['ติดตั้งระบบระบายอากาศ'],
  assigned_tech: 'ช่างธีระ',
  overall_progress: 30,
  grand_total: 3200,
  created_at: '2026-09-22T08:30:00.000Z',
  updated_at: '2026-09-22T08:30:00.000Z',
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

/* ==========================================================================
   MISSION 1: PhotoSlots 5 Adversarial & Boundary Tests
   - Invalid formats, empty uploads, Lightbox open/close, multiple thumbnails
   ========================================================================== */
describe('Mission 1: PhotoSlots 5 Adversarial & Boundary Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles empty file input selection (files: []) without throwing or modifying state', () => {
    const handleUpload = vi.fn();
    render(<PhotoSlots5 onUpload={handleUpload} />);

    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(5);

    // Simulate user opening file picker and clicking "Cancel" (files: [])
    fireEvent.change(fileInputs[0], { target: { files: [] } });

    // onUpload should NOT be called
    expect(handleUpload).not.toHaveBeenCalled();

    // All slots remain in unuploaded state (showing "อัพโหลดรูป")
    const uploadLabels = screen.getAllByText('อัพโหลดรูป');
    expect(uploadLabels.length).toBe(5);
  });

  it('handles non-image / invalid file formats without runtime exceptions in JobActiveWorkspace', async () => {
    renderWithProviders(<JobActiveWorkspace job={baseJob} />);

    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(5);

    // Upload a text/plain or binary file
    const invalidFile = new File(['plain text data'], 'report.txt', { type: 'text/plain' });
    fireEvent.change(fileInputs[0], { target: { files: [invalidFile] } });

    // Component must not crash; FileReader converts to dataUrl and thumbnail displays
    await waitFor(() => {
      const img = screen.getByAltText('ก่อนเริ่มงาน');
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toContain('data:text/plain;base64');
    });
  });

  it('correctly displays multiple thumbnails independently across different slots', async () => {
    renderWithProviders(<JobActiveWorkspace job={baseJob} />);

    const fileInputs = document.querySelectorAll('input[type="file"]');

    // Upload to Slot 0 (ก่อนเริ่มงาน) and Slot 4 (หลังเสร็จสิ้น)
    const file1 = new File(['img1'], 'before.jpg', { type: 'image/jpeg' });
    const file5 = new File(['img5'], 'after.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInputs[0], { target: { files: [file1] } });
    fireEvent.change(fileInputs[4], { target: { files: [file5] } });

    // Slots 0 and 4 show thumbnails
    await waitFor(() => {
      expect(screen.getByAltText('ก่อนเริ่มงาน')).toBeInTheDocument();
      expect(screen.getByAltText('หลังเสร็จสิ้น')).toBeInTheDocument();
    });

    // Slots 1, 2, 3 must still show "อัพโหลดรูป"
    const uploadLabels = screen.getAllByText('อัพโหลดรูป');
    expect(uploadLabels.length).toBe(3);
  });

  it('properly initializes existing photos from job.photos into the respective slots', () => {
    const jobWithPhotos: Job = {
      ...baseJob,
      photos: [
        { slot_id: 'before', url: 'https://example.com/before.jpg' },
        { slot_id: 'test', url: 'https://example.com/test.jpg' },
      ],
    } as any;

    renderWithProviders(<JobActiveWorkspace job={jobWithPhotos} />);

    // Slot 0 (ก่อนเริ่มงาน) and Slot 3 (ทดสอบระบบ) should render images
    expect(screen.getByAltText('ก่อนเริ่มงาน')).toHaveAttribute('src', 'https://example.com/before.jpg');
    expect(screen.getByAltText('ทดสอบระบบ')).toHaveAttribute('src', 'https://example.com/test.jpg');

    // Remaining 3 slots should be upload prompts
    const uploadLabels = screen.getAllByText('อัพโหลดรูป');
    expect(uploadLabels.length).toBe(3);
  });

  it('supports Lightbox open and close interactions for PhotoSlots 5', async () => {
    const user = userEvent.setup();
    const testSlots: PhotoSlot[] = [
      { id: 'before', label: 'ก่อนเริ่มงาน', url: 'https://example.com/lightbox-test.jpg' },
      { id: 'progress1', label: 'ระหว่างทำ 1' },
      { id: 'progress2', label: 'ระหว่างทำ 2' },
      { id: 'test', label: 'ทดสอบระบบ' },
      { id: 'after', label: 'หลังเสร็จสิ้น' },
    ];

    render(<PhotoSlots5 slots={testSlots} />);

    // Ensure preview image is not in document initially
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();

    // Click maximize button on slot 0
    const maximizeBtn = screen.getByRole('button');
    await user.click(maximizeBtn);

    // Lightbox modal should be opened displaying Preview image
    await waitFor(() => {
      const previewImg = screen.getByAltText('Preview');
      expect(previewImg).toBeInTheDocument();
      expect(previewImg).toHaveAttribute('src', 'https://example.com/lightbox-test.jpg');
    });

    // Press Escape to close Dialog
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    // Lightbox should close
    await waitFor(() => {
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    });
  });

  it('supports Lightbox open and close interactions for Timeline photo thumbnails', async () => {
    const user = userEvent.setup();
    const jobWithTimelinePhoto: Job = {
      ...baseJob,
      remarks_data: {
        activities: [
          {
            id: 'act-media-1',
            author: 'ช่างธีระ',
            text: 'ตรวจสอบสภาพเครื่องเดิมก่อนรื้อถอน',
            timestamp: '2026-09-22T09:00:00.000Z',
            photos: [
              { id: 'p1', url: 'https://example.com/timeline-photo-1.jpg', label: 'รูปจุดติดตั้ง' },
            ],
          },
        ],
      },
    } as any;

    renderWithProviders(<JobActiveWorkspace job={jobWithTimelinePhoto} />);

    // Ensure timeline photo preview is not open
    expect(screen.queryByAltText('Timeline Preview')).not.toBeInTheDocument();

    // Find and click the timeline thumbnail
    const thumb = screen.getByTitle('คลิกเพื่อดูรูปขนาดเต็ม');
    await user.click(thumb);

    // Timeline Lightbox Dialog should open
    await waitFor(() => {
      const timelineImg = screen.getByAltText('Timeline Preview');
      expect(timelineImg).toBeInTheDocument();
      expect(timelineImg).toHaveAttribute('src', 'https://example.com/timeline-photo-1.jpg');
    });

    // Press Escape to close Dialog
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    // Dialog closes
    await waitFor(() => {
      expect(screen.queryByAltText('Timeline Preview')).not.toBeInTheDocument();
    });
  });
});

/* ==========================================================================
   MISSION 2: Quick Tags Adversarial Tests
   - Concatenation with existing text, empty textarea click, special characters
   ========================================================================== */
describe('Mission 2: Quick Tags Adversarial Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'patch').mockResolvedValue({ success: true, data: {} });
  });

  it('sets exact tag text without leading/trailing space when textarea is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobActiveWorkspace job={baseJob} />);

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    expect(textarea).toHaveValue('');

    // Click each quick tag on a clean slate and verify exact value
    for (let i = 0; i < QUICK_TAGS.length; i++) {
      const tag = QUICK_TAGS[i];
      // Reset textarea
      await user.clear(textarea);
      expect(textarea).toHaveValue('');

      await user.click(screen.getByRole('button', { name: tag }));
      expect(textarea).toHaveValue(tag);
      expect((textarea as HTMLTextAreaElement).value.startsWith(' ')).toBe(false);
      expect((textarea as HTMLTextAreaElement).value.endsWith(' ')).toBe(false);
    }
  });

  it('cleanly concatenates tag with existing text using a single space', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobActiveWorkspace job={baseJob} />);

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    await user.type(textarea, 'เริ่มงานช่วงเช้า');

    // Click quick tag
    await user.click(screen.getByRole('button', { name: '⚡ เริ่มดำเนินการ' }));
    expect(textarea).toHaveValue('เริ่มงานช่วงเช้า ⚡ เริ่มดำเนินการ');
  });

  it('normalizes trailing whitespace and newlines before appending tag', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobActiveWorkspace job={baseJob} />);

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    // Simulate user leaving trailing spaces or newlines
    fireEvent.change(textarea, { target: { value: 'งานซ่อมส่วนที่ 1    \n   ' } });

    await user.click(screen.getByRole('button', { name: '✨ ติดตั้งเสร็จ 100%' }));

    // Should trim existing text and append with single space (no duplicate whitespace)
    expect(textarea).toHaveValue('งานซ่อมส่วนที่ 1 ✨ ติดตั้งเสร็จ 100%');
  });

  it('safely handles special characters, quotes, symbols and HTML in comment and renders cleanly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobActiveWorkspace job={baseJob} />);

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');
    const complexText = `Test special symbols: <script>alert("XSS")</script> & 'single' "double" % * (100%) / \\`;
    
    fireEvent.change(textarea, { target: { value: complexText } });
    await user.click(screen.getByRole('button', { name: '⚠️ มีจุดแก้ไข' }));

    const expectedValue = `${complexText} ⚠️ มีจุดแก้ไข`;
    expect(textarea).toHaveValue(expectedValue);

    // Submit quick comment
    const quickSubmitBtn = screen.getByRole('button', { name: /ส่งคอมเมนต์ด่วน/i });
    await user.click(quickSubmitBtn);

    // Verify it renders safely in timeline without breaking DOM
    await waitFor(() => {
      expect(screen.getByText(expectedValue)).toBeInTheDocument();
    });
  });

  it('supports sequential multi-tag chaining', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobActiveWorkspace job={baseJob} />);

    const textarea = screen.getByLabelText('บันทึกความคืบหน้า');

    await user.click(screen.getByRole('button', { name: '👍 เข้าหน้างานแล้ว' }));
    await user.click(screen.getByRole('button', { name: '⚡ เริ่มดำเนินการ' }));
    await user.click(screen.getByRole('button', { name: '🔌 ทดสอบระบบผ่าน' }));

    expect(textarea).toHaveValue('👍 เข้าหน้างานแล้ว ⚡ เริ่มดำเนินการ 🔌 ทดสอบระบบผ่าน');
  });
});

/* ==========================================================================
   MISSION 3: Date & Time Formatting Adversarial Tests
   - format24HourTimeBadge never leaks AM/PM, timeline items 100% 24h format
   ========================================================================== */
describe('Mission 3: Date & Time Formatting Adversarial Tests', () => {
  describe('format24HourTimeBadge Unit Edge Cases', () => {
    const amPmEdgeCases = [
      { input: '08:00 AM', expected: '08:00 น.' },
      { input: '8:30 am', expected: '08:30 น.' },
      { input: '11:45 AM', expected: '11:45 น.' },
      { input: '12:00 AM', expected: '00:00 น.' }, // Midnight edge case
      { input: '12:15 AM', expected: '00:15 น.' },
      { input: '12:00 PM', expected: '12:00 น.' }, // Noon edge case
      { input: '12:59 PM', expected: '12:59 น.' },
      { input: '01:00 PM', expected: '13:00 น.' },
      { input: '1:30 pm', expected: '13:30 น.' },
      { input: '09:00 PM', expected: '21:00 น.' },
      { input: '11:59 pm', expected: '23:59 น.' },
      { input: '07.30 AM', expected: '07:30 น.' }, // Dot notation
      { input: '02.45 PM', expected: '14:45 น.' }, // Dot notation
    ];

    amPmEdgeCases.forEach(({ input, expected }) => {
      it(`converts 12-hour AM/PM string "${input}" to pure 24-hour "${expected}"`, () => {
        const result = format24HourTimeBadge(input);
        expect(result).toBe(expected);
        expect(result.toLowerCase()).not.toContain('am');
        expect(result.toLowerCase()).not.toContain('pm');
      });
    });

    const rangeEdgeCases = [
      { input: '08:30 - 17:00', expected: '08:30 - 17:00 น.' },
      { input: '09.00 - 12.00', expected: '09:00 - 12:00 น.' },
      { input: '13:00-15:30', expected: '13:00 - 15:30 น.' },
      { input: '9:00 - 12:00', expected: '09:00 - 12:00 น.' },
    ];

    rangeEdgeCases.forEach(({ input, expected }) => {
      it(`converts range string "${input}" to 24-hour format "${expected}"`, () => {
        const result = format24HourTimeBadge(input);
        expect(result).toBe(expected);
        expect(result).toMatch(/^\d{2}:\d{2} - \d{2}:\d{2} น\.$/);
      });
    });

    const thaiPresetCases = [
      { input: 'เช้า', expected: '09:00 น.' },
      { input: 'ช่วงเช้า 09:00', expected: '09:00 น.' },
      { input: 'บ่าย', expected: '13:00 น.' },
      { input: 'รอบบ่าย', expected: '13:00 น.' },
      { input: 'เย็น', expected: '17:00 น.' },
    ];

    thaiPresetCases.forEach(({ input, expected }) => {
      it(`maps Thai time preset "${input}" to "${expected}"`, () => {
        expect(format24HourTimeBadge(input)).toBe(expected);
      });
    });

    it('falls back to default "09:00 น." when input is null, empty string, or undefined', () => {
      expect(format24HourTimeBadge(null)).toBe('09:00 น.');
      expect(format24HourTimeBadge('')).toBe('09:00 น.');
      expect(format24HourTimeBadge(undefined)).toBe('09:00 น.');
      expect(format24HourTimeBadge('   ')).toBe('09:00 น.');
    });

    it('extracts 24-hour time from Date object when timeInput is empty', () => {
      const dateObj = new Date(2026, 8, 25, 16, 45, 0); // 16:45
      const result = format24HourTimeBadge('', dateObj);
      expect(result).toBe('16:45 น.');
    });
  });

  describe('Timeline Component 24h & Date Rendering', () => {
    it('renders timeline badges strictly in 24-hour format with zero AM/PM across varied activities', () => {
      const jobWithVariedTimes: Job = {
        ...baseJob,
        remarks_data: {
          activities: [
            {
              id: 'act-1',
              author: 'ช่างเอ',
              text: 'งานรอบเช้า',
              timestamp: '2026-09-25T01:30:00.000Z',
              time: '08:30 AM',
            },
            {
              id: 'act-2',
              author: 'ช่างบี',
              text: 'งานรอบเที่ยง',
              timestamp: '2026-09-25T05:00:00.000Z',
              time: '12:00 PM',
            },
            {
              id: 'act-3',
              author: 'ช่างซี',
              text: 'งานรอบบ่าย',
              timestamp: '2026-09-25T07:45:00.000Z',
              time: '02:45 pm',
            },
            {
              id: 'act-4',
              author: 'ช่างดี',
              text: 'งานรอบค่ำ',
              timestamp: '2026-09-25T14:15:00.000Z',
              time: '21:15',
            },
          ],
        },
      } as any;

      const { container } = renderWithProviders(<JobActiveWorkspace job={jobWithVariedTimes} />);

      // Verify all 4 time badges
      expect(screen.getByText('08:30 น.')).toBeInTheDocument();
      expect(screen.getByText('12:00 น.')).toBeInTheDocument();
      expect(screen.getByText('14:45 น.')).toBeInTheDocument();
      expect(screen.getByText('21:15 น.')).toBeInTheDocument();

      // Check entire container text: NO AM/PM anywhere
      const allText = container.textContent || '';
      expect(allText).not.toMatch(/\bAM\b/i);
      expect(allText).not.toMatch(/\bPM\b/i);

      // Verify date format in DD/MM/YYYY
      expect(screen.getAllByText('25/09/2026').length).toBeGreaterThanOrEqual(4);
    });
  });
});

/* ==========================================================================
   MISSION 4: Empty State Replacement in Tab 1
   - Verify that when tasksData is empty [], no "ไม่มีข้อมูล" text or inbox icon exists
   ========================================================================== */
describe('Mission 4: Empty State Replacement in Tab 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({ success: true, data: [] });
  });

  it('strictly guarantees no "ไม่มีข้อมูล" text or Lucide Inbox icon exists in Tab 1 when tasks is empty []', () => {
    const emptyTasksJob: Job = {
      ...baseJob,
      tasks: [],
    };

    renderWithProviders(<JobDetailTabs job={emptyTasksJob} />);

    // 1. Assert "ไม่มีข้อมูล" text does NOT exist anywhere in the document
    expect(screen.queryByText('ไม่มีข้อมูล')).not.toBeInTheDocument();
    expect(screen.queryByText(/ไม่มีข้อมูล/i)).not.toBeInTheDocument();

    // 2. Assert Lucide Inbox icon does NOT exist in the DOM
    const inboxIcon = document.querySelector('svg.lucide-inbox');
    expect(inboxIcon).toBeNull();

    // 3. Assert Active Workspace is mounted directly in Tab 1
    expect(
      screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('รูปถ่ายการปฏิบัติงาน 5 ขั้นตอน (PhotoSlots 5)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('ประวัติกิจกรรมหน้างาน (Activity Timeline)')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i })).toBeInTheDocument();
  });

  it('guarantees no empty state when tasks is null or undefined on job object', () => {
    const nullTasksJob: Job = {
      ...baseJob,
      tasks: undefined,
    };

    renderWithProviders(<JobDetailTabs job={nullTasksJob} />);

    expect(screen.queryByText('ไม่มีข้อมูล')).not.toBeInTheDocument();
    expect(document.querySelector('svg.lucide-inbox')).toBeNull();
    expect(
      screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
    ).toBeInTheDocument();
  });

  it('allows smooth toggling between Active Workspace and Task List when tasks exist', async () => {
    const user = userEvent.setup();
    const jobWithTasks: Job = {
      ...baseJob,
      tasks: [
        { id: 1, task_name: 'สำรวจระบบไฟฟ้าเดิม', name: 'สำรวจระบบไฟฟ้าเดิม', status: 'COMPLETED', sequence: 1 },
        { id: 2, task_name: 'ติดตั้งตู้เมนสวิตช์', name: 'ติดตั้งตู้เมนสวิตช์', status: 'IN_PROGRESS', sequence: 2 },
      ] as any,
    };

    vi.spyOn(api, 'get').mockResolvedValue({ success: true, data: jobWithTasks.tasks });

    renderWithProviders(<JobDetailTabs job={jobWithTasks} />);

    // In Tab 1, toggle buttons should be visible
    const workspaceToggleBtn = screen.getByRole('button', {
      name: /พื้นที่ทำงาน & รูปภาพ \(Active Workspace\)/i,
    });
    const tasksToggleBtn = screen.getByRole('button', {
      name: /รายการงานย่อย \(2\)/i,
    });

    expect(workspaceToggleBtn).toBeInTheDocument();
    expect(tasksToggleBtn).toBeInTheDocument();

    // Initial view is Active Workspace
    expect(
      screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
    ).toBeInTheDocument();

    // Switch to Task List view
    await user.click(tasksToggleBtn);

    // Active workspace is replaced by Task DataGrid
    await waitFor(() => {
      expect(
        screen.queryByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
      ).not.toBeInTheDocument();
      expect(screen.getByText('สำรวจระบบไฟฟ้าเดิม')).toBeInTheDocument();
      expect(screen.getByText('ติดตั้งตู้เมนสวิตช์')).toBeInTheDocument();
    });

    // Switch back to Active Workspace
    await user.click(workspaceToggleBtn);
    await waitFor(() => {
      expect(
        screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)')
      ).toBeInTheDocument();
    });
  });
});
