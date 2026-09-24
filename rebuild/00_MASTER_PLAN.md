# PMT Flow v2 — แผนสร้างเว็บใหม่ (Clean / Lark-style)

> เอกสารหลักสำหรับ AI Agent ทุกตัวที่ทำงาน Rebuild — **อ่านไฟล์นี้ + `01_DESIGN_SYSTEM.md` ก่อนเริ่มทุก Phase**
> Prompt สั่งงานแต่ละ Phase อยู่ใน `02_PHASE_PROMPTS.md` · ตัวอย่างหน้าตาอยู่ใน `03_UI_REFERENCE.html`
> อ้างอิงสไตล์: https://www.larksuite.com/en_us/templates/category/project-management

---

## 1. ผลตรวจสอบระบบเดิม (Audit Summary)

| หัวข้อ | สภาพปัจจุบัน | ปัญหา |
|---|---|---|
| Frontend | `index.html` ~10,900 บรรทัด + `public/js/app.js` **2.4 MB ไฟล์เดียว** + Tailwind ผ่าน CDN | แก้จุดหนึ่งพังอีกจุด (ประวัติ bug: duplicate const, จอขาว, overlay ซ้อน modal), โหลดช้า, AI แก้ยากเพราะไฟล์ใหญ่เกิน context |
| Backend | `server.ts` ~5,400 บรรทัด Express + `database.ts` + PostgreSQL | ทำงานได้ดี มี API ครบ ~65 endpoints → **เก็บไว้ใช้ต่อ** |
| Data | `core_jobs` เก็บเกือบทุกอย่างเป็น JSONB (BOQ, tasks, tickets, CSAT, รูป Base64) | ใช้ได้ แต่ query/report ยาก, รูป Base64 ทำให้ payload หนัก |
| UI | ธีมเดิม Gold-Black → เปลี่ยนเป็น Light, มี banner/emoji/ป้ายเยอะ, หลาย step ซ้ำซ้อน | ไม่สะอาด ผู้ใช้หาเมนูยาก, Step เลขในเมนูกับคู่มือไม่ตรงกัน |
| Rules | GEMINI.md / pmt_flow_skill.md มีกฎดีมาก (DD/MM/YYYY, 24 ชม., List view, RBAC, Logout hard reload) | กฎเยอะเพราะต้องกันบั๊กของโค้ดเดิม — ในระบบใหม่ให้ฝังกฎไว้ใน **component** แทน |

**สรุป:** ไม่ต้องเขียน Backend ใหม่ทั้งหมด — **สร้าง Frontend ใหม่ทั้งชุด** บน API เดิม (Strangler pattern) แล้วค่อยปรับ Backend ทีละส่วนใน Phase ท้าย

---

## 2. หลักการออกแบบ (Design Principles — แบบ Lark)

