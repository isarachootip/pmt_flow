# PMT Flow v2 — Feature Parity Checklist (Phase 0 Audit)

> เอกสารตรวจสอบความสมบูรณ์และเทียบเคียงฟังก์ชันการทำงาน (Feature Parity) ระหว่าง PMT Flow ระบบเดิม (v1) และระบบสร้างใหม่ (v2)  
> อ้างอิงตาม: `index.html`, `public/js/*.js`, `server.ts`, `database.ts`, `schema.sql`, `REQUIREMENTS.md`, และ `pmt_flow_skill.md`  
> วันที่ Audit: 24 กันยายน 2569

---

## สรุปภาพรวมการตรวจสอบ (Audit Executive Summary)

- **จำนวนหน้าหลักในระบบเดิม**: 19 หน้า (`page-*`)
- **จำนวนโมดอลหลัก (Key Modals)**: 33 โมดอล + `#login-overlay` + `#modal-training-viewer`
- **จำนวนฟีเจอร์และปุ่มควบคุม**: ~210+ ฟีเจอร์ย่อย (ระบุเป็นรายการ Checkbox ด้านล่าง)
- **จำนวน API Endpoints ใน Backend (`server.ts`)**: 83 Route Handlers (~52 Functional Operations)
- **บทบาทผู้ใช้งาน (RBAC Roles)**: 4 บทบาทหลัก (`ADMIN`, `AE`, `QC`, `CONTACT_CENTER`)

### สถานะการสร้างระบบใหม่รายเฟส (Rebuild Phase Roadmap)
- [x] **Phase 0 — Audit & Feature Parity**: สำรวจโค้ดเดิม จัดทำ Feature Checklist, API Map, Business Rules
- [x] **Phase 1 — Foundation**: โปรเจกต์ `web/` (React 18 + TS + Tailwind + Tokens), Express serve `/v2`, build/test ผ่าน 100%
- [ ] **Phase 2 — Design System & Styleguide**: Components UI สไตล์ Lark + หน้า `/v2/styleguide`
- [ ] **Phase 3 — App Shell & Authentication**: Login, Topbar, Sidebar ตาม Role, Guard, Logout
- [ ] **Phase 4 — Dashboard, Step 1 & JobDetail**: Dashboard KPI, Master/Detail Grid, Job 360
- [ ] **Phase 5 — Step 2–3**: Ticket, Blueprints, BOQ Inline Editor, Convert to Project
- [ ] **Phase 6 — Step 4**: Gantt Timeline, บันทึกช่างรายวัน (PhotoSlots5, 24h)
- [ ] **Phase 7 — Step 5–6**: QC Online/On-site, STK Outbound, CSAT, MA
- [ ] **Phase 8 — Admin, Reports & KM**: Users, API Monitor, Settings, Reports, KM Articles
- [ ] **Phase 9 — QA, Responsive & Cutover**: E2E Tests, Mobile Audit, Switch `/` to v2

---

## 1. รายการตรวจสอบตามหน้าจอ (Pages Checklist)

### 1.1 `page-dashboard` (แดชบอร์ดภาพรวมผู้บริหาร & ปฏิบัติการ)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`, `QC`, `CONTACT_CENTER`
- **API ที่เรียก**:
  - `GET /api/v1/jobs/summary` — สรุปตัวเลข KPI ภาพรวม
  - `GET /api/v1/jobs?limit=10&sort=created_at&order=desc` — งานล่าสุด
  - `GET /api/v1/auth/me` — ข้อมูลผู้ใช้ปัจจุบัน
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **KPI Stat Cards**: งานใหม่วันนี้ (New Orders), งานกำลังทำ (In Progress), รอตรวจ QC (QC Pending), งานสำเร็จสะสม (Completed Jobs)
  - [ ] **SLA Warning Banner / Badge**: แจ้งเตือนงานใกล้ครบกำหนด SLA หรือเกินกำหนด (Overdue)
  - [ ] **Quick Action Buttons**:
    - [ ] ปุ่ม "รับคำสั่งซื้อใหม่" (`+ สร้างงานใหม่`) ➔ เปิด `modal-create-job`
    - [ ] ปุ่ม "เข้าสู่ One-Stop Studio" ➔ เปิด `modal-unified-order-studio`
    - [ ] ปุ่ม "จำลอง 10 งานทดสอบ (Dev Only)" ➔ เรียก `POST /api/v1/jobs/simulate-int`
    - [ ] ปุ่ม "ถอยสถานะเป็น Draft (Dev Only)" ➔ เรียก `POST /api/v1/jobs/reset-status`
    - [ ] ปุ่ม "ล้างข้อมูลโครงการทั้งหมด (Dev Only)" ➔ เรียก `POST /api/v1/system/wipe-transactions`
  - [ ] **Order Pipeline Stepper / Summary**: ตัวเลขนับงานค้างในแต่ละ Step (1 ถึง 6)
  - [ ] **ตารางรายการงานล่าสุด (Recent Jobs Table)**: แสดง 5–10 รายการล่าสุด พร้อมรหัสงาน, ชื่อลูกค้า, ประเภทงาน (Quick/Renovate), สถานะ, และปุ่มเปิดดู Job Detail
  - [ ] **Chart การส่งมอบงานและ QC Pass Rate**: กราฟแท่ง/โดนัท สถิติงานผ่าน QC และ CSAT
- **Business Rules**:
  - ผู้ใช้ที่ไม่ใช่ Superadmin/Dev (`isIsaraChootip`) จะถูกซ่อนปุ่ม Dev Controls (ล้างโครงการ, ถอยสถานะ, จำลองงาน)
  - ตัวเลข KPI ต้องตรงกับ Database จริง ไม่ Hardcode เป็นศูนย์

---

### 1.2 `page-master-orders` (สรุปคำสั่งซื้อทั้งหมดในระบบ — Master All-Orders Tracking)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`, `QC`, `CONTACT_CENTER`
- **API ที่เรียก**:
  - `GET /api/v1/jobs` (query: `search`, `service`, `status`, `page`, `limit`, `sort`, `order`)
  - `GET /api/v1/jobs/summary`
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Stats**: ยอดคำสั่งซื้อทั้งหมด, มูลค่ารวม (Grand Total), งาน Quick, งาน Renovate
  - [ ] **Search Box**: ค้นหาทันทีจาก รหัสงาน (`JOB...`), Ref ID, Ticket, Booking No, ชื่อลูกค้า, เบอร์โทร
  - [ ] **Filter Chips & Dropdowns**:
    - [ ] ตัวกรองประเภทงาน: ทั้งหมด / Quick Service / Renovate / MA
    - [ ] ตัวกรองสถานะ: ทั้งหมด / Draft / Surveyed / In Progress / QC Pending / QC Passed / After Sale / Closed / Closed Lost
    - [ ] ตัวกรองบริการ (Service Type): ติดตั้งแอร์, ปั๊มแท็งก์, เครื่องทำน้ำอุ่น, Renovate ครัว ฯลฯ
    - [ ] ตัวกรองช่วงวันที่ (Flatpickr Date Range `DD/MM/YYYY`)
  - [ ] **Data Table (Strict List View First)**:
    - [ ] คอลัมน์: รหัสคำสั่งซื้อ (Job No), วันที่รับงาน, ชื่อลูกค้า & เบอร์โทร, ประเภทงาน (Badge Quick/Renovate), บริการ, ทีมช่าง, สถานะ (ตัวอักษรดำ + จุดสี), ยอดเงิน (Grand Total ฿), การกระทำ (Actions)
    - [ ] Sorting: คลิกหัวคอลัมน์เพื่อเรียง วันที่, ยอดเงิน, สถานะ
    - [ ] Pagination: เลือก 10, 25, 50, 100 รายการต่อหน้า
  - [ ] **ปุ่ม Export**:
    - [ ] ปุ่ม "Export Excel" (ดาวน์โหลด `.xlsx`)
    - [ ] ปุ่ม "Export CSV" (ดาวน์โหลด `.csv`)
  - [ ] **Row Action Buttons**:
    - [ ] ปุ่ม "ดูรายละเอียด (Job 360)" ➔ เปิด `modal-job-preview-detail` หรือไป `/jobs/:id`
    - [ ] ปุ่ม "แก้ไข" ➔ เปิด Studio หรือ Edit Drawer
    - [ ] ปุ่ม "ยกเลิก/ปิดงานเสีย (Close Lost)" ➔ เปิด `modal-close-lost`
