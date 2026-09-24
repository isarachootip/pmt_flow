# PMT Flow v2 — Prompt สั่ง AI ทีละ Phase

วิธีใช้: คัดลอกบล็อก Prompt ของแต่ละ Phase ไปวางให้ AI (Antigravity / Gemini / Claude Code) ทีละ Phase
ทุก Prompt เริ่มด้วย "กติการ่วม" ด้านล่างเสมอ (ถ้า AI ของคุณอ่าน GEMINI.md อัตโนมัติ ให้เพิ่มบรรทัดใน GEMINI.md ว่า "สำหรับงาน v2 ให้อ่าน rebuild/00_MASTER_PLAN.md และ rebuild/01_DESIGN_SYSTEM.md ก่อนเสมอ")

---

## กติการ่วม (แปะหัวทุก Prompt)

```text
คุณกำลังสร้าง Frontend ใหม่ของ PMT Flow (v2) ในโฟลเดอร์ web/ ของ repo C:\atgv\pmt_flow
ก่อนเริ่ม: อ่าน rebuild/00_MASTER_PLAN.md, rebuild/01_DESIGN_SYSTEM.md, rebuild/FEATURE_PARITY.md (ถ้ามี) และเปิด rebuild/03_UI_REFERENCE.html ดูเป็นต้นแบบหน้าตา
กติกา:
- ห้ามแก้ไข public/ (UI เดิม) และห้ามเปลี่ยน contract ของ /api/v1/* — เพิ่ม endpoint ใหม่ได้ถ้าจำเป็น และต้องบอกเหตุผล
- ใช้ token/สี/ขนาดจาก 01_DESIGN_SYSTEM.md เท่านั้น, Light theme เท่านั้น
- วันที่ DD/MM/YYYY, เวลา 24 ชม. ผ่าน <DatePicker/> <TimePicker24/> เท่านั้น ห้าม input type=date/time
- List view เป็นค่าเริ่มต้น, ข้อมูลสำคัญสีดำ #000000, ตัวอักษรสถานะสีดำ + จุดสีเล็กเท่านั้น
- ZERO DESCRIPTION UI: ห้ามมีคำอธิบายบนหน้าจอทำงาน (ไม่มี subtitle ใต้หัวข้อ, helper text, banner, tooltip สอนวิธีใช้, ข้อความใต้ KPI, แกลเลอรีเทมเพลต) — คำอธิบายทั้งหมดเขียนลง KM (doc/*.md → /km) และทุกหน้ามี <KmLink pageKey="..."/> ข้าง H1
- ห้ามใส่คอลัมน์ "ความคืบหน้า" แบบ stepper ในตาราง/รายการ (Stepper ใช้เฉพาะหน้า "เปิดเต็มหน้า" /jobs/:jobNo)
- GRID บน / GRID ล่าง: ทุกหน้าที่มีรายการใช้ <MasterDetailLayout> — บน = <DataGrid> รายการหลัก, ล่าง = <DetailGrid> แท็บของแถวที่คลิก ซึ่งแต่ละแท็บเป็น <DataGrid> ตัวเดียวกัน (แก้ไขในเซลล์ได้ + เพิ่มแถว + แถวสรุปยอด) — ห้ามใช้การ์ด/panel แสดงรายละเอียด, มีแถบลากปรับความสูง, URL = /<page>/:id?tab=, ↑↓ เลื่อนแถว — ดูต้นแบบใน 03_UI_REFERENCE.html (คลิกแถว/สลับแท็บ/ลากแถบได้จริง)
- ไฟล์ละไม่เกิน ~300 บรรทัด แยก component ให้เล็ก, TypeScript strict, ไม่มี any โดยไม่จำเป็น
- ทุกหน้าต้องมีสถานะ loading (Skeleton), empty, error
- ทำงานบน branch v2/phase-<N>, จบแล้วรัน npm run build (ต้องผ่าน) และ npm test
- push ได้แค่ main หลังผ่านการตรวจ — ห้ามแตะ branch production เด็ดขาด
- จบงานให้สรุป: ไฟล์ที่เปลี่ยน, วิธีทดสอบ, สิ่งที่ยังค้าง, และติ๊กรายการใน rebuild/FEATURE_PARITY.md
```

