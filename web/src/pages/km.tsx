import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, 
  Search, 
  Printer
} from 'lucide-react';

interface KmArticle {
  id: number;
  code: string;
  title: string;
  category: 'General' | 'Operation' | 'Quality' | 'Finance' | 'MA';
  updatedAt: string;
  summary: string;
  content: string;
}

const KM_ARTICLES: KmArticle[] = [
  {
    id: 1,
    code: 'KM-GEN-001',
    title: 'คู่มือขั้นตอนการใช้งานระบบ PMT Flow v2 (สำหรับแอดมินและผู้จัดการ)',
    category: 'General',
    updatedAt: '26/09/2026',
    summary: 'ภาพรวมระบบ Pipeline 5 ขั้นตอน, การจัดการผู้ใช้, การกำหนดสิทธิ์ และการตรวจสอบ Logs',
    content: `
### 1. ภาพรวมของระบบ (System Overview)
ระบบ PMT Flow v2 ทำงานในรูปแบบ 5-Step Pipeline มาตรฐาน:
- **Step 1: คำสั่งซื้อ (Orders)** — รับคำสั่งซื้อใหม่, ออกแบบแปลน, และจัดทำ BOQ
- **Step 2: จัดสรรงาน (Conversion)** — มอบหมายช่างหลัก/ทีมงาน, กำหนดวันนัดหมาย และแปลงเป็นใบงาน
- **Step 3: แผนงาน Gantt (Gantt & Logs)** — ติดตามความคืบหน้าระดับโครงการ/โซน/งาน และบันทึกรายงานช่าง 24 ชม. 5 รูป
- **Step 4: ตรวจสอบ QC (Quality Control)** — ตรวจรับงาน Online & On-site และอนุมัติผล QC
- **Step 5: ปิดงาน (Job Completed)** — สรุปการใช้วัสดุ STK, สรุปยอดเงิน และส่งมอบงานลูกค้า

### 2. การจัดการสิทธิ์ผู้ใช้งาน (RBAC)
- **ADMIN**: สิทธิ์สูงสุด ดูแลผู้ใช้, ระบบ, และเข้าถึงทุกเมนู
- **AE (Account Executive)**: รับออเดอร์, จัดสรรงาน, ติดตามช่าง
- **QC**: ตรวจสอบคุณภาพงาน, อนุมัติ/ส่งแก้งาน
- **CONTACT_CENTER**: ดูแลข้อมูลลูกค้าและการรับเรื่องเบื้องต้น
    `,
  },
  {
    id: 2,
    code: 'KM-OPS-002',
    title: 'มาตรฐานการบันทึกงานช่างประจำวัน (Daily Technician Work Logs)',
    category: 'Operation',
    updatedAt: '26/09/2026',
    summary: 'กฎเกณฑ์การบันทึกเวลา 24 ชั่วโมง (00:00 - 23:59), การแนบรูปถ่าย 5 สล็อต และการสรุปผลงาน',
    content: `
### 1. กฎการบันทึกเวลาแบบ 24 ชั่วโมง (24-Hour Format Standard)
- ทุกการบันทึกเวลาปฏิบัติงานต้องใช้ระบบ **24 ชั่วโมง (00:00 - 23:59 น.)** เช่น \`08:30\`, \`13:00\`, \`17:45\`
- **ห้ามใช้ระบบ AM/PM โดยเด็ดขาด**

### 2. มาตรฐานการแนบรูปถ่าย 5 สล็อต (5-Photo Standard)
1. **รูปที่ 1 (ก่อนเริ่มงาน)**: สภาพพื้นที่เดิมก่อนลงมือปฏิบัติงาน
2. **รูปที่ 2 (ระหว่างปฏิบัติงาน 1)**: ขั้นตอนการรื้อถอนหรือติดตั้งท่อน้ำยา/ระบบไฟ
3. **รูปที่ 3 (ระหว่างปฏิบัติงาน 2)**: การล้าง/ติดตั้งคอยล์เย็นหรือแผงคอนเดนเซอร์
4. **รูปที่ 4 (หลังเสร็จสิ้น)**: สภาพงานที่ติดตั้งเรียบร้อยและทำความสะอาดพื้นที่
5. **รูปที่ 5 (ผลทดสอบระบบ)**: รูปวัดแรงดันน้ำยา (PSI) หรืออุณหภูมิหน้าช่องลม
    `,
  },
  {
    id: 3,
    code: 'KM-QC-003',
    title: 'เกณฑ์การตรวจประเมินคุณภาพงาน (QC Online & On-site Inspection)',
    category: 'Quality',
    updatedAt: '26/09/2026',
    summary: 'ขั้นตอนการตรวจแบบ 3 ระดับ (Project -> Area -> Task) และเงื่อนไขการอนุมัติ Pass/Rework',
    content: `
### 1. โครงสร้างการตรวจ QC 3 ระดับ
- **ระดับโครงการ (Project)**: ตรวจสอบความเรียบร้อยโดยรวมและการส่งมอบ
- **ระดับพื้นที่ (Area / Floor)**: ตรวจสอบตามห้องหรือโซนการทำงาน
- **ระดับงานย่อย (Task)**: ช่างต้องส่งรายงานและรูปถ่ายครบถ้วนก่อนส่งตรวจ QC

### 2. การตัดสินผลตรวจ
- **PASSED (ผ่าน)**: งานถูกต้องตามแบบแปลนและมาตรฐาน ไม่มีตำหนิ
- **NEEDS_REWORK (ต้องแก้ไข)**: พบข้อบกพร่อง ต้องระบุหมายเหตุและรูปภาพจุดที่ต้องแก้ไขอย่างชัดเจน เพื่อส่งกลับให้ช่างปรับปรุง
    `,
  },
  {
    id: 4,
    code: 'KM-FIN-004',
    title: 'ขั้นตอนการตัดสต็อกสินค้า (STK Export) และการปิดงานงวดบัญชี',
    category: 'Finance',
    updatedAt: '26/09/2026',
    summary: 'การตัดยอดวัสดุสิ้นเปลือง อะไหล่ และการส่งออกข้อมูลเข้าสู่ระบบบัญชี STK',
    content: `
### 1. การตรวจสอบรายการวัสดุและอุปกรณ์
- ตรวจสอบรายการของที่เบิกใช้จริงเทียบกับใบเสนอราคา (BOQ)
- ตรวจสอบความถูกต้องของรหัสสินค้า (SKU) และหน่วยนับ

### 2. การส่งออกไฟล์ STK (Export)
- เมื่อสถานะงานเป็น \`PASSED\` และได้รับการปิดงานใน Step 5
- กดปุ่ม **"ส่งออก STK"** เพื่อนำไฟล์เข้าสู่ระบบ ERP/บัญชีหลักของบริษัท
    `,
  },
  {
    id: 5,
    code: 'KM-MA-005',
    title: 'การบริหารจัดการสัญญาบริการบำรุงรักษา (MA Contracts & Service Cycles)',
    category: 'MA',
    updatedAt: '26/09/2026',
    summary: 'การสร้างสัญญารายปี, การกำหนดรอบบริการอัตโนมัติ (เช่น ทุก 3 เดือน) และการแจ้งเตือนงานล่วงหน้า',
    content: `
### 1. การจัดทำสัญญา MA
- บันทึกข้อมูลลูกค้า, หมายเลขสัญญา, วันที่เริ่มต้น - วันที่สิ้นสุด
- กำหนดความถี่การเข้าบริการ: ทุกเดือน, ทุก 2 เดือน, ทุก 3 เดือน หรือรายไตรมาส

### 2. การสร้างรอบบริการ (Service Cycles)
- ระบบจะ Generate รอบงานบำรุงรักษาล่วงหน้าให้อัตโนมัติ
- เมื่อถึงกำหนด ระบบจะแจ้งเตือนให้แปลงเป็นใบงานใน Step 2 จัดสรรงานทันที
    `,
  },
];