- **Business Rules**:
  - List View ต้องเป็นค่าเริ่มต้นเสมอ (ห้าม Default เป็น Card View)
  - ข้อมูลสำคัญต้องแสดงผลด้วยตัวหนังสือสีดำ `#000000`

---

### 1.3 `page-jobs` (Step 1: บันทึกงาน & คิวรับคำสั่งซื้อใหม่ — Order Intake & Survey)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE` (ฝ่ายขาย/ประสานงาน)
- **API ที่เรียก**:
  - `GET /api/v1/jobs?status=DRAFT,NEW,SURVEYED`
  - `POST /api/v1/jobs` — สร้างงานภายใน
  - `POST /api/v1/integration/orders` — จำลองรับงาน INT
  - `PATCH /api/v1/jobs/:id` — รับงานเข้า PMT (`pmt_accepted: true`)
  - `POST /api/v1/jobs/:id/checkin` — บันทึกผลสำรวจ & Check-in พิกัด GPS
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Tabs**:
    - [ ] แท็บ "คิวงานรับใหม่ (New Inbound Orders)"
    - [ ] แท็บ "รอสำรวจหน้างาน (Pending Survey)"
    - [ ] แท็บ "สำรวจแล้วเสร็จ (Survey Completed)"
  - [ ] **ปุ่ม Action หลัก**:
    - [ ] ปุ่ม `+ สร้างคำสั่งซื้อใหม่` ➔ เปิด `modal-create-job`
    - [ ] ปุ่ม `One-Stop Order Studio` ➔ เปิด `modal-unified-order-studio`
    - [ ] ปุ่ม `ดึงงานจาก Visit Plan (INT)` ➔ ซิงก์คิวงานจาก Staging
  - [ ] **Filters**: ค้นหาชื่อ/เบอร์/รหัสงาน, กรองประเภทบริการ, กรองสถานะ Check-in
  - [ ] **Order Queue Table (List View)**:
    - [ ] Badge แสดงสถานะ: งานใหม่ (`NEW!`), สำรวจแล้ว (`SURVEYED`), รอรับเข้า PMT
    - [ ] ข้อมูลพิกัดหน้างาน & ลิงก์ Google Maps
    - [ ] ข้อมูลนัดหมาย (วันเวลาแบบ 24 ชม. `DD/MM/YYYY HH:mm`)
  - [ ] **Row Buttons**:
    - [ ] ปุ่ม "📍 Check-in หน้างาน (GPS)" ➔ บันทึกพิกัด + แนบรูป 5 รูป
    - [ ] ปุ่ม "✓ รับเข้าระบบ PMT" (`acceptJobToPMT`)
    - [ ] กรณี Quick Service: ปุ่ม "⚡ รับเข้า ➔ ส่งตรง QC Online"
- **Business Rules**:
  - การ Check-in ต้องตรวจสอบรัศมีพิกัดเทียบกับที่อยู่ลูกค้า (Default Geofence: 400 เมตร)
  - รูปสำรวจหน้างานต้องมีอย่างน้อย 5 รูป บีบอัด Client-side maxDim 1200px, quality 0.8
  - Quick Service ข้าม Step 2 (Design) และ Step 3 (BOQ) ตรงไป Step 5 (QC)

---

### 1.4 `page-job-detail` (หน้ารายละเอียดโครงการเต็มรูปแบบ — Job 360 Full Page View)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`, `QC`, `CONTACT_CENTER`
- **API ที่เรียก**:
  - `GET /api/v1/jobs/:id` — ดึงข้อมูลงาน 360 ครบทุกมิติ
  - `PATCH /api/v1/jobs/:id` — บันทึกข้อมูลคำสั่งพิเศษ, หมายเหตุ, สถานะ
  - `POST /api/v1/jobs/:id/photos` — เพิ่มรูปภาพหน้างาน
  - `DELETE /api/v1/jobs/:id/photos/:photoId` — ลบรูปภาพ
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Bar**:
    - [ ] ปุ่มย้อนกลับ (Back to caller view)
    - [ ] รหัสงาน, วันที่สร้าง, Store Code, Agent Name
    - [ ] Badge สถานะงาน (ตัวอักษรดำ + จุดสี) และ Badge ประเภทงาน (`Quick` / `Renovate`)
    - [ ] Check-in status badge พร้อมเวลาเซิร์ฟเวอร์
    - [ ] ปุ่มบันทึกข้อมูลคำสั่งพิเศษ/หมายเหตุ (`saveJobNotes`)
  - [ ] **Pipeline Stepper**: แถบความคืบหน้า 6 ขั้นตอน (แสดงเฉพาะหน้าเปิดเต็มนี้)
  - [ ] **Customer & Site Details Card**:
    - [ ] ชื่อ-นามสกุลลูกค้า, เบอร์โทร (กดโทรออกได้), ที่อยู่ติดตั้งเต็ม
    - [ ] แผนที่พิกัด GPS ละติจูด/ลองจิจูด + ลิงก์เปิด Google Maps
  - [ ] **Sub-tabs (Data Grids / Sections)**:
    - [ ] **แท็บ 1: ข้อมูลทั่วไป & แผนนัดหมาย (General & Appointment)**
    - [ ] **แท็บ 2: รูปถ่ายหน้างาน 5 รูป (5 Site Photos)** + ปุ่มดู Lightbox
    - [ ] **แท็บ 3: แบบแปลนติดตั้ง (Blueprints & CAD)** — ไฟล์แบบ, เวอร์ชัน, ปุ่มดาวน์โหลด
    - [ ] **แท็บ 4: รายการ BOQ & ประมาณการราคา (BOQ Items)** — รายการวัสดุ/ค่าแรง, Subtotal, Discount, Grand Total
    - [ ] **แท็บ 5: แผนงานและทีมช่าง (Tasks & Gantt Schedule)** — รายชื่องาน, ช่าง, วันเริ่ม-เสร็จ, % ความคืบหน้า
    - [ ] **แท็บ 6: บันทึกงานช่างประจำวัน (Daily Technician Logs)** — ประวัติการเข้างาน, รูป 5 ช่อง, ชั่วโมงทำงาน
    - [ ] **แท็บ 7: ประวัติการตรวจ QC (QC Inspection History)** — รอบที่ตรวจ, ผล Pass/Rework, คะแนน, ผู้ตรวจ
    - [ ] **แท็บ 8: ข้อมูลการเงิน & Ticket (Tickets & Receipts)** — เลขที่ Ticket, สลิปโอนเงิน, วันที่ชำระ
    - [ ] **แท็บ 9: บันทึกตรวจสอบขั้นตอน (Audit Trail Timestamps)** — บันทึกเวลาทุก Step ย้อนหลัง
  - [ ] **Quick Preset Tags**:
    - [ ] ปุ่มแท็กด่วนคำสั่งพิเศษ: "ระวังหมาดุ", "เข้าหลัง 10:00 น.", "สวมถุงคลุมรองเท้า", "ห้ามเสียงดังช่วงบ่าย"
- **Business Rules**:
  - เมื่อเปิดงาน หากพบว่าข้อมูล child array (boq, tasks, photos, qc_history) ยังโหลดไม่ครบ ต้อง lazy fetch `GET /api/v1/jobs/:id` เสมอ
  - ห้ามเขียนทับข้อมูลที่มีอยู่เดิมด้วย Array ว่างเปล่า

---