---

## Phase 0 — Audit & Feature Parity (ห้ามแก้โค้ด)

```text
[กติการ่วม]
เป้าหมาย: ทำรายการฟีเจอร์ทั้งหมดของระบบเดิม เพื่อใช้เป็น checklist ว่า v2 ต้องมีครบ
งาน:
1. อ่าน index.html, public/js/*.js, server.ts, database.ts, schema.sql, REQUIREMENTS.md, pmt_flow_skill.md, doc/คู่มือการใช้งาน_*.md
2. สร้าง rebuild/FEATURE_PARITY.md จัดกลุ่มตามหน้า (page-dashboard, page-master-orders, page-jobs, page-job-detail, page-blueprints, page-tickets, page-boq, page-project-conversion, page-gantt, page-qc, page-ma-contracts, page-csat, page-completed-jobs, page-project-pricing, page-report, page-settings, page-faq, page-api-logs, page-users) และ modal สำคัญทั้งหมด
   ในแต่ละหน้าให้ระบุ: ฟีเจอร์/ปุ่ม/ตัวกรอง, API ที่เรียก (method + path), business rule, role ที่เข้าถึงได้ — เป็น checkbox "- [ ]"
3. สร้าง rebuild/API_MAP.md: ทุก endpoint ใน server.ts + request/response ตัวอย่าง (ดูจาก openapi.yaml และโค้ด) + หน้าที่ใช้
4. สร้าง rebuild/BUSINESS_RULES.md: สูตรคำนวณ, state machine สถานะงาน (ค่า status จริงในโค้ด), เงื่อนไข Quick Service vs Renovate, กฎ QC scoring, กฎรูป 5 รูป, รัศมี check-in
5. ระบุ "ฟีเจอร์ที่ซ้ำซ้อน/ไม่ถูกใช้" แยกหัวข้อ เพื่อให้ผมตัดสินใจว่าจะตัดทิ้งหรือไม่
ผลลัพธ์: 3 ไฟล์ใน rebuild/ — ห้ามแก้ไฟล์อื่น
```
**ตรวจรับ:** ทุกหน้าในเมนูเดิมมีในรายการ, ทุก endpoint อยู่ใน API_MAP, คุณอ่านแล้วเข้าใจ → ตัดสินใจรายการที่จะตัดทิ้ง

---

## Phase 1 — Foundation

```text
[กติการ่วม]
เป้าหมาย: ตั้งโปรเจกต์ web/ และให้ Express เสิร์ฟที่ /v2 บน vibepmt.online ได้
งาน:
1. สร้าง web/ ด้วย Vite + React 18 + TypeScript (strict) + Tailwind CSS (ติดตั้งจริง ไม่ใช้ CDN) + React Router + @tanstack/react-query + lucide-react + date-fns + clsx/tailwind-merge
2. สร้าง web/src/styles/tokens.css ตาม 01_DESIGN_SYSTEM.md ข้อ 1 และ map เข้า tailwind.config (colors.primary, colors.text, borderRadius, boxShadow, fontFamily)
3. โหลดฟอนต์ Inter + IBM Plex Sans Thai
4. vite base = '/v2/', dev proxy /api → http://localhost:<พอร์ต server เดิม>
5. แก้ server.ts เพิ่มเฉพาะ: express.static('web/dist') ที่ /v2 + SPA fallback /v2/* → web/dist/index.html (ห้ามแตะ route อื่น)
6. package.json root: เพิ่ม script build:web, และให้ npm run build เรียก build:web ด้วย; อัปเดต Dockerfile / nixpacks.toml ให้ build web ก่อน start
7. สร้าง web/src/lib/api.ts: fetch wrapper แนบ Bearer token จาก storage เดิม (key เดียวกับ auth.js เดิม), timeout 10s, 401 → ไปหน้า login, แปลง error เป็นข้อความไทย
8. สร้าง web/src/lib/date.ts: formatDMY, formatDateTimeDMY (24h), toISODate, parseDMY + unit test (vitest)
9. ESLint + Prettier + vitest; หน้า /v2 แสดงข้อความ "PMT Flow v2" ด้วยฟอนต์/สีจาก token
Acceptance: npm run build ผ่าน, เปิด http://localhost/v2 ได้, refresh ที่ /v2/anything ไม่ 404, UI เดิมที่ / ยังทำงานปกติ, test date.ts ผ่าน
```

