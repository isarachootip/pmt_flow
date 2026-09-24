# PMT Flow v2 — Design System (Lark-inspired, Clean Light)

> ห้ามใช้สี/ขนาดที่ไม่มีในไฟล์นี้ — ถ้าจำเป็นต้องเพิ่ม ให้เพิ่มเป็น token ที่นี่ก่อน

## 1. Design Tokens (`web/src/styles/tokens.css`)

```css
:root {
  /* Brand */
  --primary: #3370FF;          /* ปุ่มหลัก ลิงก์ ไอคอน active */
  --primary-hover: #245BDB;
  --primary-soft: #E1EAFF;     /* พื้น pill เมนูที่เลือก, badge ฟ้า */
  --primary-softer: #F0F4FF;

  /* Surface */
  --bg: #FFFFFF;
  --bg-subtle: #F7F8FA;        /* พื้นหลังส่วน content รอง / hover แถวตาราง */
  --hero-gradient: linear-gradient(180deg, #EAF0FF 0%, #F4F6FF 55%, #FFFFFF 100%);
  --card: #FFFFFF;
  --border: #DEE0E3;
  --border-soft: #EFF0F1;

  /* Text  (กฎ: ข้อมูลสำคัญ = ดำ) */
  --text: #000000;             /* ข้อมูล ตาราง ฟอร์ม หัวข้อ สถานะ */
  --text-secondary: #4E5969;   /* label เล็กเท่านั้น (หัว KPI, หมวด sidebar, บรรทัดรอง) — ไม่ใช้ทำคำอธิบาย */
  --text-placeholder: #86909C;
  --text-on-primary: #FFFFFF;

  /* Status = สีของ "จุด" และแถบ Gantt เท่านั้น — ตัวอักษรสถานะเป็นสีดำเสมอ */
  --st-pending:#245BDB;    /* PENDING / รอดำเนินการ */
  --st-progress:#F5A623;   /* IN_PROGRESS */
  --st-done:#0F7B3F;       /* DONE / QC PASS */
  --st-overdue:#D12D2D;    /* OVERDUE / FAIL */
  --st-rework:#D25F00;     /* REWORK */
  --st-neutral:#86909C;    /* DRAFT / CLOSED */

  /* Shape & Depth */
  --radius-sm: 8px;  --radius-md: 12px;  --radius-lg: 16px;  --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgba(31,35,41,.04), 0 4px 16px rgba(31,35,41,.04);
  --shadow-hover: 0 2px 4px rgba(31,35,41,.06), 0 12px 32px rgba(31,35,41,.08);
  --shadow-pop: 0 8px 24px rgba(31,35,41,.12);

  /* Layout */
  --topbar-h: 64px;  --sidebar-w: 248px;  --content-max: 1360px;
}
```

## 2. Typography
- ฟอนต์: `"Inter", "IBM Plex Sans Thai", "Noto Sans Thai", system-ui, sans-serif` (Google Fonts, weight 400/500/600)
- Scale:
  | ใช้กับ | ขนาด / line-height / weight |
  |---|---|
  | Page title (H1) | 32 / 40 / 600 |
  | Section title (H2) | 20 / 28 / 600 |
  | Card title | 17 / 24 / 600 |
  | Body | 15 / 24 / 400 |
  | Table / form | 14 / 22 / 400 |
  | Caption / label เล็ก | 13 / 20 / 500 |
  | Sidebar section label | 13 / 20 / 500, UPPERCASE, `--text-secondary` |
- ตัวเลข (ยอดเงิน, KPI) ใช้ `font-variant-numeric: tabular-nums`

## 3. Spacing & Grid
- ระบบ 4/8 px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- Content padding: 32px (desktop), 16px (มือถือ)
- ระยะระหว่างการ์ด: 24px · Grid การ์ด: 3 คอลัมน์ ≥1280px, 2 คอลัมน์ ≥768px, 1 คอลัมน์มือถือ