### 1.5 `page-blueprints` (คลังแบบแปลนและไฟล์ออกแบบ — Central Blueprints & CAD)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`, `QC`
- **API ที่เรียก**:
  - `GET /api/v1/blueprints`
  - `POST /api/v1/blueprints`
  - `PATCH /api/v1/blueprints/:id`
  - `DELETE /api/v1/blueprints/:id`
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Actions**:
    - [ ] ปุ่ม `+ อัปโหลดแบบแปลนใหม่` ➔ เปิด `modal-upload-blueprint`
    - [ ] ปุ่มสลับมุมมอง List View / Card View (Default: List View)
  - [ ] **Filters**: กรองตามบริการ (Service), กรองตามโซนพื้นที่ (Zone: ครัว, ห้องน้ำ, หลังคา), ค้นหาชื่อไฟล์/รหัสงาน
  - [ ] **Blueprints Table (List View)**:
    - [ ] คอลัมน์: รหัสงาน, ชื่อแบบแปลน, ประเภทไฟล์ (`.dwg`, `.skp`, `.pdf`, `.png`), เวอร์ชัน (`v1.0`, `v2.0 Approved`), โซนงาน, ผู้อัปโหลด, วันที่อัปโหลด, การกระทำ
  - [ ] **Version Control & Approval**:
    - [ ] แสดงสถานะ Current Version
    - [ ] ปุ่มกดอนุมัติแบบแปลน (Approve Blueprint as v2 Final)
    - [ ] พรีวิวไฟล์ PDF/รูปภาพ Inline และปุ่มดาวน์โหลดไฟล์ CAD (`.dwg`/`.skp`)
- **Business Rules**:
  - รองรับไฟล์เวอร์ชัน (v1, v2, v3 Final) ห้ามลบเวอร์ชันเก่าเมื่อมีการอัปโหลดเวอร์ชันใหม่
  - การผ่านเงื่อนไข Step 2 Design ในงาน Renovate ต้องมีแบบแปลนที่เป็นเวอร์ชัน `v2.0` หรือระบุว่า "Approved / สมบูรณ์"

---

### 1.6 `page-tickets` (Step 2: บันทึก Ticket & สลิปใบเสร็จ — Tickets & Receipts)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`
- **API ที่เรียก**:
  - `GET /api/v1/tickets`
  - `POST /api/v1/tickets`
  - `PATCH /api/v1/tickets/:id`
  - `DELETE /api/v1/tickets/:id`
  - `PATCH /api/v1/jobs/:id` (อัปเดต `ticket_no`, `slip_url`, `step_timestamps.step2_ticket_at`)
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Tabs**:
    - [ ] แท็บ "รอดำเนินการออก Ticket & แนบสลิป (Pending)"
    - [ ] แท็บ "บันทึกเรียบร้อยแล้ว (Completed Tickets)"
  - [ ] **ปุ่ม Action**:
    - [ ] ปุ่ม `+ สร้าง Ticket / แนบสลิปใหม่` ➔ เปิด `modal-create-ticket`
    - [ ] ปุ่มสลับมุมมอง List / Card View (Default: List View)
  - [ ] **Table (List View)**:
    - [ ] คอลัมน์: เลข Ticket, รหัสคำสั่งซื้อ (Job No), ชื่อลูกค้า, ยอดเงินตามใบเสร็จ (฿), วิธีชำระเงิน (โอนเงิน, บัตร, เงินสด), ธนาคาร, วันที่ชำระ, ภาพสลิป (Thumbnail + คลิกดู Lightbox), ผู้บันทึก
  - [ ] **Row Actions**:
    - [ ] ปุ่ม "ดูสลิปชำระเงินขนาดเต็ม" ➔ เปิด Lightbox
    - [ ] ปุ่ม "ส่งต่อ Step 3 (Convert เข้า Project)"
- **Business Rules**:
  - ยอดเงินใน Ticket ต้องตรงกับยอด Grand Total ของ BOQ (หรือมีหมายเหตุระบุการแบ่งงวด)
  - สลิปชำระเงินรองรับไฟล์รูปภาพและ PDF

---

### 1.7 `page-boq` (คลังรายการ BOQ กลาง — Central BOQ Repository)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`, `QC`
- **API ที่เรียก**:
  - `GET /api/v1/jobs` (ดึงงานที่มี BOQ)
  - `POST /api/v1/jobs/:id/boq` — บันทึกรายการ BOQ
  - `POST /api/v1/jobs/:id/boq/upload-file` — อัปโหลดไฟล์ Excel/CSV
  - `GET /api/v1/boq-files/:jobId/:filename` — ดาวน์โหลดไฟล์ BOQ
  - `DELETE /api/v1/jobs/:id/boq/file` — ลบไฟล์ BOQ
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Tabs**:
    - [ ] แท็บ "รอนำเข้า BOQ (Pending BOQ)"
    - [ ] แท็บ "มีรายการ BOQ แล้ว (Active BOQ)"
  - [ ] **ปุ่ม Action**:
    - [ ] ปุ่ม `+ จัดการ BOQ รายงาน` ➔ เปิด `modal-manage-boq`
    - [ ] ปุ่ม `นำเข้าไฟล์ BOQ (Excel / CSV)` ➔ เปิด `modal-import-boq`
  - [ ] **BOQ Summary Table (List View)**:
    - [ ] คอลัมน์: รหัสคำสั่งซื้อ, ลูกค้า, จำนวนรายการ (ค่าแรง/บริการ + วัสดุ), ต้นทุนรวม (Cost), ราคารวม (Subtotal), ส่วนลด (Discount), ยอดสุทธิ (Grand Total), ไฟล์ต้นฉบับแนบ, การกระทำ
  - [ ] **Row Actions**:
    - [ ] ปุ่ม "เปิดแก้ไขตาราง BOQ" ➔ เปิด `modal-manage-boq`
    - [ ] ปุ่ม "ดาวน์โหลดไฟล์ Excel ต้นฉบับ"
    - [ ] ปุ่ม "แปลงค่าแรงเป็น Tasks (Step 3)"
- **Business Rules**:
  - สูตรคำนวณ:
    - $\text{Subtotal} = \sum (\text{qty} \times \text{unit\_price})$
    - $\text{Cost} = \sum (\text{qty} \times \text{cost\_price})$
    - $\text{Grand Total} = \max(0, \text{Subtotal} - \text{Discount})$
    - **No VAT 7%** (ห้ามบวก VAT เพิ่มในระบบ PMT Flow)
  - รายการหมวด "ค่าแรง/บริการ" จะถูกแปลงเป็น Task ใน Step 3 ส่วนหมวด "วัสดุ/อุปกรณ์" จะถูกเก็บไว้เพื่อคิดเงินและควบคุมสต็อก

---

### 1.8 `page-project-conversion` (Step 3: เตรียมแผนงานและทีมช่าง — Project Conversion)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`
- **API ที่เรียก**:
  - `GET /api/v1/jobs/:id/tasks`
  - `POST /api/v1/jobs/:id/tasks/import-boq` — แปลงรายการค่าแรงจาก BOQ เป็น Task กิจกรรม
  - `POST /api/v1/jobs/:id/tasks` — เพิ่ม Task เอง
  - `POST /api/v1/jobs/:id/tasks/reorder` — ปรับลำดับ Task
  - `PATCH /api/v1/jobs/:id` — บันทึกมอบหมายช่าง (`assigned_tech`, `step3_confirmed: true`)
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Tabs**:
    - [ ] แท็บ "รอแปลงเป็น Project (Pending Conversion)"
    - [ ] แท็บ "แปลงสำเร็จแล้ว พร้อมจัดสรรช่าง (Converted)"
  - [ ] **ปุ่ม Action**:
    - [ ] ปุ่ม `แปลง BOQ เป็น Task อัตโนมัติ` ➔ เปิด `modal-convert-boq-tasks`
    - [ ] ปุ่ม `จองช่างผ่านระบบ INT` ➔ เปิด `modal-int-technician-booking`
  - [ ] **Conversion List / Grid**:
    - [ ] เลือกรายการคำสั่งซื้อ ➔ แสดงรายการ Tasks ย่อย
    - [ ] กำหนดช่างผู้รับผิดชอบราย Task (Assign Technician)
    - [ ] กำหนดวันเริ่มต้นและวันสิ้นสุดของแต่ละ Task (ใช้ Flatpickr `DD/MM/YYYY`)
    - [ ] คำนวณจำนวนวันทำงานอัตโนมัติ
  - [ ] **ปุ่มยืนยันส่งต่อ**:
    - [ ] ปุ่ม "✓ ยืนยันแผนงานและส่งเข้าตาราง Gantt (Step 4)"