---

## Phase 2 — Design System & Styleguide

```text
[กติการ่วม]
เป้าหมาย: สร้าง UI components ทั้งหมดตาม 01_DESIGN_SYSTEM.md ข้อ 5 และหน้าโชว์ /v2/styleguide
งาน:
1. ติดตั้ง shadcn/ui (Radix) แล้วปรับสไตล์ให้ตรง token: Button, Input, Textarea, Select, Checkbox, Switch, Tabs, Badge, Card, Table (พร้อม sort/pagination), Drawer (Sheet), Modal (Dialog), DropdownMenu, Tooltip, Toast (sonner), Skeleton, EmptyState
2. สร้างเอง: DatePicker (DD/MM/YYYY, พิมพ์เองได้, ปฏิทินภาษาไทย/อังกฤษ), DateRangePicker, TimePicker24 (00–23, นาทีทีละ 5, Quick shift presets 08:00–17:00 / 08:30–17:30 / 09:00–18:00), StatusBadge (ตัวอักษรดำ + จุดสี 8px, map status จาก BUSINESS_RULES.md → --st-*), KpiCard (label + ตัวเลขเท่านั้น), PipelineStepper (ใช้ในหน้าเปิดเต็มหน้าเท่านั้น, รองรับโหมด Quick Service ข้าม 2–4), PhotoSlots5 (+ Lightbox, บีบอัดรูป maxDim 1200 quality 0.8 เหมือน compressImage เดิม), FileVersionList, KmLink (ไอคอนหนังสือ → /km/<pageKey>), PageHeader (hero gradient + title + KmLink + actions — ไม่มี prop description), Toolbar (search + filter chips), MasterDetailLayout (บน-ล่าง: Master สูงเริ่มต้น 300px + Splitter ลากปรับได้และจำค่าต่อหน้า + Detail เต็มพื้นที่ที่เหลือ, sync selection กับ URL, keyboard ↑↓/Enter, responsive ตาม 01_DESIGN_SYSTEM.md ข้อ 4), DataGrid (ตัวเดียวใช้ทั้งบนและล่าง — แนะนำ TanStack Table + TanStack Virtual: เส้นตารางทุกเซลล์, คอลัมน์ # เลขแถว, หัว sticky + sort, แถว 36px, select แถว, inline edit (Enter/Tab/Esc) ใช้ DatePicker/TimePicker24 ในเซลล์วันที่/เวลา, เพิ่ม/ลบแถว, tfoot สรุปยอด, ซ่อน/แสดง/ลากสลับคอลัมน์และจำค่าต่อผู้ใช้, virtual scroll), DetailGrid (แถบหัว 1 บรรทัด + แท็บ pill มีตัวนับ + DataGrid ของแท็บ), KpiChips (chip เล็กในแถวหัวข้อ คลิกกรอง), Splitter
3. หน้า /v2/styleguide แสดงทุก component ทุก variant
4. เขียน test ให้ DatePicker/TimePicker24/StatusBadge
Acceptance: styleguide ดูแล้วสะอาดเหมือน 03_UI_REFERENCE.html, ไม่มี native date/time input ในโค้ด (grep ต้องไม่เจอ type="date" / type="time"), test ผ่าน
```

---

## Phase 3 — App Shell & Authentication

