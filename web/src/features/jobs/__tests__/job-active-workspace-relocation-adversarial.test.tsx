import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JobActiveWorkspace } from '../job-active-workspace';
import { Job } from '../api';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockJobWithPhotos: Job = {
  id: 950,
  job_no: 'JOB-2026-CHALLENGE-PHOTOS',
  booking_no: 'BK-CP950',
  external_ref_id: 'REF-CP950',
  property_type: 'ทาวน์โฮม 3 ชั้น',
  customer: {
    name: 'สุรชัย ตั้งใจดี',
    phone: '0812345678',
    address: 'บางใหญ่ นนทบุรี',
  },
  status: 'IN_PROGRESS',
  project_type: 'Quick Service',
  services: ['ติดตั้งเครื่องทำน้ำร้อน'],
  assigned_tech: 'ช่างสมชาย',
  overall_progress: 40,
  grand_total: 4500,
  created_at: '2026-09-26T08:00:00.000Z',
  updated_at: '2026-09-26T08:00:00.000Z',
  photos: [
    { slot_id: 'before', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a', tag: 'before' },
    { slot_id: 'after', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f', tag: 'after' },
  ],
  remarks_data: {
    activities: [
      {
        id: 'act-sample-1',
        author: 'ช่างสมชาย',
        text: 'เริ่มตรวจสอบจุดติดตั้งเดิมก่อนรื้อถอน',
        timestamp: '2026-09-26T08:30:00.000Z',
        time: '08:30',
        photos: [
          { id: 'act-p1', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758', label: 'หน้างานก่อนทำ' },
        ],
      },
    ],
  },
} as any;

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

describe('JobActiveWorkspace - PhotoSlots 5 Relocation & Layout Adversarial Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* --------------------------------------------------------------------------
     1. DOM ORDER VERIFICATION: Comments -> Activity Timeline -> PhotoSlots 5 -> Sticky Action Bar
     -------------------------------------------------------------------------- */
  it('strictly places PhotoSlots 5 below Activity Timeline and above Sticky Action Bar in DOM', () => {
    renderWithProviders(<JobActiveWorkspace job={mockJobWithPhotos} />);

    const commentsHeading = screen.getByText('บันทึกความคืบหน้า & ความคิดเห็นหน้างาน (Progress Notes & Comments)');
    const timelineHeading = screen.getByText('ประวัติกิจกรรมหน้างาน (Activity Timeline)');
    const photosHeading = screen.getByText('รูปถ่ายการปฏิบัติงาน 5 ขั้นตอน (PhotoSlots 5)');
    const updateButton = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });

    expect(commentsHeading).toBeInTheDocument();
    expect(timelineHeading).toBeInTheDocument();
    expect(photosHeading).toBeInTheDocument();
    expect(updateButton).toBeInTheDocument();

    const commentsSection = commentsHeading.closest('section');
    const timelineSection = timelineHeading.closest('section');
    const photosSection = photosHeading.closest('section');
    const stickyBar = updateButton.closest('.sticky');

    expect(commentsSection).not.toBeNull();
    expect(timelineSection).not.toBeNull();
    expect(photosSection).not.toBeNull();
    expect(stickyBar).not.toBeNull();

    // 1. Comments is followed by Timeline
    const posCommentsToTimeline = commentsSection!.compareDocumentPosition(timelineSection!);
    expect(posCommentsToTimeline & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 2. Timeline is followed by PhotoSlots 5
    const posTimelineToPhotos = timelineSection!.compareDocumentPosition(photosSection!);
    expect(posTimelineToPhotos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 3. PhotoSlots 5 is followed by Sticky Action Bar
    const posPhotosToSticky = photosSection!.compareDocumentPosition(stickyBar!);
    expect(posPhotosToSticky & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /* --------------------------------------------------------------------------
     2. STICKY BOTTOM ACTION BAR STYLING & Z-INDEX ISOLATION
     -------------------------------------------------------------------------- */
  it('configures Sticky Bottom Action Bar with sticky bottom-0 z-20 and opaque white background', () => {
    renderWithProviders(<JobActiveWorkspace job={mockJobWithPhotos} />);

    const updateButton = screen.getByRole('button', { name: /อัปเดตและบันทึกข้อมูล/i });
    const stickyBar = updateButton.closest('.sticky');

    expect(stickyBar).toHaveClass('sticky');
    expect(stickyBar).toHaveClass('bottom-0');
    expect(stickyBar).toHaveClass('z-20');
    expect(stickyBar).toHaveClass('bg-white');
    expect(stickyBar).toHaveClass('border-t');
    expect(stickyBar).toHaveClass('border-gray-200');

    // Sticky action bar contains workflow type badge
    expect(screen.getByText(/⚡ งานด่วน \(Quick Service\)/)).toBeInTheDocument();
  });

  /* --------------------------------------------------------------------------
     3. THUMBNAIL PREVIEWS & LIGHTBOX MODAL IN PHOTOSLOTS 5
     -------------------------------------------------------------------------- */
  it('renders thumbnail previews for preloaded slots and opens Lightbox modal on maximize click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobActiveWorkspace job={mockJobWithPhotos} />);

    // Slot 0 (ก่อนเริ่มงาน) has an image
    const beforeImg = screen.getByAltText('ก่อนเริ่มงาน');
    expect(beforeImg).toBeInTheDocument();
    expect(beforeImg).toHaveAttribute('src', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a');
    expect(beforeImg).toHaveClass('object-cover');

    // Slot 4 (หลังเสร็จสิ้น) has an image
    const afterImg = screen.getByAltText('หลังเสร็จสิ้น');
    expect(afterImg).toBeInTheDocument();
    expect(afterImg).toHaveAttribute('src', 'https://images.unsplash.com/photo-1513694203232-719a280e022f');
    expect(afterImg).toHaveClass('object-cover');

    // Slots 1, 2, 3 should have upload prompts ("อัพโหลดรูป")
    const uploadLabels = screen.getAllByText('อัพโหลดรูป');
    expect(uploadLabels.length).toBe(3);

    // Click maximize button on slot 0
    const beforeCard = beforeImg.closest('div');
    const maximizeBtn = beforeCard!.querySelector('button');
    expect(maximizeBtn).not.toBeNull();

    await user.click(maximizeBtn!);

    // Lightbox modal opens
    await waitFor(() => {
      const previewImg = screen.getByAltText('Preview');
      expect(previewImg).toBeInTheDocument();
      expect(previewImg).toHaveAttribute('src', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a');
    });

    // Close modal via Escape
    const dialogElement = screen.getByRole('dialog');
    fireEvent.keyDown(dialogElement, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
     4. TIMELINE PHOTO LIGHTBOX ISOLATION
     -------------------------------------------------------------------------- */
  it('allows clicking timeline photo thumbnail to open timeline Lightbox dialog independently', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobActiveWorkspace job={mockJobWithPhotos} />);

    const timelineThumb = screen.getByTitle('คลิกเพื่อดูรูปขนาดเต็ม');
    expect(timelineThumb).toBeInTheDocument();

    await user.click(timelineThumb);

    await waitFor(() => {
      const timelineLightbox = screen.getByAltText('Timeline Preview');
      expect(timelineLightbox).toBeInTheDocument();
      expect(timelineLightbox).toHaveAttribute('src', 'https://images.unsplash.com/photo-1581092160607-ee22621dd758');
    });

    // Close timeline Lightbox
    const dialogElement = screen.getByRole('dialog');
    fireEvent.keyDown(dialogElement, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByAltText('Timeline Preview')).not.toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
     5. PHOTO UPLOAD & RE-RENDER IN RELOCATED SECTION
     -------------------------------------------------------------------------- */
  it('updates slot thumbnail upon file upload in relocated PhotoSlots section', async () => {
    // Mock FileReader
    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,mockUploadedPhoto123';
        setTimeout(() => {
          this.onload?.();
        }, 10);
      }
    }
    window.FileReader = MockFileReader as any;

    renderWithProviders(<JobActiveWorkspace job={mockJobWithPhotos} />);

    // Slot 1 (ระหว่างทำ 1) is initially empty
    expect(screen.queryByAltText('ระหว่างทำ 1')).not.toBeInTheDocument();

    const fileInputs = document.querySelectorAll('input[type="file"]');
    // First empty input is slot 1
    const testFile = new File(['fake-image-bytes'], 'progress1.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInputs[0], { target: { files: [testFile] } });

    await waitFor(() => {
      const newThumb = screen.getByAltText('ระหว่างทำ 1');
      expect(newThumb).toBeInTheDocument();
      expect(newThumb).toHaveAttribute('src', 'data:image/jpeg;base64,mockUploadedPhoto123');
    });
  });
});