## 4. Layout Shell — Grid บน (Master) / Grid ล่าง (Detail) — มาตรฐานทุกหน้า
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Topbar 56px  [Logo] [ค้นหา Ctrl K]                                  [🔔] [Avatar] │
├───────────┬──────────────────────────────────────────────────────────────────────┤
│ Sidebar   │ H1 [📖KM]  [ทั้งหมด 128][ใหม่วันนี้ 12][รอนัด 7][เลยกำหนด 3]  [ส่งออก][+ สร้าง] │
│ 224px     │ [ค้นหา] [chips ตัวกรอง] [คอลัมน์]                         1–20 จาก 128 ‹ › │
│           │ ┌─ GRID บน (Master) ──────────────────────────────────────────────────┐ │
│ ▣ 1 รับงาน │ │ # │ รหัสงาน │ ลูกค้า │ เบอร์ │ บริการ │ ประเภท │ วันนัด │ สถานะ │ ยอด │ AE │ช่าง│QC│ │
│   2 Ticket│ │ 1 │ JOB..128│ สมชาย │ 081.. │ Renov. │ Renov. │ 26/09 │● รอออก│ ... │    │    │  │ │
│   …       │ │▐3▌│ JOB..121│ (แถวที่เลือก: พื้นฟ้าอ่อน, ช่องเลขแถวสีน้ำเงิน)                │ │
│           │ └──────────────────────────────────────────────────────────────────────┘ │
│           │                         ═══ (แถบลากปรับความสูง) ═══                      │
│           │ JOB2609-00121  ลูกค้า · บริการ  ● สถานะ           [เปิดเต็มหน้า][+ เพิ่มแถว] │
│           │ [งาน/Task 5] [BOQ 6] [บันทึกช่าง 3] [QC 2] [การเงิน 2] [แบบติดตั้ง 3] [ประวัติ 4] │
│           │ ┌─ GRID ล่าง (Detail ของแท็บที่เลือก) ─────────────────────────────────┐ │
│           │ │ # │ Task │ ช่าง │ QC │ เริ่ม │ สิ้นสุด │ วัน │ % │ สถานะ                        │ │
│           │ │ 1 │ รื้อถอน │ ... (แก้ไขในเซลล์ได้)                                           │ │
│           │ │   │ รวม / ยอดสุทธิ (แถวสรุป tfoot เฉพาะแท็บที่มีตัวเลข เช่น BOQ, การเงิน)      │ │
│           │ └──────────────────────────────────────────────────────────────────────┘ │
└───────────┴──────────────────────────────────────────────────────────────────────────┘
```
- **Grid ทั้งบนและล่างใช้ `<DataGrid>` ตัวเดียวกัน** หน้าตาเหมือนกัน: เส้นตารางทุกเซลล์ (`--grid-line: #E5E6EB`), คอลัมน์เลขแถว `#` ติดซ้าย, หัวตาราง sticky + คลิก sort, แถวสูง 36px, font 14
- **Grid บน (Master)**: แถวที่เลือก = พื้น `--primary-softer` + ช่องเลขแถวพื้น `--primary` ตัวขาว; ปุ่ม "คอลัมน์" เลือกซ่อน/แสดง/ลากสลับคอลัมน์ (จำค่าต่อผู้ใช้)
- **แถบลาก (Splitter)**: ปรับความสูง Grid บน (min 120px, max จอ − 260px), จำค่าต่อหน้า (`pmt_master_h_<page>`)
- **Grid ล่าง (Detail)**: แถบหัว 1 บรรทัด (รหัสงาน · ลูกค้า·บริการ · สถานะ · ปุ่ม เปิดเต็มหน้า / เพิ่มแถวของแท็บนั้น) → แท็บแบบ pill มีตัวนับจำนวนแถว → Grid ของรายการย่อย
  - แก้ไขในเซลล์ได้ (inline edit: คลิก/Enter แก้, Tab ไปเซลล์ถัดไป, Esc ยกเลิก) ตามสิทธิ์ Role
  - แถวสรุป (tfoot) ติดล่างเมื่อแท็บมีตัวเลข: BOQ = Subtotal / ส่วนลด / ยอดสุทธิ (No VAT); การเงิน = รวมยอดชำระ
  - เซลล์รูปภาพแสดง thumbnail เล็ก คลิกเปิด Lightbox; เซลล์วันที่/เวลาใช้ DatePicker/TimePicker24 ตอนแก้