1. **ขาว สะอาด หายใจได้** — พื้นขาว, หัวหน้าเพจไล่สีฟ้าอ่อนจาง ๆ, ช่องว่างเยอะ, เส้นขอบบาง
2. **หนึ่งหน้า หนึ่งงานหลัก** — ทุกหน้ามีแค่: หัวข้อ + ไอคอน KM + ปุ่มหลัก 1 ปุ่ม
2.1 **ไม่มีคำอธิบายบนระบบเลย (Zero Description UI)** — ห้าม subtitle/คำอธิบายใต้หัวข้อ, ห้าม helper text ใต้ฟอร์ม, ห้าม banner/กล่องแนะนำ, ห้าม tooltip อธิบายวิธีใช้, ห้ามข้อความเสริมใต้ตัวเลข KPI, ห้ามหน้า/ส่วนแกลเลอรีเทมเพลต — **ความรู้/วิธีใช้ทั้งหมดอยู่ใน KM (คลังความรู้) เท่านั้น** ผู้ใช้กดไอคอน 📖 ข้างหัวข้อเพื่อเปิดบทความ KM ของหน้านั้น
2.2 **ไม่มี stepper "ความคืบหน้า"** ทั้งใน Grid บนและล่าง — ขั้นของงานดูจากคอลัมน์ "สถานะ" (ถ้าต้องการภาพ stepper ให้ดูในหน้า "เปิดเต็มหน้า" เท่านั้น)
2.3 **สถานะ = ตัวอักษรสีดำ + จุดสีเล็ก 8px** (ไม่มีพื้นสี ไม่มีตัวอักษรสี)
2.4 **ทุกหน้าเป็น Master / Detail แบบบน-ล่าง** — **บน = Master** (ตารางแนวนอนเต็มความกว้าง หัวตารางติดบน เลื่อนในกรอบ + ค้นหา/ตัวกรอง), **ล่าง = Detail เป็น Grid เช่นกัน** (แท็บของแถวที่คลิก — Task / BOQ / บันทึกช่าง / QC / การเงิน / แบบติดตั้ง / ประวัติ — แต่ละแท็บคือ Data Grid ของรายการย่อย แก้ไขในเซลล์ได้ + ปุ่มเพิ่มแถว; ไม่ใช้การ์ด/panel) — มีแถบลากปรับความสูงระหว่าง Master/Detail (จำค่าไว้ต่อผู้ใช้); คลิกแถวแล้ว Detail เปลี่ยนทันทีโดยไม่เปลี่ยนหน้า; ปุ่ม ↑ ↓ เลื่อนแถว; URL เปลี่ยนตามแถวที่เลือก (เช่น `/orders/JOB2609-00128`) เพื่อแชร์ลิงก์/กด back ได้; มือถือ: ยังเป็นบน-ล่าง, ตารางเลื่อนแนวนอนได้, แตะแถวแล้วเลื่อนลงไปที่ Detail
3. **Sidebar หมวดหมู่ซ้าย** — รายการเรียบ ๆ, รายการที่เลือกเป็น pill สีฟ้าอ่อน (เหมือนภาพ Lark)
4. **การ์ดมุมโค้ง 16px** เงาจางมาก, hover ยกขึ้นเล็กน้อย
5. **ไม่มี emoji / banner / ป้าย NEW! ที่ไม่จำเป็น** — ใช้ไอคอนเส้น (Lucide) สีเดียว
6. **Master เป็นตารางแนวนอน (List view)** ตามกฎเดิม — ไม่มี Card view ในหน้าทำงาน
7. **ฟอร์มยาวใช้ Drawer ด้านขวา** แทน Modal ซ้อน Modal

---

## 3. สถาปัตยกรรมใหม่ (Target Architecture)

```
pmt_flow/
├── server.ts, database.ts, schema.sql   ← Backend เดิม (คง API /api/v1/* ไว้ 100%)
├── public/                              ← UI เดิม (ย้ายไป /legacy ตอน Cutover)
├── web/                                 ← ★ Frontend ใหม่
│   ├── src/
│   │   ├── app/          (router, providers, layout shell)
│   │   ├── components/ui (Button, Input, DatePicker, TimePicker24, Table, Badge, Drawer…)
│   │   ├── features/     (auth, dashboard, orders, jobs, tickets, blueprints, boq,
│   │   │                   conversion, gantt, worklog, qc, completed, ma, report, users, admin)
│   │   ├── lib/          (api client, date utils DMY, rbac, format)
│   │   └── styles/       (tokens.css, globals.css)
│   └── vite.config.ts
└── rebuild/                             ← เอกสารแผนนี้
```

| ส่วน | เลือกใช้ | เหตุผล |
|---|---|---|
| Framework | **React 18 + Vite + TypeScript** | แยกไฟล์เล็ก, AI แก้ทีละ component ได้, type ช่วยกันบั๊ก |
| Style | **Tailwind CSS (build จริง ไม่ใช้ CDN)** + CSS tokens | ควบคุมธีมจากจุดเดียว |
| Components | **shadcn/ui (Radix)** ปรับตาม design tokens | สวย เรียบ accessible |
| Data | **TanStack Query** + fetch client กลาง | cache, loading/error state มาตรฐาน |
| Routing | React Router (URL จริง เช่น `/jobs/123`) | กด back ได้, แชร์ลิงก์ได้ |
| Date | `date-fns` + custom DatePicker (DD/MM/YYYY) + TimePicker 24 ชม. | ตามกฎเดิม ห้าม native date/time input |
| Icons | lucide-react | เส้นบาง แบบ Lark |
| Chart | Recharts | Dashboard/Report |
| Gantt | Custom (CSS grid) หรือ `gantt-task-react` | ไม่มี dependency (OQ-A04) → Timeline ธรรมดาพอ |
| Deploy | Express serve `web/dist` ที่ `/v2` ระหว่างพัฒนา → `/` ตอน Cutover | Coolify ตัวเดิม ไม่ต้องเพิ่ม server |