- **Business Rules**:
  - เฉพาะงาน Renovate เท่านั้นที่ต้องผ่าน Step 3 Conversion (Quick Service จะ STAMP ช่างมาจาก INT และข้ามขั้นตอนนี้)
  - การแปลง Task ต้องแยก Task ตามรายการค่าแรงของ BOQ

---

### 1.9 `page-gantt` (Step 4: ติดตั้ง & แผนงาน Gantt — Gantt Projects Timeline & Daily Logs)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`, `QC`
- **API ที่เรียก**:
  - `GET /api/v1/tasks/gantt` — ดึงแผนงาน Gantt รวม
  - `GET /api/v1/jobs/:id/tasks`
  - `PUT /api/v1/jobs/:id/tasks/:taskId` — อัปเดตกำหนดการ/สถานะ Task
  - `GET /api/v1/jobs/:id/daily-logs` — ดึงประวัติบันทึกช่าง
  - `POST /api/v1/jobs/:id/daily-logs` — บันทึกงานช่างประจำวัน
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Toolbar & Time Scale Controls**:
    - [ ] ปุ่มปรับมุมมองเวลา: วัน (Day) / สัปดาห์ (Week) / เดือน (Month)
    - [ ] ปุ่ม "ข้ามไปวันนี้ (Today)"
    - [ ] ปุ่มสลับดูเฉพาะโครงการที่เลือก (Project Dropdown Selector)
    - [ ] กรองสถานะ Task: ทั้งหมด / Pending (น้ำเงิน) / In Progress (เหลือง) / Done (เขียว) / Overdue (แดง) / Rework (ส้ม)
  - [ ] **Gantt Chart Interactive Grid**:
    - [ ] ฝั่งซ้าย: รายชื่อ Task, ช่างผู้รับผิดชอบ, วันเริ่ม-สิ้นสุด, ความคืบหน้า (%)
    - [ ] ฝั่งขวา: แถบสี Timeline Bar ตามสถานะงาน
    - [ ] แถบ Drag/Resize เพื่อปรับวันเริ่ม-สิ้นสุดของ Task
    - [ ] เส้นแสดงเวลาปัจจุบัน (Today Red Line Indicator)
  - [ ] **ปุ่ม "บันทึกช่าง (Daily Work Log)" บนแถบ Task**:
    - [ ] กดแล้วเปิด `modal-daily-work-log` ทันที พร้อมระบุ Task ID และ Job ID อัตโนมัติ
  - [ ] **Subtask Modal Trigger**: ปุ่มจัดการ Subtasks ➔ เปิด `modal-gantt-subtasks`
  - [ ] **ปุ่ม "ส่งตรวจ QC"**: เมื่อทุก Task ใน Gantt เสร็จสิ้น ➔ อัปเดตสถานะเป็น `QC_PENDING` เพื่อส่งต่อ Step 5
- **Business Rules**:
  - รวมศูนย์การบันทึกงานช่างประจำวันไว้ที่จุดเดียวผ่านปุ่มบน Gantt (ยกเลิกหน้าจอแยกเดี่ยว `daily-logs`)
  - เวลาการทำงานต้องใช้รูปแบบ 24 ชั่วโมง (`00:00 - 23:59 น.`) ห้ามมี AM/PM

---

### 1.10 `page-qc` (Step 5: ตรวจรับงาน QC — QC Inspection Online & On-site Audit)
- **Role ที่เข้าถึงได้**: `ADMIN`, `QC`
- **API ที่เรียก**:
  - `GET /api/v1/qc/bookings` — ดึงรายการนัดหมายตรวจ QC
  - `POST /api/v1/qc/bookings/sync-all` — ซิงก์สร้างคิว QC อัตโนมัติล่วงหน้า 5 วันก่อน Task จบ
  - `PUT /api/v1/qc/bookings/:id/confirm` — ยืนยันการตรวจ QC
  - `POST /api/v1/jobs/:id/qc-inspection` — บันทึกผลการตรวจ QC
  - `POST /api/v1/jobs/:id/export-stk` — ส่งผลตรวจและปิดงานเข้าระบบ STK
  - `GET /api/v1/jobs/:id/stk-payload` — ดูข้อมูล Payload STK
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Tabs**:
    - [ ] แท็บ "คิวนัดตรวจ QC (QC Bookings & Alerts)"
    - [ ] แท็บ "คิวตรวจ QC Online (Quick Services Fast-track)"
    - [ ] แท็บ "คิวตรวจ QC On-site (Renovate Projects)"
    - [ ] แท็บ "งานที่ส่งกลับแก้ไข (Rework Queue)"
    - [ ] แท็บ "ผ่านการตรวจแล้ว (QC Passed)"
  - [ ] **Header Actions**:
    - [ ] ปุ่ม `ซิงก์แจ้งเตือนล่วงหน้า 5 วัน` (`syncQCBookings`)
    - [ ] สรุป KPI: รอตรวจวันนี้, ตรวจผ่านรอบแรก, งาน Rework, คะแนนเฉลี่ย QC
  - [ ] **QC Table (List View)**:
    - [ ] คอลัมน์: รหัสคำสั่งซื้อ, ชื่องาน, ลูกค้า, วันนัดตรวจ, ช่างผู้รับผิดชอบ, ช่าง QC Lead, รอบที่ตรวจ (ครั้งที่ 1 / รอบแก้ไข), สถานะผลตรวจ, การกระทำ
  - [ ] **Row Actions**:
    - [ ] ปุ่ม "เริ่มตรวจ QC" ➔ เปิด `modal-qc-job-detail`
    - [ ] ปุ่ม "ดู Payload STK" ➔ เปิด `modal-stk-payload-view`
- **Business Rules**:
  - **Quick Services**: ตรวจแบบ Online จากภาพถ่าย Visit Plan / INT ประเมิน **1 ข้อคำถามเดียวจบกระบวนการ** ("ช่างทำงานได้ตามมาตรฐานการทำงานที่กำหนด")
  - **Renovate Projects**: ประเมินเกณฑ์มาตรฐาน 5 ข้อ (Yes = 5, No = 1)
  - **🚨 กฎเหล็กรอบแก้ไข (Round >= 2 Score Penalty)**:
    - รอบแรก (First-time Pass): ให้คะแนนได้เต็ม 5.0
    - รอบที่ 2 เป็นต้นไป (หลังจากมีการ Rework): แม้จะกดให้ผ่านทุกข้อ ระบบจะ**บังคับล็อกคะแนนที่ 1.0 คะแนนอัตโนมัติ** เสมอ

---

### 1.11 `page-ma-contracts` (บริการหลังการขาย — สัญญา MA & รอบตรวจบำรุงรักษา)
- **Role ที่เข้าถึงได้**: `ADMIN`, `CONTACT_CENTER`
- **API ที่เรียก**:
  - `GET /api/v1/ma-contracts`
  - `GET /api/v1/ma-contracts/:id`
  - `POST /api/v1/ma-contracts`
  - `POST /api/v1/ma-rounds`
  - `PATCH /api/v1/ma-rounds/:id`
  - `GET /api/v1/ma-checklist-templates`
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Action**: ปุ่ม `+ สร้างสัญญา MA ใหม่` ➔ เปิด `modal-create-ma`
  - [ ] **KPI Stat Cards**: สัญญาทั้งหมด (Total Contracts), สัญญาที่ใช้งานอยู่ (Active), รอบที่ถึงกำหนดตรวจเดือนนี้ (Rounds Due), รอบที่เสร็จสมบูรณ์แล้ว (Completed Rounds)
  - [ ] **Filters**: ค้นหาเลขที่สัญญา (`MAC-...`), ชื่อลูกค้า, ไซต์งาน, กรองประเภทบริการ (ล้างแอร์, โซลาร์เซลล์, ประปา, CCTV), กรองสถานะสัญญา (Active, Expired, Completed)
  - [ ] **Contract Accordion / Data Grid**:
    - [ ] แสดงรายละเอียดสัญญา: ลูกค้า, สถานที่, ความถี่ (เช่น ทุก 3 เดือน), จำนวนรอบทั้งหมด (เช่น 4 รอบ/ปี), วันที่เริ่ม-สิ้นสุด
    - [ ] แสดงตารางรอบตรวจ (Rounds List): รอบที่ #, วันที่กำหนดนัด (`DD/MM/YYYY`), วันที่เข้าตรวจจริง, สถานะรอบ (Scheduled / Completed / Overdue), ช่างที่รับผิดชอบ
  - [ ] **Round Actions**:
    - [ ] ปุ่ม "บันทึกผลตรวจรอบ MA" ➔ เปิด `modal-ma-checklist`
    - [ ] ปุ่มเลื่อนนัดหมาย (Reschedule Round)