- **แท็บมาตรฐานของงาน (Job)**: งาน/Task · BOQ · บันทึกช่าง · QC · การเงิน · แบบติดตั้ง · ประวัติ — หน้า Pipeline แต่ละหน้าเลือกแท็บเริ่มต้นเอง (หน้า QC → แท็บ QC, Ticket → การเงิน, Gantt → งาน/Task)
- คีย์บอร์ด: ↑ ↓ เลื่อนแถว Grid บน (Grid ล่างเปลี่ยนตาม), Enter = เปิดเต็มหน้า
- เปิดหน้าครั้งแรก: เลือกแถวแรกอัตโนมัติ; URL = `/<page>/:id?tab=<tab>`
- Breakpoints: <1100 ซ่อน Sidebar (☰) · <820 หน้าเลื่อนทั้งหน้า: Grid บนสูง 260px, Grid ล่างสูง 360px, ทั้งสองเลื่อนแนวนอนได้
- ไม่มีการ์ด/panel/Card view ในหน้าทำงาน — ทุกข้อมูลเป็น Grid

### (เดิม) โครงหน้าแบบเต็มความกว้าง — ใช้เฉพาะ Dashboard, รายงาน, Gantt timeline
```
┌──────────────────────────────────────────────────────────────────┐
│ Topbar 64px (ขาว, border-bottom)  [Logo PMT Flow] [ค้นหา ⌘K] … [🔔] [Avatar ชื่อ ▾] │
├──────────────┬───────────────────────────────────────────────────┤
│ Sidebar 248  │  Page Header (พื้น --hero-gradient, padding 32/32)  │
│  [ค้นหาเมนู] │   H1 ชื่อหน้า [📖 KM]                   [รอง][ปุ่มหลัก] │
│  ภาพรวม       │   (ไม่มีคำอธิบายใต้หัวข้อ)                            │
│  ▸ แดชบอร์ด   │  ─────────────────────────────────────────────────  │
│  ขั้นตอนงาน    │  Toolbar: [ค้นหา] [ตัวกรอง chips] … [List|Card]     │
│  ▣ 1 รับงาน   │  Content: Table / Card grid                          │
│    2 Ticket  │                                                      │
│  …           │                                                      │
└──────────────┴───────────────────────────────────────────────────┘
```
- Sidebar item: สูง 40px, radius 10px, padding 0 12px, font 15
  - ปกติ: ข้อความดำ, hover พื้น `--bg-subtle`
  - Active: พื้น `--primary-soft`, ข้อความ `--primary`, weight 500 (**เหมือนภาพ Lark "Project management"**)
  - Step ในหมวด Pipeline มีวงกลมเลขเล็ก 20px ด้านหน้า + ตัวนับงานค้าง (badge pill เทาอ่อน) ด้านขวา
- มือถือ (<1024px): Sidebar เป็น Drawer เปิดจากปุ่ม ☰

## 5. Components (สเปกย่อ)