export default function KMPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedArticle, setSelectedArticle] = useState<KmArticle | null>(KM_ARTICLES[0]);

  const filteredArticles = useMemo(() => {
    return KM_ARTICLES.filter((article) => {
      if (categoryFilter !== 'ALL' && article.category !== categoryFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          article.title.toLowerCase().includes(q) ||
          article.code.toLowerCase().includes(q) ||
          article.summary.toLowerCase().includes(q) ||
          article.content.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [searchTerm, categoryFilter]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'General': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Operation': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Quality': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Finance': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MA': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const columns: ColumnDef<KmArticle>[] = [
    {
      id: 'code',
      header: 'รหัสคู่มือ',
      width: 120,
      cell: ({ row }) => <span className="font-mono text-xs font-bold text-indigo-700">{row.code}</span>,
    },
    {
      id: 'title',
      header: 'ชื่อบทความ / คู่มือการปฏิบัติงาน',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-xs text-black block">{row.title}</span>
          <span className="text-[11px] text-slate-500 line-clamp-1">{row.summary}</span>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'หมวดหมู่',
      width: 110,
      cell: ({ row }) => (
        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${getCategoryBadge(row.category)}`}>
          {row.category}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      header: 'ปรับปรุงล่าสุด',
      width: 120,
      cell: ({ row }) => <span className="font-mono text-xs text-black">{row.updatedAt}</span>,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader 
        title="คลังความรู้ (Knowledge Management)" 
        pageKey="km" 
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-1">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="ค้นหาคู่มือ, ขั้นตอนการทำงาน, รหัส KM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs text-black font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'ALL' ? 'bg-black text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('General')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'General' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Operation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'Operation' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Operation
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Quality')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'Quality' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              Quality
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Finance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'Finance' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              Finance
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('MA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'MA' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
              }`}
            >
              MA
            </button>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-600">
          พบ <span className="text-black font-bold font-mono">{filteredArticles.length}</span> บทความ
        </div>
      </div>

      {/* Top-Bottom Master Detail Layout */}
      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="km"
          masterContent={
            <DataGrid
              data={filteredArticles}
              columns={columns}
              getRowId={(row) => String(row.id)}
              selectedRowId={selectedArticle ? String(selectedArticle.id) : undefined}
              onRowSelect={setSelectedArticle}
            />
          }
          detailContent={
            selectedArticle ? (
              <div className="flex flex-col h-full bg-white border border-border-soft rounded-2xl shadow-sm p-6 overflow-y-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-soft">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getCategoryBadge(selectedArticle.category)}`}>
                          {selectedArticle.category}
                        </span>
                        <span className="font-mono text-xs font-bold text-indigo-700">{selectedArticle.code}</span>
                      </div>
                      <h2 className="text-lg font-bold text-black mt-0.5">{selectedArticle.title}</h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono">ปรับปรุงเมื่อ: {selectedArticle.updatedAt}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.print()} 
                      className="gap-1.5 text-xs text-black border-slate-300 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>พิมพ์คู่มือ</span>
                    </Button>
                  </div>
                </div>

                <div className="py-4 space-y-4 max-w-4xl">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      สรุปใจความสำคัญ (Summary)
                    </span>
                    <p className="text-xs font-semibold text-black leading-relaxed">
                      {selectedArticle.summary}
                    </p>
                  </div>

                  <div className="prose prose-sm text-black space-y-3 leading-relaxed whitespace-pre-line text-xs font-medium">
                    {selectedArticle.content}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState />
            )
          }
        />
      </div>
    </div>
  );
}