- **Business Rules**:
  - เมื่อสร้างสัญญา MA ระบบจะคำนวณวันนัดของแต่ละรอบล่วงหน้าอัตโนมัติตาม `frequency_months` และ `total_rounds`
  - เมื่อทุกรอบในสัญญาตรวจเสร็จสมบูรณ์ (`Completed`) สถานะสัญญาหลักจะเปลี่ยนเป็น `Completed` อัตโนมัติ

---

### 1.12 `page-csat` (Step 6: สรุปงานสำเร็จ & ส่งต่อ STK — CSAT & Closeout)
- **Role ที่เข้าถึงได้**: `ADMIN`, `CONTACT_CENTER`
- **API ที่เรียก**:
  - `GET /api/v1/jobs?status=QC_PASSED,AFTER_SALE,CLOSED`
  - `POST /api/v1/jobs/:id/after-sale/csat` — บันทึกผลการประเมิน CSAT
  - `POST /api/v1/jobs/:id/export-stk` — ส่งข้อมูลปิดงานเข้าระบบ STK
  - `GET /api/v1/jobs/:id/stk-payload` — ดู JSON Payload ส่ง STK
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Stats**: งานรอส่ง STK, งานส่ง STK สำเร็จแล้ว, คะแนน CSAT เฉลี่ย (1–5 ดาว), อัตราความพึงพอใจ (%)
  - [ ] **Filters**: ค้นหารหัสงาน/ลูกค้า/เบอร์โทร, กรองระดับคะแนน CSAT (5 ดาว, 4 ดาว, ต่ำกว่า 3 ดาว), กรองประเภทบริการ
  - [ ] **Completed Orders Table (List View)**:
    - [ ] คอลัมน์: รหัสคำสั่งซื้อ (Job No), วันที่ส่งมอบงาน, ลูกค้า & เบอร์โทร, คะแนน QC, สถานะ STK (`DELIVERED`), เลขอ้างอิง STK (`STK-QC-...`), คะแนน CSAT (แสดงดาว 1-5), การกระทำ
  - [ ] **Row Actions**:
    - [ ] ปุ่ม "บันทึกผลโทรสอบถาม CSAT" ➔ เปิด `modal-csat-eval`
    - [ ] ปุ่ม "ดู Payload STK" ➔ เปิด `modal-stk-payload-view`
    - [ ] ปุ่ม "รายละเอียดการปิดงาน" ➔ เปิด `modal-job-close-detail`
- **Business Rules**:
  - การปิดงานและส่งต่อ STK เกิดขึ้นหลังผ่าน QC เรียบร้อยแล้ว (สถานะ `QC_PASSED` ➔ `CLOSED`)
  - คะแนน CSAT และความคิดเห็นของลูกค้าจะถูกบันทึกเพื่อใช้เป็นสถิติบริการหลังการขาย

---

### 1.13 `page-completed-jobs` (รายงานที่สำเร็จแล้ว — Shadowed by `page-csat`)
- **Role ที่เข้าถึงได้**: `ADMIN`, `CONTACT_CENTER`
- **API ที่เรียก**:
  - `GET /api/v1/jobs` (Completed jobs subset)
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] ปุ่ม Export Excel / CSV สำหรับสรุปงานปิดประจำเดือน
  - [ ] ตารางงานสำเร็จย้อนหลัง 6 เดือน
- **Business Rules & Audit Note**:
  - **🚨 ฟีเจอร์ที่ซ้ำซ้อน (Redundant)**: ใน `app.js` ฟังก์ชัน `app.navigate('completed-jobs')` ทำงานโดย Redirect เข้าหน้า `csat` ทันที (`targetViewId = (view === 'completed-jobs') ? 'csat' : view;`) ทำให้ HTML ของหน้านี้ใน `index.html` ไม่เคยถูกแสดงผลจริงต่อผู้ใช้ แนะนำให้รวมเข้ากับหน้า `/completed` ใน v2 เพียงจุดเดียว

---

### 1.14 `page-project-pricing` (บันทึกราคาโครงการ — แยกทุนและราคาขาย)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`
- **API ที่เรียก**:
  - `GET /api/v1/jobs`
  - `PATCH /api/v1/jobs/:id` — บันทึกราคาขาย, ต้นทุน, กำไร
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header Stats**: มูลค่างานรวม (Revenue), ต้นทุนรวม (Total Cost), กำไรขั้นต้นรวม (Gross Profit ฿), อัตรากำไรเฉลี่ย (Gross Margin %)
  - [ ] **Filters**: ค้นหารหัสงาน/ลูกค้า, กรองสถานะการบันทึกราคา (บันทึกครบแล้ว / รอดำเนินการ)
  - [ ] **Pricing Table (List View)**:
    - [ ] คอลัมน์: รหัสคำสั่งซื้อ, ลูกค้า, บริการ, ยอดขายตามสัญญา (Sale Price), ต้นทุนค่าแรง/วัสดุ (Cost Price), ส่วนต่างกำไร (Gross Profit), % Margin, สถานะราคา, การกระทำ
  - [ ] **Row Action**: ปุ่ม "บันทึกราคา/ปรับปรุงต้นทุน" ➔ เปิด `modal-project-pricing`
- **Business Rules**:
  - สูตรคำนวณ:
    - $\text{Gross Profit} = \text{Sale Price} - \text{Cost Price}$
    - $\text{Margin \%} = \frac{\text{Gross Profit}}{\text{Sale Price}} \times 100$

---

### 1.15 `page-report` (ภาพรวมผลการดำเนินงาน & รายงาน Audit)
- **Role ที่เข้าถึงได้**: `ADMIN`, `AE`
- **API ที่เรียก**:
  - `GET /api/v1/jobs/summary`
  - `GET /api/v1/jobs`
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Report Sub-navigation**:
    - [ ] แท็บ "ภาพรวมผลการดำเนินงาน (Performance Overview)"
    - [ ] แท็บ "สรุปคำสั่งซื้อทั้งหมด (Master Orders)"
    - [ ] แท็บ "รายงานตรวจสอบขั้นตอน (Step Audit Report Modal)"
  - [ ] **Interactive Charts**:
    - [ ] กราฟยอดขายและจำนวนงานแยกตามเดือน
    - [ ] กราฟสัดส่วนงาน Quick Services vs Renovate Projects
    - [ ] กราฟ QC Pass Rate (ผ่านรอบแรก vs Rework)
    - [ ] กราฟคะแนน CSAT เฉลี่ยแยกตามทีมช่าง
  - [ ] **Export Reports**: ปุ่มส่งออกรายงานภาพรวมเป็น PDF และ Excel
- **Business Rules**:
  - กราฟและตัวเลขทั้งหมดต้องคำนวณจากข้อมูลจริงของฐานข้อมูล

---

### 1.16 `page-settings` (ตั้งค่าระบบ & API Configurations)
- **Role ที่เข้าถึงได้**: `ADMIN`
- **API ที่เรียก**:
  - `GET /api/v1/staging/config`
  - `POST /api/v1/staging/config/auto-convert`
  - LocalStorage / `sys_config` API
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **หมวดตั้งค่าการเชื่อมต่อ API (API Endpoints)**:
    - [ ] URL สำหรับระบบ INT (`INT_API_ENDPOINT`)
    - [ ] URL สำหรับระบบ BMT (`BMT_API_ENDPOINT`)
    - [ ] URL สำหรับระบบ STK (`STK_API_ENDPOINT`)
  - [ ] **หมวดตั้งค่าการทำงาน (Operational Rules)**:
    - [ ] รัศมี Check-in หน้างาน (Geofence Radius, ค่าเริ่มต้น 400 เมตร)
    - [ ] จำนวนรูปถ่ายขั้นต่ำในการสำรวจ (ค่าเริ่มต้น 5 รูป)
    - [ ] จำนวนวันแจ้งเตือนก่อนส่งตรวจ QC (ค่าเริ่มต้น 5 วัน)
    - [ ] สวิตช์เปิด/ปิด Auto-Convert Staging Orders
  - [ ] **หมวดตั้งค่า SLA (SLA Configuration)**:
    - [ ] กำหนดชั่วโมง SLA สำหรับ Step 1 ถึง Step 6 (ผ่าน `modal-sla-config`)
    - [ ] กำหนดเกณฑ์แจ้งเตือน Warning Threshold (%)