| Component | สเปก |
|---|---|
| **Button** | สูง 36 (sm 32, lg 44), radius 8, primary = `--primary` ขาว, secondary = ขาว + border `--border` ข้อความดำ, ghost = ไม่มีขอบ, danger = `#D12D2D`. ปุ่มหลักแบบ Lark "Download" ใช้ radius pill ได้เฉพาะ Topbar |
| **Input / Select / Textarea** | สูง 36, radius 8, border `--border`, focus ring 2px `--primary-soft` + border `--primary`, ข้อความดำ, placeholder `--text-placeholder`, readonly/disabled ยังเป็นสีดำ (พื้น `--bg-subtle`) |
| **DatePicker** | แสดง/พิมพ์ `DD/MM/YYYY`, ปฏิทิน popover, ค่าที่ส่ง API = ISO `YYYY-MM-DD`, preset: วันนี้/พรุ่งนี้/สัปดาห์นี้ |
| **DateRangePicker** | แสดง `DD/MM/YYYY ถึง DD/MM/YYYY` |
| **TimePicker24** | dropdown ชั่วโมง 00–23 + นาทีทีละ 5, แสดง `HH:mm น.`, ไม่มี AM/PM |
| **Badge (Status)** | **ตัวอักษรสีดำ** font 14/500 + จุดวงกลม 8px สี `--st-*` นำหน้า — ไม่มีพื้นหลัง ไม่มีขอบ ไม่มีตัวอักษรสี |
| **KmLink** | ไอคอนหนังสือ 32px ข้าง H1 ทุกหน้า → เปิด `/km/<page-key>` (แท็บเดิมหรือ Drawer) — เป็นทางเดียวในการดูคำอธิบาย |
| **Card** | ขาว, radius 16, border `--border-soft`, `--shadow-card`, padding 20–24; hover → `--shadow-hover` + translateY(-2px) (เฉพาะการ์ดที่คลิกได้) |
| **Table** | header พื้น `--bg-subtle` font 13/600 ดำ, sticky; แถวสูง 52, border-bottom `--border-soft`, hover `--bg-subtle`; คอลัมน์แรกเป็นรหัสงาน (ลิงก์สีดำ weight 500 → hover `--primary`); ท้ายแถวเป็นเมนู ⋯ ; pagination ล่างขวา (20/50/100) |
| **Tabs** | underline style: ข้อความดำ, active = `--primary` + เส้นใต้ 2px |
| **DataGrid** (ใช้ทั้ง Grid บนและล่าง) | เส้นตารางทุกเซลล์ `--grid-line`, radius กรอบ 10, คอลัมน์ `#` เลขแถวติดซ้าย, หัว sticky + sort, แถว 36px, คอลัมน์ตัวเลขชิดขวา tabular-nums, selectable (บน) / inline-edit + เพิ่ม/ลบแถว (ล่าง), tfoot สรุปยอดติดล่าง, ซ่อน/แสดง/ลากสลับคอลัมน์, virtual scroll เมื่อ > 200 แถว, Skeleton ตอนโหลด, แถวว่าง "ไม่มีข้อมูล" |
| **Splitter** | แถบลากแนวนอนระหว่าง Master/Detail, ขีดจับ 48×4px สี `--border` (hover `--primary`), จำความสูงต่อหน้า |
| **DetailGrid** | ส่วนล่าง: แถบหัว 1 บรรทัด + แท็บ pill (มีตัวนับ) + `<DataGrid>` ของแท็บที่เลือก; ปุ่มเพิ่มแถวเปลี่ยนตามแท็บ |
| **Drawer** | เปิดจากขวา กว้าง 560 (lg 800), header ชื่อ + ปุ่มปิด, footer ปุ่ม [ยกเลิก][บันทึก] ติดล่าง — ใช้เฉพาะฟอร์มสร้าง/แก้ไข ไม่ใช้แสดงรายละเอียด (รายละเอียดอยู่ใน DetailPane) |
| **Modal** | ใช้เฉพาะยืนยัน/ฟอร์มสั้น, กว้าง 480, radius 16, ห้ามซ้อน modal |
| **Toast** | มุมขวาบน, 4 วินาที, success/error/info |
| **EmptyState** | ไอคอนเส้น 48px + คำว่า "ไม่มีข้อมูล" + ปุ่ม action (ไม่มีประโยคอธิบาย) |
| **Skeleton** | ใช้แทน spinner ทุกครั้งที่โหลดตาราง/การ์ด |
| **KPI StatCard** | ป้ายเล็ก (13/500 secondary) → ตัวเลขใหญ่ 28/600 ดำ เท่านั้น (ไม่มีข้อความเสริมใต้ตัวเลข); คลิกแล้วกรองตาราง |
| **Pipeline Stepper** | ใช้ **เฉพาะหน้า Job Full Page** (ห้ามใส่ใน Grid บน/ล่าง) 6 ขั้น แนวนอน วงกลม 28px: เสร็จ = เขียว ✓, ปัจจุบัน = `--primary`, ยังไม่ถึง = border เทา; Quick Service ขั้น 2–4 เป็นเส้นประ |
| **PhotoSlots5** | 5 ช่อง (ก่อนเริ่ม / ระหว่างทำ 1 / ระหว่างทำ 2 / ทดสอบ / เสร็จ) กล่อง 4:3 radius 12 เส้นประ, มี thumbnail + Lightbox |
| **FileVersionList** | แสดง v1, v2, v3 (Current badge), preview PDF/รูปใน Drawer, DWG/SKP = ดาวน์โหลด |