---

## 4. โครงสร้างเมนูใหม่ (Information Architecture)

```
ภาพรวม
  • แดชบอร์ด                      /dashboard          (page-dashboard)
ขั้นตอนงาน (Pipeline)
  1 รับงาน & คิวคำสั่งซื้อ        /orders             (page-master-orders, page-jobs)
  2 Ticket & ใบเสร็จ              /tickets            (page-tickets)
  3 แปลงเป็นโปรเจกต์ & BOQ        /conversion         (page-project-conversion, page-boq)
  4 แผนงาน Gantt & บันทึกช่าง     /gantt              (page-gantt + daily work log)
  5 ตรวจรับงาน QC                 /qc                 (page-qc)
  6 ปิดงาน & ส่ง STK              /completed          (page-completed-jobs, page-csat)
คลังข้อมูล
  • แบบติดตั้ง (Blueprints)       /blueprints
  • คลัง BOQ กลาง                 /boq
  • ราคาโครงการ                   /pricing            (page-project-pricing)
  • สัญญา MA                      /ma                 (page-ma-contracts)
รายงาน
  • รายงาน & Audit                /reports            (page-report)
ระบบ (ADMIN)
  • ผู้ใช้งาน                     /admin/users
  • API Monitor                   /admin/api-logs
  • ตั้งค่า                        /admin/settings
  • KM คลังความรู้                /km   (แหล่งเดียวของคู่มือ/วิธีใช้/FAQ — ทุกหน้ามีไอคอนลิงก์มาที่บทความของตัวเอง /km/<page-key>)
Job Detail (ใช้ร่วมทุกหน้า Pipeline)  แสดงในช่อง Detail ของแต่ละหน้า เช่น /orders/:jobNo, /qc/:jobNo
                                    ปุ่ม "เปิดเต็มหน้า" → /jobs/:jobNo (component เดียวกัน)
                                    แท็บ (แต่ละแท็บ = Grid): งาน/Task | BOQ | บันทึกช่าง | QC | การเงิน | แบบติดตั้ง | ประวัติ
                                    แต่ละหน้า Pipeline เปิดแท็บเริ่มต้นตามขั้นของตัวเอง (หน้า QC → แท็บ QC, หน้า Ticket → แท็บการเงิน)
```

เมนูที่แสดงขึ้นกับ Role (ADMIN / AE / QC / CONTACT_CENTER) — ดูตาราง RBAC ใน `pmt_flow_skill.md`

---

## 5. กฎที่ต้องคงไว้ (Non-negotiable Rules — ย้ายมาจากระบบเดิม)