- **Business Rules**:
  - เฉพาะผู้ดูแลระบบบทบาท `ADMIN` เท่านั้นที่มีสิทธิ์เข้าถึงและแก้ไข

---

### 1.17 `page-faq` (คลังความรู้ & คู่มือขั้นตอนการทำงาน — Knowledge Management KM)
- **Role ที่เข้าถึงได้**: ทุก Role (`ADMIN`, `AE`, `QC`, `CONTACT_CENTER`)
- **API ที่เรียก**:
  - `GET /doc/:filename` — ดึงไฟล์คู่มือ Markdown จากเซิร์ฟเวอร์
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Search Box**: ค้นหาบทความคู่มือ, คำถามที่พบบ่อย (FAQ), คำค้นในกระบวนการทำงาน
  - [ ] **หมวดหมู่บทความคู่มือ (Knowledge Categories)**:
    - [ ] หมวด 1: แดชบอร์ดและการจัดการผู้ใช้งาน
    - [ ] หมวด 2: Step 1 รับเรื่อง & เปิดใบงาน (Survey)
    - [ ] หมวด 3: Step 2 ออกแบบ & แปลนติดตั้ง (Blueprints & CAD)
    - [ ] หมวด 4: Step 3 นำ BOQ เข้าระบบและแปลงเป็น Project
    - [ ] หมวด 5: Step 4 ติดตั้ง & แผนงาน Gantt และบันทึกช่าง
    - [ ] หมวด 6: Step 5 ตรวจรับงาน QC (Online & On-site)
    - [ ] หมวด 7: Step 6 สรุปงานสำเร็จ & ส่งต่อ STK / CSAT
    - [ ] หมวด 8: การเข้าหน้างานและ Check-in GPS
    - [ ] หมวด 9: การบันทึกราคาโครงการ (แยกทุนและราคาขาย)
  - [ ] **Card ลิงก์เปิดอ่านคู่มือ**: คลิกการ์ดแล้วเปิดอ่านผ่านโมดอล Markdown Viewer (`modal-training-viewer`) พร้อมรองรับแผนภาพ Mermaid, รูปภาพประกอบ, และบล็อกข้อความแจ้งเตือน (Alerts)
- **Business Rules**:
  - **Zero Description UI Rule**: ใน v2 ข้อมูลคำแนะนำและวิธีใช้งานทั้งหมดจะถูกรวบรวมไว้ที่หน้านี้ (`/km`) โดยมีไอคอน 📖 ในแต่ละหน้าสำหรับเปิดบทความที่เกี่ยวข้องโดยตรง

---

### 1.18 `page-api-logs` (Inbound API Monitor & Logs)
- **Role ที่เข้าถึงได้**: `ADMIN`
- **API ที่เรียก**:
  - `GET /api/v1/system/api-logs` (รองรับ pagination, query status: all, 2xx, 4xx, 5xx, search)
  - `DELETE /api/v1/system/api-logs` — ล้างประวัติ Log
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Header KPI Cards**: คำขอทั้งหมด (Total Requests), สำเร็จ (2xx Success), ผิดพลาดฝั่งไคลเอนต์ (4xx Client Error), ผิดพลาดฝั่งเซิร์ฟเวอร์ (5xx Server Error), เวลาตอบสนองเฉลี่ย (Avg Response Time ms)
  - [ ] **Filters & Search**:
    - [ ] ค้นหาตาม Path (`/api/v1/...`), IP Address, Log ID
    - [ ] กรองตาม Status Code Tabs: ทั้งหมด / 2xx / 4xx / 5xx
    - [ ] ปุ่ม Auto-refresh ทุก 10 วินาที พร้อมปุ่ม Pause/Play
  - [ ] **API Logs Table (List View)**:
    - [ ] คอลัมน์: เวลา (วันเวลา 24 ชม.), Method (GET, POST, PATCH, DELETE พร้อมสีแยก), Path ที่เรียก, สถานะ HTTP Status Badge, เวลาประมวลผล (Duration ms), Client IP, การกระทำ
  - [ ] **Row Action**: ปุ่มดูรายละเอียด ➔ เปิด `modal-api-log-detail` แสดง Request Headers, Request Body, Response Body แบบ JSON syntax highlighting
  - [ ] **ลิงก์ภายนอก**: ปุ่มเปิดหน้า Standalone Monitor (`/apimonitor`)
- **Business Rules**:
  - ข้อมูลรหัสผ่านใน Request Body ต้องถูก Mask ด้วย `******` เสมอ
  - ล็อกจำนวนบันทึกในหน่วยความจำและตัดทอน Response Body ไม่ให้กิน Memory เกินขีดจำกัด

---

### 1.19 `page-users` (จัดการผู้ใช้งาน — User Management)
- **Role ที่เข้าถึงได้**: `ADMIN` เท่านั้น
- **API ที่เรียก**:
  - `GET /api/v1/users`
  - `POST /api/v1/users`
  - `PATCH /api/v1/users/:id`
  - `POST /api/v1/users/:id/reset-password`
  - `DELETE /api/v1/users/:id` (Soft delete / ระงับบัญชี)
  - `GET /api/v1/auth/login-logs`
- **ฟีเจอร์ / ปุ่ม / ตัวกรอง**:
  - [ ] **Stat Summary Cards**: แสดงจำนวนผู้ใช้รวม และจำนวนแยกตาม 4 Role (Admin, AE, QC, Contact Center) คลิกการ์ดเพื่อกรองตารางทันที
  - [ ] **Role Pill Filters**: แท็บเลือกบทบาท (ทั้งหมด, Admin, AE, QC, Contact Center) พร้อมตัวเลขกำกับ
  - [ ] **Status Filter Dropdown**: ทั้งหมด / เปิดใช้งานอยู่ (Active) / ปิดใช้งาน (Inactive)
  - [ ] **Search Box**: ค้นหาแบบเรียลไทม์จาก ชื่อ-นามสกุล, Username, Email, หรือรหัสพนักงาน (`USR-XXX`)
  - [ ] **Action Buttons**:
    - [ ] ปุ่ม `+ เพิ่มผู้ใช้งานใหม่` ➔ เปิด `modal-user-form` (โหมด Create)
    - [ ] ปุ่ม `ประวัติเข้าสู่ระบบ (Login Audit Trail)` ➔ เปิด `modal-user-login-logs`
    - [ ] ปุ่มรีเฟรชข้อมูล (Refresh)
  - [ ] **Users Table (List View)**:
    - [ ] คอลัมน์: รหัสผู้ใช้, ชื่อ-นามสกุล (พร้อม Avatar วงกลมสีตาม Role), Username, Email, บทบาท (วาดด้วย `roleBadge(role)`), สถานะการใช้งาน (จุดสีเขียวกะพริบ/จุดเทา), เข้าสู่ระบบล่าสุด (วันเวลา 24 ชม.), การกระทำ (Actions)
  - [ ] **Row Actions**:
    - [ ] ปุ่ม "แก้ไขข้อมูล" ➔ เปิด `modal-user-form` (โหมด Edit, ล็อกช่อง Username ไม่ให้แก้)
    - [ ] ปุ่ม "รีเซ็ตรหัสผ่าน" ➔ เปิด `modal-user-reset-pwd`
    - [ ] ปุ่ม "ระงับ/เปิดใช้งานบัญชี" ➔ เปิด `modal-user-toggle-status` (ซ่อนปุ่มสำหรับ Admin หลัก `admin`)