```text
[กติการ่วม]
เป้าหมาย: โครงหน้าหลัก + ระบบ Login/Logout/RBAC
งาน:
1. หน้า /v2/login: การ์ดกลางจอบนพื้น hero gradient, โลโก้, ช่อง username/email + password (ปุ่มแสดงรหัส), ข้อความ error ชัดเจน (รหัสผิด / USER_INACTIVE), ใช้ POST /api/v1/auth/login, เก็บ token ใน sessionStorage+localStorage key เดิม, autofocus ช่อง username
2. AppLayout: Topbar (โลโก้, ปุ่มค้นหา ⌘K เปิด Command palette ค้นหารหัสงาน/ชื่อลูกค้า/เมนู, กระดิ่ง, Avatar เมนู: โปรไฟล์, เปลี่ยนรหัสผ่าน, ออกจากระบบ) + Sidebar ตาม 00_MASTER_PLAN.md ข้อ 4 (active = pill ฟ้าอ่อน, ตัวนับงานค้างจาก GET /api/v1/jobs/summary)
3. RBAC: web/src/lib/rbac.ts กำหนดเมนู/route ต่อ role (ADMIN, AE, QC, CONTACT_CENTER) ตาม pmt_flow_skill.md; RequireAuth + RequireRole guard; ไม่มีสิทธิ์ → หน้า 403 สะอาด ๆ
4. Logout ทุกจุด: POST /api/v1/auth/logout (keepalive) → sessionStorage.clear(), localStorage.clear() → window.location.replace('/v2/login'); window.location.reload()
5. GET /api/v1/auth/me ตอนเปิดแอป เพื่อตรวจ token; token หมดอายุ → login
6. Responsive: <1024px sidebar เป็น drawer
7. สร้างหน้า placeholder ของทุก route (PageHeader + EmptyState) เพื่อให้คลิกเมนูได้ครบ
Acceptance: login ด้วย 4 role แล้วเห็นเมนูต่างกันถูกต้อง, เข้า URL ตรงที่ไม่มีสิทธิ์ได้ 403, logout แล้วกด back กลับเข้าไม่ได้, มือถือใช้งานเมนูได้
```

---

## Phase 4 — Dashboard, Step 1 (คิวคำสั่งซื้อ) & JobDetail

```text
[กติการ่วม]
เป้าหมาย: หน้าที่ใช้บ่อยที่สุด 3 หน้า — ให้ฟีเจอร์ครบตาม FEATURE_PARITY.md หมวด page-dashboard, page-master-orders, page-jobs, page-job-detail
งาน:
1. /dashboard: KPI 4 การ์ด (งานใหม่, กำลังดำเนินการ, รอ QC, ปิดแล้วเดือนนี้ — ใช้ตัวเลขจริงจาก API ห้าม hardcode), กราฟงานตามสถานะ/ตามเดือน (Recharts สีตาม token), ตาราง "งานที่ต้องทำวันนี้" และ "งานใกล้ครบกำหนด 5 วัน (รอ Book QC)"
2. /orders และ /orders/:jobNo — Master/Detail ให้เหมือน rebuild/03_UI_REFERENCE.html:
   - แถวหัวข้อ: H1 + KmLink + KPI chips (ทั้งหมด/ใหม่วันนี้/รอนัด/เลยกำหนด — คลิกกรอง) + ปุ่ม ส่งออก / สร้างงาน; แถว toolbar: ค้นหา, chips (ประเภท, ช่วงวันที่, ตัวกรอง), pagination ชิดขวา
   - Grid บน: # | รหัสงาน | ลูกค้า | เบอร์โทร | บริการ | ประเภท | วันนัด | สถานะ (ดำ+จุดสี) | ยอดสุทธิ | AE | ช่าง | QC
   - Grid ล่าง: <JobDetailGrid jobNo defaultTab="task"/>
   - ปุ่ม "สร้างงาน" เปิด Drawer ฟอร์ม เลือกประเภท (Renovate / Quick Service / Survey) เป็นตัวเลือกธรรมดา — ไม่มีแกลเลอรีเทมเพลต
3. <JobDetailGrid> (component กลางที่ทุกหน้า Pipeline ใช้เป็น Grid ล่าง): แถบหัว (รหัสงาน · ลูกค้า·บริการ · สถานะ · ปุ่ม เปิดเต็มหน้า / เพิ่มแถวของแท็บ) + แท็บ Grid ต่อไปนี้ (แต่ละแท็บ = DataGrid):
   - งาน/Task: Task | ช่าง | QC | เริ่ม | สิ้นสุด | วัน | % | สถานะ
   - BOQ: รายการ | หน่วย | จำนวน | ราคา/หน่วย | รวม + tfoot Subtotal / ส่วนลด / ยอดสุทธิ = max(0, Subtotal − Discount) No VAT
   - บันทึกช่าง: วันที่ | รอบ | ช่าง | เวลา (24 ชม.) | ชม. | งานที่ทำ | ปัญหา | รูป (thumbnail 5 รูป → Lightbox)
   - QC: ครั้งที่ | วันเวลา | ผู้ตรวจ | รูปแบบ Online/On-site | ผล | คะแนน | หมายเหตุ
   - การเงิน: เลขที่ Ticket | วันที่ชำระ | วิธีชำระ | ยอด | สลิป | สถานะ + tfoot รวมยอด
   - แบบติดตั้ง: เวอร์ชัน | ไฟล์ | ประเภท | ขนาด | ผู้อัปโหลด | วันที่ | Current
   - ประวัติ: วันเวลา | ผู้ใช้ | การกระทำ | รายละเอียด
   Phase นี้ทำ Task + ประวัติให้ทำงานกับ API จริง แท็บอื่นแสดงข้อมูลอ่านอย่างเดียวก่อน (แก้ไขได้ใน Phase 5–7); รับ prop defaultTab (หน้า QC → qc, Ticket → pay, Gantt → task)
   หน้า /jobs/:jobNo (เปิดเต็มหน้า) = ฟอร์มข้อมูลงาน/ลูกค้า + Stepper + แท็บ Grid ชุดเดียวกัน
4. ปุ่ม action ใน header เปลี่ยนตามสถานะงาน (ดู state machine ใน BUSINESS_RULES.md)
Acceptance: ตัวเลข dashboard ตรงกับ UI เดิม, ฟีเจอร์ในหมวดทั้ง 4 ของ FEATURE_PARITY ติ๊กครบ, ทดสอบ Renovate 1 งาน + Quick 1 งาน
```