1. **Light theme เท่านั้น** ไม่มี dark mode
2. **วันที่ DD/MM/YYYY** ทุกจอ, **เวลา 24 ชม.** ไม่มี AM/PM, ห้าม `<input type="date|time|datetime-local">` → ใช้ `<DatePicker/>` `<TimePicker24/>` เท่านั้น
3. **List view เป็นค่าเริ่มต้น** ทุกหน้าที่สลับมุมมองได้
4. **ข้อมูลสำคัญเป็นสีดำ `#000000`** (รหัสงาน ชื่อลูกค้า วันที่ ตัวเลข ตาราง ฟอร์ม) — สีเทาเข้ม `#4E5969` ใช้ได้เฉพาะ label เล็ก (หัว KPI, ชื่อหมวด sidebar, เบอร์โทรบรรทัดรอง) ห้ามเทาจาง (#9CA3AF ลงไป) กับข้อมูล
5. **Auth:** ยังไม่ login → เห็นแค่หน้า Login, ทุก route มี guard, Logout = เรียก `/api/v1/auth/logout` → ล้าง storage → `window.location.replace('/')` + reload
6. **RBAC 4 Roles** + User Management (CRUD, reset password, soft delete, login audit log)
7. **Business logic เดิมห้ามเปลี่ยน** เช่น Grand Total = max(0, Subtotal − Discount) No VAT, รูปช่าง 5 ช่อง, QC รอบ ≥2 คะแนนล็อก 1.0, Quick Service ข้าม Step 2–4, Check-in รัศมี 400 ม.
8. **API `/api/v1/*` ห้ามเปลี่ยน contract** (ระบบ INT/STK เรียกอยู่) — เพิ่ม endpoint ใหม่ได้ ห้ามลบ/แก้รูปแบบเดิม
9. **Deploy:** agent push ได้แค่ `main` (Dev: vibepmt.online) — **ห้ามแตะ branch `production`**
10. **อัปเดตคู่มือใน KM** (`doc/*.md` → แสดงที่ `/km`) ทุกครั้งที่ process เปลี่ยน — ห้ามย้ายคำอธิบายกลับมาไว้บนหน้าจอทำงาน
11. `npm run build` ต้องผ่าน (lint + typecheck + test) ก่อน commit ทุกครั้ง
12. **Zero Description UI** — บนหน้าจอมีได้แค่: หัวข้อ, label ฟิลด์/คอลัมน์ (สั้น ≤ 4 คำ), ข้อมูล, ปุ่ม, placeholder สั้น, ข้อความ error/ยืนยันการกระทำ — นอกนั้นไป KM
13. **สถานะงาน/ป้ายสถานะ ตัวอักษรสีดำทั้งหมด** — ใช้จุดสีเล็กแยกสถานะเท่านั้น
14. **Grid บน (Master) / Grid ล่าง (Detail) ทุกหน้าที่มีรายการ** — ใช้ component `<DataGrid>` ตัวเดียวกันทั้งบนและล่าง (Pipeline 1–6, แบบติดตั้ง, BOQ, MA, ผู้ใช้งาน, API logs, KM) — ห้ามเปิด Detail เป็น Modal หรือเปลี่ยนหน้าไปมา

---

## 6. ภาพรวม Phase

| Phase | ชื่อ | ผลลัพธ์ | ประมาณ |
|:-:|---|---|:-:|
| 0 | Audit & Feature Parity | `rebuild/FEATURE_PARITY.md` checklist ทุกฟีเจอร์เดิม + ภาพหน้าจอเดิม | 0.5–1 วัน |
| 1 | Foundation | โปรเจกต์ `web/` + tokens + Express serve `/v2` + build/deploy ผ่าน | 1 วัน |
| 2 | Design System | UI components ครบ + หน้า `/v2/styleguide` | 2 วัน |
| 3 | App Shell & Auth | Login, Topbar, Sidebar ตาม Role, Route guard, Logout | 1 วัน |
| 4 | Dashboard + Step 1 + Job 360 | แดชบอร์ด, คิวคำสั่งซื้อ, หน้ารายละเอียดงาน | 2–3 วัน |
| 5 | Step 2–3 | Ticket/สลิป, แบบติดตั้ง (version), BOQ, Convert → Tasks | 3 วัน |
| 6 | Step 4 | Gantt Timeline + บันทึกช่างรายวัน (รูป 5 ช่อง, 24 ชม.) | 3 วัน |
| 7 | Step 5–6 + After-sale | QC Online/On-site + ประวัติ Rework, ปิดงานส่ง STK, CSAT, MA | 3 วัน |
| 8 | Admin & Reports & KM | Users, Login log, API monitor, Settings, Report, KM คลังความรู้ (แหล่งคำอธิบายเดียวของระบบ) | 2 วัน |
| 9 | QA, Responsive & Cutover | ทดสอบ parity 100%, มือถือ, ย้าย UI เก่าไป `/legacy`, v2 เป็น `/` | 2 วัน |
| 10 | (ทางเลือก) Backend Refactor | แยก `server.ts` เป็น modules, รูปภาพออกจาก Base64, ตาราง normalize | 3–5 วัน |

**ลำดับบังคับ:** 0 → 1 → 2 → 3 แล้วจึงทำ 4–8 (ทำขนานกันได้ถ้ามีหลาย agent) → 9 → (10)

**วิธีทำงานกับ AI ทุก Phase:** เปิด branch `v2/phase-N` → วาง Prompt จาก `02_PHASE_PROMPTS.md` → AI ทำ + ทดสอบ → ตรวจตาม Acceptance Criteria → merge เข้า `main` → เช็กบน vibepmt.online/v2 → ติ๊ก `FEATURE_PARITY.md`