- **Business Rules**:
  - **Soft Delete Only**: การลบผู้ใช้เป็นการตั้งค่า `is_active: false` ห้ามลบแถวออกจากฐานข้อมูลจริง
  - **Protected Admin Account**: ไม่อนุญาตให้ปิดใช้งานหรือลดบทบาทบัญชีผู้ดูแลระบบหลัก (`admin` / `USR-001`)

---

## 2. รายการตรวจสอบโมดอลสำคัญ (Modals Checklist)

| # | รหัสโมดอล | ชื่อโมดอล / หน้าที่การทำงาน | API ที่เกี่ยวข้อง | สิทธิ์ Role | ฟีเจอร์ที่ต้องมี |
|:-:|---|---|---|---|---|
| 1 | `modal-create-job` | สร้างคำสั่งซื้อใหม่ (Quick / Renovate) | `POST /api/v1/jobs` | ADMIN, AE | - [ ] เลือกประเภท Quick/Renovate, กรอกชื่อลูกค้า, เบอร์โทร, ที่อยู่, พิกัด GPS, บริการ, นัดหมาย |
| 2 | `modal-create-ma` | สร้างสัญญา MA บริการหลังการขาย | `POST /api/v1/ma-contracts` | ADMIN, CC | - [ ] กรอกสัญญา, เลือกบริการ, กำหนดความถี่รอบ (เดือน), จำนวนรอบ, ระบบคำนวณรอบนัดหมายอัตโนมัติ |
| 3 | `modal-ma-checklist` | ตรวจเช็คลิสต์รอบสัญญา MA | `PATCH /api/v1/ma-rounds/:id` | ADMIN, CC | - [ ] โหลด Template เช็คลิสต์ (แอร์/โซลาร์/ประปา/CCTV), ติ๊กผ่าน/ไม่ผ่านแต่ละข้อ, แนบรูป Before/After |
| 4 | `modal-upload-photo` | อัปโหลดรูปภาพหน้างานเพิ่มเติม | `POST /api/v1/jobs/:id/photos` | ADMIN, AE, QC | - [ ] เลือกไฟล์/ถ่ายรูป, บีบอัด Client-side 1200px 0.8, ระบุคำบรรยายรูปภาพ |
| 5 | `modal-job-preview-detail` | พรีวิวรายละเอียดงานด่วน (Job 360 Popup) | `GET /api/v1/jobs/:id` | ทุก Role | - [ ] สรุปข้อมูลลูกค้า, วันนัด, BOQ, แผนงาน, รูปถ่าย 5 ช่อง, แถบสถานะ, ปุ่มทางลัดไปหน้าทำงาน |
| 6 | `modal-qc-job-detail` | ฟอร์มตรวจรับรองคุณภาพ QC (Online / On-site) | `POST /api/v1/jobs/:id/qc-inspection` | ADMIN, QC | - [ ] ตรวจ Quick: 1 ข้อคำถาม; ตรวจ Renovate: 5 ข้อคำถาม; ปุ่มอนุมัติผ่าน QC; ปุ่มส่งกลับแก้ไข (Rework) ล็อกคะแนน 1.0 |
| 7 | `modal-stk-payload-view` | พรีวิว JSON Payload ส่งระบบ STK | `GET /api/v1/jobs/:id/stk-payload` | ทุก Role | - [ ] แสดงข้อมูล JSON โครงสร้าง STK Outbound พร้อมปุ่มคัดลอก (Copy Payload) |
| 8 | `modal-photo-lightbox` | Lightbox ดูภาพถ่ายขนาดเต็ม | - (Client Image) | ทุก Role | - [ ] แสดงรูปขนาดใหญ่คมชัด, คำบรรยาย, ชื่อช่าง, วันเวลาถ่าย, ปุ่มปิด/Next/Prev |
| 9 | `modal-csat-eval` | บันทึกผลโทรสอบถามความพึงพอใจ CSAT | `POST /api/v1/jobs/:id/after-sale/csat` | ADMIN, CC | - [ ] ให้คะแนน 1-5 ดาว, บันทึกข้อเสนอแนะลูกค้า, ผู้บันทึก, วันเวลาโทร, ปุ่มปิดงานสำเร็จ |
| 10 | `modal-job-close-detail` | รายละเอียดสรุปการปิดงานโครงการ | `POST /api/v1/jobs/:id/export-stk` | ADMIN, CC | - [ ] สรุปภาพรวมโครงการก่อนปิดงาน, ยอดเงิน, ประวัติ QC, อ้างอิงระบบภายนอก |
| 11 | `modal-create-ticket` | สร้าง Ticket & แนบสลิปชำระเงิน | `POST /api/v1/tickets`, `PATCH /api/v1/jobs/:id` | ADMIN, AE | - [ ] กรอกเลข Ticket, ยอดเงินชำระ, วันเวลาชำระ, แนบไฟล์สลิป/ใบเสร็จ, แสดงตัวอย่างสลิป |
| 12 | `modal-ticket-receipt-lightbox` | Lightbox ดูสลิปและใบเสร็จขนาดเต็ม | - (Client Image) | ทุก Role | - [ ] พรีวิวรูปภาพสลิป/ใบเสร็จขนาดใหญ่ |
| 13 | `modal-quick-attach` | แนบไฟล์ด่วนในหน้ารายการ | `POST /api/v1/jobs/:id/designs` | ADMIN, AE | - [ ] แนบไฟล์ด่วนระบุประเภทไฟล์และหมายเหตุ |
| 14 | `modal-unified-order-studio` | One-Stop Order Studio รวมทุก Step ในจุดเดียว | หลาย APIs | ADMIN, AE | - [ ] รวม Step 1-6 ในโมดอลเดียว (ระบุในข้อ 3 ว่าซ้ำซ้อน) |
| 15 | `modal-upload-blueprint` | อัปโหลดไฟล์แบบแปลน CAD/PDF | `POST /api/v1/blueprints` | ADMIN, AE | - [ ] เลือกไฟล์ (.dwg, .pdf, .png), ระบุเลขเวอร์ชัน, โซนพื้นที่, หมายเหตุ |
| 16 | `modal-confirm-proceed-boq` | ยืนยันการส่งต่อข้อมูล BOQ | `PATCH /api/v1/jobs/:id` | ADMIN, AE | - [ ] แสดงผลสรุปยอดเงินและยืนยันการเปลี่ยนสถานะสู่ขั้นตอนถัดไป |
| 17 | `modal-manage-boq` | แก้ไขตาราง BOQ รายงาน (BOQ Modal Editor) | `POST /api/v1/jobs/:id/boq` | ADMIN, AE | - [ ] เพิ่ม/ลบแถวรายการ, แยกหมวดค่าแรง/วัสดุ, คำนวณ Subtotal, ใส่ Discount, สรุป Grand Total (No VAT) |
| 18 | `modal-import-boq` | นำเข้า BOQ จากไฟล์ Excel / CSV | `POST /api/v1/jobs/:id/boq/upload-file` | ADMIN, AE | - [ ] ลากวางไฟล์ Excel/CSV, พรีวิวตารางข้อมูลก่อนกดยืนยันนำเข้า |
| 19 | `modal-convert-boq-tasks` | แปลงรายการ BOQ เป็น Tasks และจัดสรรช่าง | `POST /api/v1/jobs/:id/tasks/import-boq` | ADMIN, AE | - [ ] เลือกรายการค่าแรง, สร้างเป็น Task กิจกรรม, กำหนดช่าง, กำหนดวันเริ่ม-เสร็จ |
| 20 | `modal-int-technician-booking` | จองช่างและเชื่อมโยงระบบ INT | `POST /api/v1/jobs/:id` | ADMIN, AE | - [ ] เลือกทีมช่างจากลิสต์ภายนอก, เวลาเข้างาน, บันทึกหมายเลข Booking |
| 21 | `modal-close-lost` | ปิดงานกรณีลูกค้ายกเลิก (Close Lost) | `PATCH /api/v1/jobs/:id` | ADMIN, AE | - [ ] ระบุเหตุผลการยกเลิก (ราคาแพง, เปลี่ยนใจ, ติดต่อไม่ได้), ปรับสถานะเป็น CANCELLED |
| 22 | `modal-save-boq-schedule` | กำหนดตารางเวลางานใน BOQ | `PATCH /api/v1/jobs/:id` | ADMIN, AE | - [ ] ระบุวันเริ่ม-สิ้นสุดของรายการใน BOQ |
| 23 | `modal-user-form` | ฟอร์มเพิ่ม/แก้ไขผู้ใช้งานระบบ | `POST/PATCH /api/v1/users` | ADMIN | - [ ] ชื่อ-นามสกุล, Username, Email, Role (4 บทบาท), รหัสผ่าน, สวิตช์ Active |
| 24 | `modal-user-reset-pwd` | รีเซ็ตรหัสผ่านผู้ใช้งาน | `POST /api/v1/users/:id/reset-password` | ADMIN | - [ ] รหัสผ่านใหม่ (อย่างน้อย 6 ตัว), ยืนยันรหัสผ่าน, ปุ่มเปิด/ปิดตาดูรหัส |
| 25 | `modal-my-profile` | ดูโปรไฟล์ส่วนตัว & เปลี่ยนรหัสผ่านของตนเอง | `PATCH /api/v1/auth/profile`, `POST /api/v1/auth/change-password` | ผู้ใช้ทุกคน | - [ ] แก้ไขชื่อ/อีเมล, ระบุรหัสผ่านเดิมและรหัสผ่านใหม่เพื่อเปลี่ยนรหัส |
| 26 | `modal-user-toggle-status` | ยืนยันระงับ/เปิดใช้งานบัญชี (Soft Delete) | `DELETE/PATCH /api/v1/users/:id` | ADMIN | - [ ] กล่องข้อความเตือนผลกระทบ, ปุ่มยืนยันระงับ (สีแดง) หรือยืนยันเปิดใช้งาน (สีเขียว) |
| 27 | `modal-user-login-logs` | ประวัติการเข้าสู่ระบบ (Login Audit Trail) | `GET /api/v1/auth/login-logs` | ADMIN | - [ ] แสดง 100 รายการล่าสุด: วันเวลา 24 ชม., ผู้ใช้, IP Address, Browser, ผล Success/Fail |
| 28 | `modal-sla-config` | ตั้งค่าชั่วโมง SLA แต่ละขั้นตอน | LocalStorage (`pmt_sla_config`) | ADMIN | - [ ] ปรับจำนวนชั่วโมง SLA Step 1-6, กำหนด Warning % Threshold |
| 29 | `modal-step-audit-report` | รายงานตรวจสอบเวลาดำเนินงานแต่ละขั้นตอน | `GET /api/v1/jobs/:id` | ทุก Role | - [ ] ไทม์ไลน์เปรียบเทียบเวลาจริงเทียบกับ SLA ของแต่ละขั้นตอน |
| 30 | `modal-daily-work-log` | บันทึกงานช่างประจำวัน (Daily Technician Log) | `POST /api/v1/jobs/:id/daily-logs` | ADMIN, QC | - [ ] วันที่ทำงาน, เวลา 24 ชม. (เริ่ม-เสร็จ), ผู้บันทึก, เนื้องาน, ปัญหา, **ช่องรูป 5 รูป** + Lightbox |
| 31 | `modal-gantt-subtasks` | จัดการ Subtasks ย่อยในแผนงาน Gantt | `PUT /api/v1/jobs/:id/tasks/:taskId` | ADMIN, AE, QC | - [ ] เพิ่ม/ลบ/ทำเครื่องหมายเสร็จสิ้นงานย่อยใน Task |
| 32 | `modal-project-pricing` | บันทึกต้นทุนและราคาขายโครงการ | `PATCH /api/v1/jobs/:id` | ADMIN, AE | - [ ] ระบุราคาขายตามสัญญา, ระบุต้นทุนรวม, คำนวณ Gross Profit และ % Margin เรียลไทม์ |
| 33 | `modal-api-log-detail` | ดูรายละเอียด Inbound API Log เชิงลึก | - (Client Object) | ADMIN | - [ ] แสดง Full Request Headers, Request Body, Response Body, Status, Latency |
| 34 | `#login-overlay` | เกราะป้องกันด่านแรก (Authentication Guard) | `POST /api/v1/auth/login` | ไม่จำกัด | - [ ] บล็อกหน้าจอทั้งหมดเมื่อยังไม่ได้ Login, Autofocus ช่อง username, ปุ่มจำลอง Demo Account |
| 35 | `#modal-training-viewer` | หน้าต่างอ่านคู่มือฝึกอบรมและคลังความรู้ (KM) | `GET /doc/:filename` | ทุก Role | - [ ] Render Markdown แบบสมบูรณ์, แสดงรูปภาพ, Mermaid Diagram, Alerts, ลิงก์เปิดไฟล์เต็ม |