## 6. Page Templates
1. **Grid/Grid Page (ค่าเริ่มต้นของทุกหน้าที่มีรายการ)** — ดูข้อ 4; `<MasterDetailLayout top={<DataGrid/>} bottom={<DetailGrid tabs defaultTab/>} />` ใช้ซ้ำทุกหน้า
2. **Job Full Page (/jobs/:jobNo จากปุ่ม "เปิดเต็มหน้า")** — หน้าเดียวที่มี Stepper + ฟอร์มข้อมูลงาน/ลูกค้าแบบเต็ม ด้านล่างเป็นแท็บ Grid ชุดเดียวกับ DetailGrid
3. **KM Page** (หน้าเดียวที่มีคำอธิบายได้, layout แบบภาพ Lark) — ซ้าย: ค้นหา + รายการหมวดคู่มือ, ขวา: H1 + รายการบทความ → เปิดอ่านบทความ markdown (ปุ่ม "สร้างงานใหม่" ใช้ Drawer เลือกประเภท Renovate / Quick Service / Survey เป็น radio ธรรมดา — ไม่มีแกลเลอรีเทมเพลต)
4. **Board/Timeline Page (Gantt)** — Toolbar (Day/Week/Month, ตัวกรองช่าง/สถานะ) → ซ้ายรายการ Task, ขวาแถบเวลา, bar radius 6 สีตาม status

## 7. Do / Don't
- ✅ ขาว, เส้นบาง, เงาจาง, ไอคอนเส้น, ข้อความสั้นกระชับ, 1 ปุ่มหลักต่อหน้า
- ✅ สีสถานะใช้แค่ "จุด" ของ Badge และแถบ Gantt — ตัวอักษรสถานะดำเสมอ
- ✅ อยากอธิบายอะไร → เขียนลง KM แล้วลิงก์ด้วย KmLink
- ❌ **ไม่มีคำอธิบายบนหน้าจอทำงาน:** ไม่มี subtitle ใต้ H1, ไม่มี helper text ใต้ฟอร์ม, ไม่มี banner/กล่องแนะนำ/tooltip สอนวิธีใช้, ไม่มีข้อความเสริมใต้ KPI, ไม่มีแกลเลอรีเทมเพลต
- ❌ ไม่มีคอลัมน์ "ความคืบหน้า" แบบ stepper ในตาราง
- ❌ ไม่มี gradient เข้ม, ไม่มีธีมทอง-ดำ, ไม่มี emoji ในเมนู/หัวข้อ
- ❌ ไม่มีตัวอักษรเทาจางกับข้อมูล, ไม่มี native date/time input, ไม่มี AM/PM
- ❌ ไม่ใช้ Modal ซ้อน Modal, ไม่ใช้ inline style — ใช้ Tailwind class ที่ map กับ token