---

## Phase 5 — Step 2–3: Ticket/สลิป, แบบติดตั้ง, BOQ, Convert เป็น Project

```text
[กติการ่วม]
เป้าหมาย: ย้ายหน้า page-tickets, page-blueprints, page-boq, page-project-conversion, page-project-pricing มาเป็น v2 ครบฟีเจอร์
รูปแบบ: ทุกหน้าเป็น Master/Detail — /tickets/:jobNo (Detail = JobDetail แท็บการเงิน), /conversion/:jobNo (แท็บ BOQ → งาน/Gantt), /blueprints/:id, /boq/:id; ฟอร์มสร้าง/แก้ใช้ Drawer
งาน:
1. /tickets: ตาราง Ticket (เลขที่, งาน, ยอด, วิธีชำระ, วันที่ชำระ, สถานะ) + Drawer สร้าง/แก้ Ticket + อัปโหลดสลิป (preview), ใช้ /api/v1/tickets*; เมื่ออัปสลิปสำเร็จ → พาไปหน้า conversion ของงานนั้น (พฤติกรรมเดิม)
2. /blueprints + แท็บแบบติดตั้งใน JobDetail: FileVersionList (v1, v2, Current), preview PDF/รูปใน Drawer, DWG/SKP ดาวน์โหลด, remark ต่อเวอร์ชัน, ใช้ /api/v1/blueprints* และ /api/v1/jobs/:id/designs
3. /boq + แท็บ BOQ: ตารางแก้ไขแบบ inline (รายการ, หน่วย, จำนวน, ราคา/หน่วย, รวม), เลือกจาก master หรือเพิ่มเอง, สรุป Subtotal → Discount → Grand Total = max(0, Subtotal − Discount) No VAT แบบ real-time, ตรึงราคา ณ เวลาบันทึก, นำเข้าไฟล์ BOQ (POST /api/v1/jobs/:id/boq/upload-file), Export Excel/PDF
4. /conversion: รายการงานที่พร้อมแปลง → Drawer "แปลง BOQ เป็น Task" (POST /api/v1/jobs/:id/tasks/import-boq) แก้ชื่อ task, วันเริ่ม/จบ (DatePicker) หรือจำนวนวัน → คำนวณวันจบ, ช่าง, QC ผู้รับผิดชอบ, ลำดับ (reorder)
5. /pricing: บันทึกราคาโครงการ แยกทุน/ราคาขาย ตามคู่มือเดิม
6. Quick Service: Step 2–3 ต้อง disabled/ข้าม ตามกฎเดิม
Acceptance: FEATURE_PARITY หมวดที่เกี่ยวข้องติ๊กครบ, test ตัวคำนวณ BOQ (vitest), ผล BOQ บันทึกแล้วเปิดใน UI เดิมได้ค่าตรงกัน
```