---

## 3. ฟีเจอร์ที่ซ้ำซ้อน / ควรพิจารณาปรับปรุงใน v2 (Recommendations for Decision)

จากการตรวจสอบโค้ดอย่างละเอียด พบจุดที่ซ้ำซ้อนหรือไม่ได้ใช้งานจริง ซึ่งเสนอให้ผู้ใช้งานพิจารณาตัดทิ้งหรือรวมจุดการทำงานใน v2 ดังนี้:

1. **`page-completed-jobs` ซ้ำซ้อนกับ `page-csat` 100%**:
   - ใน `app.js` ฟังก์ชัน `app.navigate('completed-jobs')` ทำงานโดย Redirect เข้าหน้า `csat` ทันที ทำให้ HTML ใน `index.html` ของ `page-completed-jobs` (~120 บรรทัด) กลายเป็น Dead Code
   - **ข้อเสนอแนะ**: ใน v2 ยุบรวมเหลือหน้าเดียวคือ `/completed` (Step 6 ปิดงาน & ส่ง STK)
2. **`modal-unified-order-studio` ขนาดใหญ่เกินความจำเป็น (~600 บรรทัดใน DOM)**:
   - เป็นโมดอลที่พยายามรวม Step 1 ถึง Step 6 ไว้ในการ์ดเดียว แต่ข้อมูลและฟังก์ชันไปซ้ำซ้อนกับหน้ารายละเอียดงาน (`page-job-detail`), โมดอล BOQ, และโมดอล QC ทำให้เกิดบั๊กค่า ID ชนกันบ่อยครั้ง
   - **ข้อเสนอแนะ**: ใน v2 ใช้การทำงานแบบ Master/Detail บน-ล่าง (Lark-style) โดยเปิดรายละเอียดงานใน Detail Grid ด้านล่าง แทนการเปิดโมดอลซ้อนโมดอล
3. **การแยก Lightbox ซ้ำซ้อน (`modal-photo-lightbox` กับ `modal-ticket-receipt-lightbox`)**:
   - ทั้ง 2 โมดอลทำหน้าที่เดียวกันคือขยายรูปภาพขนาดใหญ่
   - **ข้อเสนอแนะ**: ใน v2 ใช้คอมโพเนนต์ `<Lightbox />` ตัวเดียวร่วมกันทั่วทั้งระบบ
4. **การจัดเก็บ SLA Config ใน `localStorage` แทนฐานข้อมูล PostgreSQL**:
   - `modal-sla-config` บันทึกค่าลงใน `localStorage.setItem('pmt_sla_config')` ทำให้ผู้ใช้ต่างเครื่องมองเห็นค่า SLA ไม่เท่ากัน
   - **ข้อเสนอแนะ**: ใน v2 ย้ายค่า SLA ไปเก็บในตาราง `sys_config` ของ PostgreSQL ผ่าน API กลาง
5. **Endpoint ทดสอบระบบ Dev ใน `server.ts`**:
   - มี endpoint เช่น `POST /api/v1/jobs/reset`, `POST /api/v1/jobs/reset-status`, `POST /api/v1/system/wipe-transactions`
   - **ข้อเสนอแนะ**: คงไว้เฉพาะใน Dev Server (`vibepmt.online`) และต้องมี Guard ตรวจสอบไม่ให้บุคคลทั่วไปหรือ Production เรียกใช้ได้เด็ดขาด
