import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderCustomerSummary } from '../order-customer-summary';
import { Job } from '../api';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

describe('OrderCustomerSummary - Adversarial Stress & Edge Case Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* --------------------------------------------------------------------------
     1. MISSING / NULL / UNDEFINED DATA RESILIENCE
     -------------------------------------------------------------------------- */
  describe('1. Missing / Null / Undefined Data Scenarios', () => {
    it('handles completely empty job object without crashing and renders fallback defaults', () => {
      const minimalJob = {
        id: 999,
        job_no: 'JOB-EMPTY',
      } as any;

      const { container } = renderWithProviders(<OrderCustomerSummary job={minimalJob} />);

      // Top container exists and has pure light theme styles
      expect(container.firstChild).toHaveClass('bg-white');
      expect(container.firstChild).toHaveClass('text-black');

      // Labels exist
      expect(screen.getByText('ลูกค้า:')).toBeInTheDocument();
      expect(screen.getByText('สถานที่ติดตั้ง:')).toBeInTheDocument();
      expect(screen.getByText('สินค้า/บริการ:')).toBeInTheDocument();
      expect(screen.getByText('สาขา/ประเภท:')).toBeInTheDocument();

      // Customer fallback name
      expect(screen.getByText('ลูกค้าทั่วไป')).toBeInTheDocument();

      // Address fallback
      expect(screen.getByText('-')).toBeInTheDocument();

      // Services fallback
      expect(screen.getByText('บริการติดตั้ง')).toBeInTheDocument();

      // Project type fallback
      expect(screen.getByText('ทั่วไป')).toBeInTheDocument();

      // Phone is not present, so phone link/copy button must NOT be rendered
      expect(screen.queryByTitle('โทรออก')).not.toBeInTheDocument();
      expect(screen.queryByTitle('คัดลอกเบอร์โทร')).not.toBeInTheDocument();

      // Google maps link must NOT be rendered when address is empty
      expect(screen.queryByTitle('Google Maps')).not.toBeInTheDocument();

      // Remarks must NOT be rendered when empty
      expect(screen.queryByText('หมายเหตุ:')).not.toBeInTheDocument();
    });

    it('handles null customer object gracefully (customer: null)', () => {
      const jobWithNullCustomer: Job = {
        id: 901,
        job_no: 'JOB-NULL-CUST',
        customer: null as any,
        customer_name: 'วิชัย การช่าง (จาก customer_name)',
        customer_phone: '0891234567',
        customer_address: 'เชียงใหม่',
        project_type: 'Quick Service',
        services: ['ล้างแอร์'],
        overall_progress: 0,
        grand_total: 1000,
        property_type: 'บ้าน',
        status: 'NEW',
      } as any;

      renderWithProviders(<OrderCustomerSummary job={jobWithNullCustomer} />);

      expect(screen.getByText('วิชัย การช่าง (จาก customer_name)')).toBeInTheDocument();
      expect(screen.getByText('เชียงใหม่')).toBeInTheDocument();
      expect(screen.getByText('089-123-4567')).toBeInTheDocument();
      expect(screen.getByText('ล้างแอร์')).toBeInTheDocument();
    });

    it('handles direct string customer without object wrapping', () => {
      const jobWithStringCustomer: Job = {
        id: 902,
        job_no: 'JOB-STR-CUST',
        customer: 'คุณหญิง อภิรดี',
        phone: '029876543',
        address: 'สุขุมวิท 21',
        project_type: 'Renovate',
        services: ['ปูกระเบื้อง'],
        overall_progress: 0,
        grand_total: 25000,
        property_type: 'คอนโด',
        status: 'NEW',
      } as any;

      renderWithProviders(<OrderCustomerSummary job={jobWithStringCustomer} />);

      expect(screen.getByText('คุณหญิง อภิรดี')).toBeInTheDocument();
      expect(screen.getByText('สุขุมวิท 21')).toBeInTheDocument();
      // 9-digit landline phone formatting (02-987-6543)
      expect(screen.getByText('02-987-6543')).toBeInTheDocument();
    });

    it('falls back to raw_payload values when root properties are missing', () => {
      const jobWithRawPayload: Job = {
        id: 903,
        job_no: 'JOB-RAW-PAYLOAD',
        customer: undefined as any,
        project_type: undefined as any,
        services: undefined as any,
        property_type: 'บ้าน',
        status: 'NEW',
        overall_progress: 0,
        grand_total: 5000,
        raw_payload: {
          customer: {
            name: 'นายกิตติ มานะ',
            phone: '0998887766',
            address: 'พระราม 9 ซอย 13',
            google_map_url: 'https://maps.app.goo.gl/testraw',
          },
          branch: {
            name: 'สาขาบางนา',
            store_code: 'BN01',
          },
          jobdetails: [
            { installation_detail: 'ติดตั้งเครื่องดูดควัน', product_quantity: 2 },
          ],
        },
      } as any;

      renderWithProviders(<OrderCustomerSummary job={jobWithRawPayload} />);

      expect(screen.getByText('นายกิตติ มานะ')).toBeInTheDocument();
      expect(screen.getByText('099-888-7766')).toBeInTheDocument();
      expect(screen.getByText('พระราม 9 ซอย 13')).toBeInTheDocument();
      expect(screen.getByText('ติดตั้งเครื่องดูดควัน x2')).toBeInTheDocument();
      expect(screen.getByText(/สาขาบางนา \(BN01\)/)).toBeInTheDocument();

      const mapLink = screen.getByTitle('Google Maps');
      expect(mapLink).toHaveAttribute('href', 'https://maps.app.goo.gl/testraw');
    });

    it('renders remarks from various potential data paths correctly', () => {
      // Test remarks from special_instructions
      const jobWithInstructions: any = {
        id: 904,
        job_no: 'JOB-NOTE-1',
        customer: 'ลูกค้า 1',
        special_instructions: 'ระวังน้องหมาดุมาก',
        services: ['ตรวจระบบไฟ'],
      };
      const { unmount: u1 } = renderWithProviders(<OrderCustomerSummary job={jobWithInstructions} />);
      expect(screen.getByText('หมายเหตุ:')).toBeInTheDocument();
      expect(screen.getByText('ระวังน้องหมาดุมาก')).toBeInTheDocument();
      u1();

      // Test remarks from remarks_data.comment
      const jobWithComment: any = {
        id: 905,
        job_no: 'JOB-NOTE-2',
        customer: 'ลูกค้า 2',
        remarks_data: { comment: 'ลูกค้ารีบ ให้นำช่างมา 3 คน' },
        services: ['ติดตั้งแอร์'],
      };
      const { unmount: u2 } = renderWithProviders(<OrderCustomerSummary job={jobWithComment} />);
      expect(screen.getByText('ลูกค้ารีบ ให้นำช่างมา 3 คน')).toBeInTheDocument();
      u2();

      // Test remarks from items remark
      const jobWithItemRemark: any = {
        id: 906,
        job_no: 'JOB-NOTE-3',
        customer: 'ลูกค้า 3',
        job_details: [
          { installation_detail: 'ซ่อมหลังคา', remark: 'กระเบื้องซีแพคสีน้ำตาล' },
        ],
        services: ['ซ่อมหลังคา'],
      };
      const { unmount: u3 } = renderWithProviders(<OrderCustomerSummary job={jobWithItemRemark} />);
      expect(screen.getByText('กระเบื้องซีแพคสีน้ำตาล')).toBeInTheDocument();
      u3();
    });
  });

  /* --------------------------------------------------------------------------
     2. EXTREMELY LONG TEXT, MULTI-LINE ADDRESS, AND MANY ITEMS (LAYOUT STRESS)
     -------------------------------------------------------------------------- */
  describe('2. Extremely Long Strings and Multi-line Layout Stress', () => {
    it('handles 1,000-character customer name without breaking layout (uses truncate and min-w-0)', () => {
      const megaCustomerName = 'นาย' + 'สมหมายรักการบริการยอดเยี่ยม'.repeat(40);
      const longJob: any = {
        id: 910,
        job_no: 'JOB-LONG-NAME',
        customer: {
          name: megaCustomerName,
          phone: '0812345678',
          address: 'กรุงเทพฯ',
        },
        services: ['ทาสีอาคาร'],
      };

      renderWithProviders(<OrderCustomerSummary job={longJob} />);

      const custSpan = screen.getByText(megaCustomerName);
      expect(custSpan).toBeInTheDocument();
      expect(custSpan).toHaveClass('truncate');
      expect(custSpan.closest('.min-w-0')).not.toBeNull();
    });

    it('handles multi-line address with newlines without breaking grid layout', () => {
      const multiLineAddress = '999/88 อาคารศรีสวัสดิ์ทาวเวอร์ ชั้น 18 ห้อง 1802-1804\nถนนพหลโยธิน แขวงสามเสนใน\nเขตพญาไท กรุงเทพมหานคร 10400';
      const multiLineJob: any = {
        id: 911,
        job_no: 'JOB-MULTILINE-ADDR',
        customer: {
          name: 'สมใจ สบายดี',
          phone: '0812345678',
          address: multiLineAddress,
        },
        services: ['ปรับปรุงระบบสุขาภิบาล'],
      };

      renderWithProviders(<OrderCustomerSummary job={multiLineJob} />);

      const addrSpan = screen.getByText(multiLineAddress, { normalizer: (text) => text });
      expect(addrSpan).toBeInTheDocument();
      expect(addrSpan).toHaveClass('truncate');
      // Hover title should contain full multi-line address
      expect(addrSpan).toHaveAttribute('title', multiLineAddress);
    });

    it('handles 50 order items without overflowing or breaking layout', () => {
      const fiftyItems = Array.from({ length: 50 }, (_, i) => ({
        installation_detail: `รายการสินค้าพิเศษชิ้นที่ ${i + 1}`,
        product_quantity: (i % 5) + 1,
      }));

      const bigJob: any = {
        id: 912,
        job_no: 'JOB-50-ITEMS',
        customer: 'บริษัท เจริญรุ่งเรือง จำกัด',
        job_details: fiftyItems,
      };

      renderWithProviders(<OrderCustomerSummary job={bigJob} />);

      // Summary text contains items
      const summaryText = fiftyItems.map(i => `${i.installation_detail} x${i.product_quantity}`).join(', ');
      const itemsSpan = screen.getByText(summaryText);
      expect(itemsSpan).toBeInTheDocument();
      expect(itemsSpan).toHaveClass('truncate');
      expect(itemsSpan).toHaveAttribute('title', summaryText);
    });

    it('handles extremely long remark text gracefully with full tooltip', () => {
      const longRemark = 'หมายเหตุพิเศษจากผู้ว่าจ้าง: '.repeat(20) + 'กรุณาตรวจสอบก่อนส่งมอบ';
      const remarkJob: any = {
        id: 913,
        job_no: 'JOB-LONG-REMARK',
        customer: 'ลูกค้าทั่วไป',
        special_instructions: longRemark,
        services: ['งานซ่อมบำรุง'],
      };

      renderWithProviders(<OrderCustomerSummary job={remarkJob} />);

      const remarkSpan = screen.getByText(longRemark);
      expect(remarkSpan).toBeInTheDocument();
      expect(remarkSpan).toHaveClass('truncate');
      expect(remarkSpan).toHaveAttribute('title', longRemark);
    });
  });

  /* --------------------------------------------------------------------------
     3. PHONE COPY BUTTON & TEL LINK BEHAVIOR
     -------------------------------------------------------------------------- */
  describe('3. Phone Copy Button and tel: Link Actions', () => {
    let writeTextMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
        configurable: true,
      });
    });

    it('renders tel: link with clean digits only', () => {
      const jobWithHyphenPhone: any = {
        id: 920,
        job_no: 'JOB-PHONE-TEL',
        customer: {
          name: 'กานดา สดใส',
          phone: '081-999-8877',
          address: 'กรุงเทพฯ',
        },
        services: ['ล้างแอร์'],
      };

      renderWithProviders(<OrderCustomerSummary job={jobWithHyphenPhone} />);

      const telLink = screen.getByTitle('โทรออก');
      expect(telLink).toHaveAttribute('href', 'tel:0819998877');
      expect(telLink).toHaveTextContent('081-999-8877');
    });

    it('copies clean phone number to navigator.clipboard on button click', () => {
      const jobToCopy: any = {
        id: 921,
        job_no: 'JOB-COPY-PHONE',
        customer: {
          name: 'สมบูรณ์ มั่งมี',
          phone: '089-555-1234',
        },
        services: ['ตรวจระบบไฟ'],
      };

      renderWithProviders(<OrderCustomerSummary job={jobToCopy} />);

      const copyBtn = screen.getByTitle('คัดลอกเบอร์โทร');
      expect(copyBtn).toBeInTheDocument();

      fireEvent.click(copyBtn);

      // Clipboard should have received stripped digits
      expect(writeTextMock).toHaveBeenCalledWith('0895551234');

      // Toast notification should fire
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('089-555-1234'));
    });

    it('stops event propagation when clicking copy button', () => {
      const outerClickHandler = vi.fn();

      const jobToCopy: any = {
        id: 922,
        job_no: 'JOB-STOP-PROP',
        customer: {
          name: 'สุชาติ มั่นคง',
          phone: '0812345678',
        },
        services: ['งานประปา'],
      };

      renderWithProviders(
        <div onClick={outerClickHandler}>
          <OrderCustomerSummary job={jobToCopy} />
        </div>
      );

      const copyBtn = screen.getByTitle('คัดลอกเบอร์โทร');
      fireEvent.click(copyBtn);

      // Outer container should NOT receive click event
      expect(outerClickHandler).not.toHaveBeenCalled();
    });
  });

  /* --------------------------------------------------------------------------
     4. GOOGLE MAPS LINK BEHAVIOR
     -------------------------------------------------------------------------- */
  describe('4. Google Maps Icon Link Behavior', () => {
    it('generates encoded search query link when address is provided and google_map_url is absent', () => {
      const address = '123/45 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110';
      const jobForMaps: any = {
        id: 930,
        job_no: 'JOB-MAP-SEARCH',
        customer: {
          name: 'ประเสริฐ ชัยชนะ',
          address,
        },
        services: ['งานติดตั้ง'],
      };

      renderWithProviders(<OrderCustomerSummary job={jobForMaps} />);

      const mapLink = screen.getByTitle('Google Maps');
      expect(mapLink).toBeInTheDocument();
      expect(mapLink).toHaveAttribute('target', '_blank');
      expect(mapLink).toHaveAttribute('rel', 'noopener noreferrer');

      const href = mapLink.getAttribute('href') || '';
      expect(href).toContain('https://www.google.com/maps/search/?api=1&query=');
      expect(href).toContain(encodeURIComponent(address));
    });

    it('prioritizes explicit google_map_url over inferred address search link', () => {
      const explicitUrl = 'https://maps.app.goo.gl/customPinnedLocation123';
      const jobWithPin: any = {
        id: 931,
        job_no: 'JOB-MAP-PIN',
        customer: {
          name: 'ประเสริฐ ชัยชนะ',
          address: 'กรุงเทพฯ',
        },
        google_map_url: explicitUrl,
        services: ['งานติดตั้ง'],
      };

      renderWithProviders(<OrderCustomerSummary job={jobWithPin} />);

      const mapLink = screen.getByTitle('Google Maps');
      expect(mapLink).toHaveAttribute('href', explicitUrl);
    });

    it('does NOT render Google Maps icon link when both address and google_map_url are missing', () => {
      const jobWithoutLocation: any = {
        id: 932,
        job_no: 'JOB-NO-LOCATION',
        customer: {
          name: 'ประเสริฐ ชัยชนะ',
          address: '',
        },
        services: ['งานติดตั้ง'],
      };

      renderWithProviders(<OrderCustomerSummary job={jobWithoutLocation} />);

      expect(screen.queryByTitle('Google Maps')).not.toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
     5. STYLING & CLEAN DESIGN COMPLIANCE (GEMINI.md & 2026-09-27 Specification)
     -------------------------------------------------------------------------- */
  describe('5. Styling, Pure Black Text, and No-Background Compliance', () => {
    it('strictly satisfies Pure Light Theme and 100% Pure Black Text without colored backgrounds', () => {
      const sampleJob: any = {
        id: 940,
        job_no: 'JOB-STYLE-CHECK',
        customer: {
          name: 'ธนวัฒน์ ดีเลิศ',
          phone: '0812345678',
          address: 'นนทบุรี',
        },
        services: ['ติดตั้งปั๊มน้ำ'],
        special_instructions: 'ตรวจสอบมิเตอร์ไฟฟ้าก่อนเปิดสวิตช์',
      };

      const { container } = renderWithProviders(<OrderCustomerSummary job={sampleJob} />);

      // Top container
      const topDiv = container.firstChild as HTMLElement;
      expect(topDiv).toHaveClass('bg-white');
      expect(topDiv).toHaveClass('text-black');

      // Verify that prohibited background colors are NOT present
      expect(container.querySelectorAll('.bg-blue-50')).toHaveLength(0);
      expect(container.querySelectorAll('.bg-blue-50\\/40')).toHaveLength(0);
      expect(container.querySelectorAll('.bg-blue-100\\/80')).toHaveLength(0);
      expect(container.querySelectorAll('.bg-amber-50')).toHaveLength(0);
      expect(container.querySelectorAll('.bg-gray-50\\/80')).toHaveLength(0);

      // Verify that prohibited colored text classes are NOT present
      expect(container.querySelectorAll('.text-blue-700')).toHaveLength(0);
      expect(container.querySelectorAll('.text-green-700')).toHaveLength(0);
      expect(container.querySelectorAll('.text-red-600')).toHaveLength(0);
      expect(container.querySelectorAll('.text-amber-700')).toHaveLength(0);
      expect(container.querySelectorAll('.text-gray-400')).toHaveLength(0);
      expect(container.querySelectorAll('.text-gray-600')).toHaveLength(0);

      // Verify that no card subtitles or explanatory descriptions remain
      expect(screen.queryByText(/Order Details/i)).not.toBeInTheDocument();
      expect(screen.queryByText('ข้อมูลลูกค้า')).not.toBeInTheDocument();
      expect(screen.queryByText('เบอร์โทรติดต่อ:')).not.toBeInTheDocument();
      expect(screen.queryByText('สถานที่ติดตั้งหน้างาน')).not.toBeInTheDocument();
      expect(screen.queryByText('เปิดนำทางด้วย Google Maps')).not.toBeInTheDocument();
      expect(screen.queryByText('สินค้า / บริการในคำสั่งซื้อ')).not.toBeInTheDocument();
    });
  });
});