---

## Phase 6 — Step 4: Gantt Timeline & บันทึกงานช่างรายวัน

```text
[กติการ่วม]
เป้าหมาย: /gantt และแท็บงาน/บันทึกช่างใน JobDetail
งาน:
1. /gantt/:jobNo เป็น Master บน / Detail ล่าง: Master = ตารางโปรเจกต์, Detail = Timeline ของโปรเจกต์ที่เลือก (ลาก Splitter ขึ้นเพื่อให้ timeline สูงขึ้น หรือกดขยายเต็มจอ) → ซ้ายรายการ Task/Subtask (ชื่อ, ช่าง, QC, %), ขวาแถบเวลา Day/Week/Month, เส้น "วันนี้", bar radius 6 สีตามสถานะ PENDING/IN_PROGRESS/DONE/OVERDUE/REWORK (token --st-*), ไม่มี dependency
2. ตัวกรอง: ช่าง, ทีม, พื้นที่, สถานะ; ลาก bar เปลี่ยนวัน (บันทึก PUT /api/v1/jobs/:id/tasks/:taskId ทันที, persist PostgreSQL), เพิ่ม/ลบ task, subtask รับ QC ผู้ตรวจจาก parent
3. Daily Work Log Drawer (ปุ่ม "บันทึกช่าง" บนแต่ละ task): วันที่ (DatePicker), รอบที่/จำนวนวันแผน, เวลาเริ่ม-จบ TimePicker24 + สรุป "รวม X ชม. Y นาที", ผู้บันทึก (auto), งานที่ทำวันนี้, อุปกรณ์ที่ติดตั้ง/แบบอ้างอิง, ปัญหาหน้างาน, PhotoSlots5 (ก่อนเริ่ม / ระหว่างทำ 1 / ระหว่างทำ 2 / ทดสอบ / เสร็จ) — ตัดองค์ประกอบที่ผู้ใช้สั่งตัดไว้ใน pmt_flow_skill.md ข้อ 5.2
4. % ความคืบหน้าคำนวณจากวันเข้างานจริง / วันตามแผน (กฎเดิม), ประวัติ log เรียงตามวันพร้อม Lightbox
5. แจ้งเตือน "ใกล้ครบกำหนด 5 วัน → Book QC" แสดงบน task และ dashboard
Acceptance: ลาก bar แล้ว refresh ค่ายังอยู่, บันทึก log พร้อม 5 รูปได้, เวลาไม่มี AM/PM, FEATURE_PARITY หมวด gantt ติ๊กครบ
```

---

## Phase 7 — Step 5–6: QC, ปิดงาน/ส่ง STK, CSAT, MA

```text
[กติการ่วม]
เป้าหมาย: /qc, /completed, CSAT, /ma และแท็บ QC/การเงินใน JobDetail
รูปแบบ: /qc/:jobNo, /completed/:jobNo, /ma/:id เป็น Master/Detail — Grid ล่างของ /qc เปิดแท็บ QC (Grid ประวัติการตรวจทุกรอบ); กดปุ่ม "+ ตรวจ QC" หรือดับเบิลคลิกแถว "รอตรวจ" เปิด Drawer ฟอร์มประเมิน
งาน:
1. /qc Master: chips "รอนัด" | "นัดแล้ว" | "ตรวจแล้ว", ตัวกรองช่วงวันนัด + preset (วันนี้/สัปดาห์นี้/เดือนนี้), ยืนยันคิว (PUT /api/v1/qc/bookings/:id/confirm), sync จาก INT
2. Drawer ตรวจ QC (เปิดจาก Grid ล่าง แท็บ QC): Quick Service = Online 1 ข้อ "ช่างทำงานได้ตามมาตรฐานการทำงานที่กำหนด" ดูรูปจาก Visit Plan; Renovate = On-site 5 ข้อ Yes=5/No=1; รอบ ≥2 ผ่านแล้วคะแนนล็อก 1.0 อัตโนมัติ; ต้องให้ task ใน Gantt ครบก่อนประเมิน (gating เดิม); FAIL → Rework กลับ Step 4; แสดง qc_history ทุกรอบ (ครั้งที่, วันเวลา 24 ชม., ผู้ตรวจ, ผล, คะแนน, หมายเหตุ)
3. ปุ่ม "บันทึกปิดงาน & อนุมัติผ่านเกณฑ์ QC" → POST /api/v1/jobs/:id/close-and-export-bmt → แสดงผลการส่ง STK (สำเร็จ/ล้มเหลว + retry)
4. /completed: ตารางงานปิดแล้ว + สถานะส่ง STK + ดูรายละเอียด; CSAT (POST /api/v1/jobs/:id/after-sale/csat) สำหรับ CONTACT_CENTER
5. /ma: สัญญา MA และรอบบริการ ตามฟีเจอร์เดิม
Acceptance: เล่น flow ครบ Renovate (ผ่านรอบ 1 = 5.0, ไม่ผ่าน→rework→ผ่านรอบ 2 = 1.0) และ Quick Service (Online 1 ข้อ) ได้ถูกต้อง, FEATURE_PARITY หมวด qc/completed/csat/ma ติ๊กครบ
```

---

## Phase 8 — Admin, Reports & KM (คลังความรู้)

```text
[กติการ่วม]
เป้าหมาย: /admin/users, /admin/api-logs, /admin/settings, /reports, /km
งาน:
0. รูปแบบ: /admin/users/:id, /admin/api-logs/:id, /km/:article เป็น Master/Detail (ซ้ายรายการ, ขวารายละเอียด/payload JSON/บทความ)
1. Users: KPI ตาม role (คลิกกรองได้), ค้นหา real-time, tab role, filter active, Detail แสดงข้อมูลผู้ใช้ + ประวัติ login ของคนนั้น, Drawer สร้าง/แก้ (username ล็อกตอนแก้), Modal reset password (+ยืนยัน), toggle active (soft delete, ห้ามปิด admin หลัก), ตาราง Login Audit 100 รายการล่าสุด + ค้นหา — roleBadge สี/ไอคอนตาม pmt_flow_skill.md
2. API Monitor: Master = รายการ inbound/outbound logs + filter, Detail = request/response payload JSON, ล้าง log (ADMIN)
3. Settings: รัศมี check-in (default 400 ม.), staging config / auto-convert, ค่าระบบอื่นในหน้าเดิม
4. Reports: รายงาน Audit Timestamps, Job 360 Audit, export Excel/CSV
5. /km (KM คลังความรู้ — ที่เดียวในระบบที่มีคำอธิบาย): layout แบบภาพ Lark — ซ้ายค้นหา + หมวด (Step 1–6, Check-in หน้างาน, BOQ, Gantt & บันทึกช่าง, QC, ปิดงาน/STK, MA, Users/Admin, FAQ, ตารางสถานะงาน), ขวารายการบทความ → อ่าน markdown จาก doc/*.md (react-markdown + ค้นหาเต็มข้อความ)
   - ทุก pageKey ที่ KmLink ใช้ในระบบต้องมีบทความปลายทาง: /km/orders, /km/tickets, /km/conversion, /km/boq, /km/gantt, /km/worklog, /km/qc, /km/completed, /km/ma, /km/pricing, /km/blueprints, /km/reports, /km/users, /km/api-logs, /km/settings, /km/dashboard, /km/job-detail
   - ย้ายข้อความอธิบาย/banner/คำแนะนำทั้งหมดที่เคยอยู่บน UI เดิม (index.html, page-faq) มาไว้ในบทความ KM ที่ตรงกัน
   - ADMIN แก้ไข/เพิ่มบทความได้ (ถ้าต้องการ backend ให้เพิ่ม endpoint /api/v1/km/* ใหม่ ไม่แตะของเดิม)
6. ตรวจทั้งระบบ: grep ต้องไม่เจอ description/subtitle/helper text บนหน้าจอทำงาน
Acceptance: FEATURE_PARITY หมวด users/api-logs/settings/report/faq ติ๊กครบ, เฉพาะ ADMIN เข้า /admin ได้, คลิก KmLink ทุกหน้าแล้วเปิดบทความที่ถูกต้อง (ไม่มีลิงก์ตาย)
```

---

## Phase 9 — QA, Responsive, Performance & Cutover

```text
[กติการ่วม]
เป้าหมาย: v2 พร้อมแทนที่ UI เดิม
งาน:
1. ตรวจ FEATURE_PARITY.md ทุกข้อต้องเป็น [x] — ข้อไหนไม่ได้ทำให้รายงานพร้อมเหตุผล
2. E2E test ด้วย Playwright: login 4 roles, flow Renovate ครบ 6 step, flow Quick Service, logout, Grid บน/Grid ล่าง (คลิกแถว → Grid ล่างเปลี่ยน + URL เปลี่ยน, สลับแท็บ, แก้ไขเซลล์แล้วบันทึกลง API, เพิ่มแถว, ยอดสรุปคำนวณถูก, refresh แล้วยังเลือกแถวเดิม, back/forward ทำงาน, ↑↓ เลื่อนแถว, ลาก Splitter แล้วจำความสูง, มือถือแตะแถวแล้วเลื่อนไป Detail)
3. ตรวจ responsive ที่ 375 / 768 / 1280 / 1920 px — ไม่มี horizontal scroll ยกเว้นตารางและ Gantt
4. Performance: code-split ต่อ route, bundle แรก < 300KB gzip, Lighthouse ≥ 90 (Performance/Accessibility)
5. ตรวจกฎ: grep ต้องไม่เจอ type="date", type="time", "AM", "PM" ใน UI, ไม่มี dark mode, ข้อความข้อมูลและสถานะเป็นสีดำ, ไม่มีคำอธิบาย/subtitle บนหน้าจอทำงาน (ทุกคำอธิบายอยู่ใน /km), ไม่มีคอลัมน์ stepper ในตาราง
6. Cutover (ทำเมื่อผมอนุมัติเท่านั้น): Express เสิร์ฟ web/dist ที่ "/" และย้าย UI เดิมไป "/legacy" (ยังเข้าได้ 30 วัน), แก้ vite base เป็น "/", redirect /v2/* → /*
7. อัปเดตบทความ KM (doc/*.md) + README.md ให้ตรงกับ v2 (ภาพหน้าจอใหม่)
8. push main → ตรวจบน https://vibepmt.online (Ctrl+F5) แล้วรายงาน — การขึ้น production ผมจะทำเอง
Acceptance: E2E ผ่านทั้งหมด, ผู้ใช้ทดสอบ UAT ตาม UAT_SCENARIO_TEST_GUIDE.md ผ่าน
```

---

## Phase 10 (ทางเลือก) — Backend Refactor

```text
[กติการ่วม]
เป้าหมาย: ทำ backend ให้ดูแลง่าย โดย API contract เดิมไม่เปลี่ยน
งาน:
1. แยก server.ts เป็น src/server/{app.ts, routes/*.ts, services/*.ts, db/*.ts, middleware/*.ts} ตามโดเมน (auth, users, jobs, tickets, blueprints, boq, tasks, daily-logs, qc, integration, system)
2. ย้ายรูป Base64 ออกจาก JSONB → เก็บไฟล์ใน object storage/volume + ตาราง files (ทำ migration script แบบย้อนกลับได้, ทดสอบบน Dev เท่านั้น)
3. ค่อย ๆ normalize core_jobs ตาม Data Model ใน REQUIREMENTS.md (t_task, t_daily_log, t_qc_result, t_payment_ticket) พร้อม view เดิมให้ API ยังตอบรูปแบบเดิม
4. Contract test: บันทึก response ของทุก endpoint ก่อน refactor แล้วเทียบหลัง refactor ต้องเหมือนเดิม
Acceptance: contract test ผ่าน 100%, test เดิมทั้งหมดผ่าน, UI v2 ทำงานปกติ
```
