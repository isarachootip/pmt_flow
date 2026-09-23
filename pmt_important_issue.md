# 🚨 PMT Flow Critical Issue Guide & Troubleshooting Manual
> **คู่มือบันทึกปัญหาสำคัญที่พบบ่อย (Critical Issues & Troubleshooting Manual)**  
> เอกสารนี้จัดทำขึ้นเพื่อให้ AI Assistant, ทีมพัฒนา และผู้ดูแลระบบจดจำสาเหตุ และวิธีตรวจสอบแก้ไขปัญหา "Deploy แล้วดึงข้อมูลไม่ขึ้น / หน้าจอค้าง / แดชบอร์ดเป็น 0" ได้อย่างแม่นยำ 100%

---

## 📌 สรุปสาระสำคัญ (Executive Summary)

เมื่อมีการ Deploy โค้ดขึ้นเซิร์ฟเวอร์ Dev (`https://vibepmt.online`) แล้วพบอาการ:
1. **ตัวเลขบนแดชบอร์ดแสดงค่าฮาร์ดโค้ดตั้งต้นเสมอ** เช่น `฿1,289,500`, งานกำลังดำเนินการ `1`, งานเกินกำหนด `0`, งานวันนี้ `0`
2. **ตาราง "รายการงานล่าสุด (Recent Jobs)" ว่างเปล่า** ไม่มีแถวข้อมูลแสดงเลย (แม้กระทั่งข้อความ *"ยังไม่มีรายการงานล่าสุดในระบบ"* ก็ไม่ปรากฏ)
3. **กราฟ Chart.js ว่างเปล่า** ไม่มีการวาดกราฟเส้น Performance หรือ Donut Chart สัดส่วนงาน
4. **คลิกเมนูบางหน้าไม่ตอบสนอง หรือโหลดข้อมูลไม่ขึ้น**

**สาเหตุเกิดจาก 3 กรณีหลักเสมอ (เรียงตามลำดับความถี่ที่พบบ่อยที่สุด):**
- **กรณีที่ 1 (บ่อยที่สุด):** เกิด **Fatal Syntax Error** ในไฟล์ JavaScript ฝั่งหน้าบ้าน (`public/js/app.js`) ทำให้ Browser Parse โค้ดไม่ผ่านและหยุดทำงานทั้งระบบ
- **กรณีที่ 2:** การยืนยันตัวตนล้มเหลว (401 Unauthorized / Token Mismatch) จาก Password Hash ในฐานข้อมูลไม่ตรง
- **กรณีที่ 3:** Browser Asset Caching ผู้ใช้ยังโหลดไฟล์ JavaScript เดิมที่ค้างอยู่ในแคชเบราว์เซอร์

---

## 🔍 สาเหตุที่ 1: Fatal Syntax Error ใน `public/js/app.js` (พบบ่อยที่สุด ⭐⭐⭐)

### 1.1 ทำไมปัญหานี้ถึงเกิดขึ้นได้ และหลุดรอดจากกระบวนการ Build?
- ไฟล์ [`public/js/app.js`](file:///c:/atgv/pmt_flow/public/js/app.js) มีความยาวมากกว่า **29,000 บรรทัด (ขนาด ~2 MB)**
- โปรเจกต์นี้ใช้ TypeScript กับโค้ดฝั่ง Backend (`server.ts`, `database.ts`) โดยคำสั่ง `tsc` ใน `npm run build` จะตรวจเฉพาะไฟล์ TypeScript **แต่ไม่เคยตรวจสอบไฟล์ `.js` ใน `public/js/`**
- เมื่อ Developer หรือ AI ทำการแก้โค้ดหน้าบ้าน แล้วเกิดข้อผิดพลาด เช่น:
  - **ประกาศตัวแปร `const` หรือ `let` ชื่อซ้ำกันในฟังก์ชันเดียวกัน** เช่น:
    ```javascript
    // ❌ ข้อผิดพลาด: SyntaxError: Identifier 'history' has already been declared
    const history = Array.isArray(job.qc_history) ? job.qc_history : [];
    // ... โค้ดคั่นกลาง ...
    const history = Array.isArray(job.qc_history) ? job.qc_history : [];
    ```
  - **ลืมปิดวงเล็บหรือ Template Literal ของ Array Method (`.map`, `.filter`)** เช่น:
    ```javascript
    // ❌ ข้อผิดพลาด: SyntaxError: missing ) after argument list
    html += subtasks.map((s, idx) => {
        return `<div>...</div>`;
    // ลืมใส่ }).join('');
    container.innerHTML = html;
    ```
  - **Unclosed Backtick (`` ` ``) หรือ Missing Curly Brace (`}`)**
- เมื่อรัน `npm run build` คำสั่ง `tsc` ผ่านฉลุย แต่เมื่อไฟล์ขึ้นสู่เบราว์เซอร์จริง เอนจิน JavaScript (V8) จะปฏิเสธการรันไฟล์ `app.js` ทันที!
- ผลคือ `window.app` ไม่ถูกสร้างขึ้น, `app.init()` ไม่ทำงาน, `app.navigate()` พัง, และไม่มีการยิง API `fetchJobsFromApi()` หน้าเว็บจึงค้างอยู่ที่โครงร่าง HTML ดั้งเดิม

### 1.2 วิธีตรวจสอบและแก้ไขทันที
รันสคริปต์ตรวจสอบ Syntax หน้าบ้านด้วยคำสั่ง:
```bash
npm run check:syntax
# หรือรันผ่าน npm run build (ซึ่งรวม check:syntax ไว้แล้ว)
npm run build
```
หากมี Syntax Error สคริปต์จะระบุไฟล์, หมายเลขบรรทัด และชนิดข้อผิดพลาดอย่างชัดเจน

---

## 🔐 สาเหตุที่ 2: Authentication Session & Password Hash Mismatch (401 Unauthorized ⭐⭐)

### 2.1 กลไกที่ทำให้เกิดปัญหา
1. ในฝั่ง Client ([`public/js/auth.js`](file:///c:/atgv/pmt_flow/public/js/auth.js)) มีฟังก์ชัน Demo Fallback:
   - หากยิง `POST /api/v1/auth/login` ไปยัง Backend แล้ว Backend ตอบกลับล้มเหลว (`success: false`)
   - ระบบ Client จะสร้าง Demo Token หลอกขึ้นมา: `token = 'demo-token-' + Date.now()` แล้วอนุญาตให้ Login ผ่านในมุมมอง UI
2. แต่เมื่อ Client นำ Token ดังกล่าวไปยิงดึงข้อมูลจริงที่ `GET /api/v1/jobs`
3. Backend ตรวจไม่พบ Token นี้ในตาราง Session จึงตอบกลับ **`HTTP 401 Unauthorized`**
4. ฟังก์ชัน `fetchJobsFromApi()` ใน Client เมื่อเจอ HTTP 401 จะทำ `return` ทันที ทำให้ `DB.jobs` ไม่ได้รับการอัปเดต และตารางข้อมูลกลายเป็นค่าว่าง

### 2.2 สิ่งที่ต้องตรวจสอบในฝั่ง Backend และ Database
- ตรวจสอบค่า `password_hash` ในตาราง `sys_users` บนฐานข้อมูล PostgreSQL (`spmt_db`):
  ```sql
  SELECT id, user_code, username, email, password_hash, is_active FROM sys_users;
  ```
  - รหัสผ่านมาตรฐานของ `admin` และ `isarachootip@gmail.com` คือ **`Admin@1234`**
  - Hash มาตรฐานคือ:
    ```
    $2a$12$demo_c59a12a1ba0eac0b1d6a778ce4c8eb76a6d3b8a983bb938407813f9c87fe7191
    ```
  - **ห้าม** ให้เป็น Hash ของข้อความว่าง (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) เด็ดขาด
- ใน [`server.ts`](file:///c:/atgv/pmt_flow/server.ts) มีการติดตั้งระบบ Self-healing ให้ `verifyPassword` รองรับ Hash ของ Demo และให้ระบบ Re-query ดึงรหัสผ่านสดใหม่จาก DB ก่อนปฏิเสธการ Login

---

## ⚡ สาเหตุที่ 3: เบราว์เซอร์แคชไฟล์เก่า (Stale Browser Cache ⭐)

### 3.1 อาการ
- ฝั่งเซิร์ฟเวอร์ Deploy โค้ดใหม่เสร็จแล้ว และ API ส่งข้อมูลปกติ
- แต่เครื่องผู้ใช้ยังคงดึงไฟล์ `public/js/app.js` หรือ `app.css` ตัวเก่าที่ค้างในหน่วยความจำแคชของ Chrome/Edge

### 3.2 วิธีแก้ไข
- สั่งผู้ใช้งานกด **Hard Refresh**:
  - Windows: **`Ctrl + F5`** หรือ `Ctrl + Shift + R`
  - Mac: **`Cmd + Shift + R`**
- ใน `index.html` มีการผูก Query String เช่น `?v=1.7.2` สามารถขยับเลขเวอร์ชันเพื่อบังคับ Cache Busting ได้

---

## 🛡️ กฎเหล็กและแนวทางป้องกันถาวร (Mandatory Rules for AI & Developers)

1. **ห้าม Commit และ Push ก่อนรัน `npm run build` เด็ดขาด**:
   - คำสั่ง `npm run build` ในโปรเจกต์นี้ได้รับการปรับปรุงให้รัน `node scripts/check-syntax.js` ควบคู่กับ `tsc` เสมอ
   - หากไฟล์ใน `public/js/*.js` มี Syntax Error ใดๆ คำสั่ง Build จะระงับการทำงานทันที (Non-zero exit code)
2. **ห้ามประกาศตัวแปรซ้ำใน Scope เดิม**:
   - ก่อนจะเขียน `const history = ...` หรือตัวแปรใดๆ ให้ค้นหาในฟังก์ชันนั้นก่อนเสมอว่ามีการประกาศไว้ด้านบนแล้วหรือไม่
3. **ตรวจสอบ Array Methods และ Template Literals ให้ครบถ้วน**:
   - ทุกครั้งที่ใช้ `.map(...)` เพื่อสร้าง HTML string ต้องปิดด้วย `}).join('');` เสมอ
4. **ตรวจสอบสภาพแวดล้อม Dev vs Production**:
   - Dev: `https://vibepmt.online` (Branch `main` เท่านั้น)
   - Production: `https://prod.vibepmt.online` (ห้าม Agent Push เด็ดขาด เป็นหน้าที่ของผู้ใช้เท่านั้น)

---

## 🧰 คำสั่งด่วนสำหรับเช็คปัญหา (Diagnostic Command Cheat Sheet)

| วัตถุประสงค์ | คำสั่ง PowerShell / Bash |
|---|---|
| **ตรวจ Syntax หน้าบ้านทั้งหมด** | `npm run check:syntax` |
| **Build ระบบทั้งหมด** | `npm run build` |
| **ทดสอบเรียก API Jobs จากเซิร์ฟเวอร์ Dev** | `node -e "fetch('https://vibepmt.online/api/v1/jobs').then(r => r.json()).then(console.log)"` |
| **ตรวจสอบ Header แคชของ app.js** | `node -e "fetch('https://vibepmt.online/public/js/app.js').then(r => console.log('Last-Modified:', r.headers.get('last-modified')))"` |
| **ตรวจสอบผู้ใช้ใน PostgreSQL** | `node -e "const {Pool}=require('pg'); const p=new Pool({connectionString:'postgresql://postgres:EsQShpeaGvSr21I5ieQGJRmCELp78GSlQn6hQHAIjbTnY4c1aWw56JleGierEk2t@187.77.147.16:5432/spmt_db',ssl:false}); p.query('SELECT id,username,email,password_hash FROM sys_users').then(r=>{console.log(r.rows);p.end();});"` |

---

## 🟣 Issue #4: ปุ่ม QC (ตรวจประเมิน QC) ไม่ตอบสนองเมื่อกด — พบ 3 สาเหตุพร้อมกัน (2026-09-22)

> **อาการ:** ปุ่มสีม่วง "ตรวจประเมิน QC" ในหน้า Step 5 (QC) แสดง tooltip เมื่อ hover ได้ปกติ แต่เมื่อคลิกแล้ว modal ไม่เปิด ไม่มี toast ปรากฏ ไม่มี error แสดง

### สาเหตุที่ 1 (หลัก): `fetchQCJobsFromApi` ใช้ parameter ผิด — ดึง job มาได้ 0 records

**ตำแหน่ง:** [`public/js/app.js`](file:///c:/atgv/pmt_flow/public/js/app.js) — ฟังก์ชัน `fetchQCJobsFromApi()`

**โค้ดผิด (เดิม):**
```javascript
const params = new URLSearchParams({ limit: '200', status: 'qc' });
```

**ปัญหา:** ค่า `status: 'qc'` จะถูกส่งไปยัง `GET /api/v1/jobs?status=qc` และ server จะค้นหา job ที่มี `status = 'qc'` ตัวอักษรตรงๆ ซึ่ง **ไม่มีอยู่จริงในฐานข้อมูล** (job จริงมีสถานะเป็น `QC_PENDING`, `QC_REWORK`, `QC_PASSED` — ไม่ใช่ `qc`)

Server มี path พิเศษสำหรับกรอง QC คือ `step=qc` (ดูที่ [`database.ts`](file:///c:/atgv/pmt_flow/database.ts) `dbLoadJobsPaginated`) ซึ่งจะ filter ด้วย `WHERE status IN ('QC_PENDING','QC_INSPECTING','QC_REWORK','QC_PASSED')` อย่างถูกต้อง

**ผลกระทบ:**
- `DB.jobs` ไม่มี QC jobs จาก server เลย (นอกจาก mock/localStorage)
- เมื่อกดปุ่ม → `openQCDetailModal(id)` → `getJob(id)` ไม่พบ → fallback fetch `/api/v1/jobs/{id}` → อาจ 404 → แสดง toast → modal ไม่เปิด
- ตัวเลข KPI dashboard QC จะเป็น 0 เสมอแม้มีงานจริงในระบบ

**แก้ไขแล้ว (Commit `fb83738`):**
```javascript
// ใช้ step=qc เพราะ server จะ filter WHERE status IN ('QC_PENDING','QC_INSPECTING','QC_REWORK','QC_PASSED')
const params = new URLSearchParams({ limit: '100', step: 'qc' });
```

---

### สาเหตุที่ 2: `renderQCHistorySection` ขาด variable declaration — ทำให้ error ก่อนถึง `showModal()`

**ตำแหน่ง:** [`public/js/app.js`](file:///c:/atgv/pmt_flow/public/js/app.js) — ฟังก์ชัน `renderQCHistorySection(job)`

**ปัญหา:** ฟังก์ชันนี้ใช้ตัวแปร `currentRound` และ `isRound2Plus` ในส่วน `else if (isRound2Plus)` และ template string `ครั้งที่ ${currentRound}` แต่ **ไม่ได้ประกาศตัวแปรเหล่านี้ภายในฟังก์ชัน** ในขณะที่ `renderQCSubtasks` ซึ่งเป็นคนละฟังก์ชันกัน ประกาศถูกต้อง

**กฎสำคัญ:** ทุก helper render function ที่ถูกเรียกภายใน `openQCDetailModal` (บรรทัด 24249–24251) ต้องไม่มี uncaught error เพราะ `openQCDetailModal` มี single try-catch ที่ครอบทุก render step — หากใน render ใดเกิด error จะถูก catch ก่อนถึง `this.showModal()` ทำให้ modal ไม่เปิด

**แก้ไขแล้ว:** เพิ่ม declaration 2 บรรทัดใน `renderQCHistorySection` หลัง `isJobRework`:
```javascript
const currentRound = history.length + (job.status === 'QC_PASSED' ? 0 : 1) || (isJobRework ? (reworkCount + 1) : 1);
const isRound2Plus = currentRound >= 2 || isJobRework;
```

---

### สาเหตุที่ 3: ปุ่ม "ตรวจประเมิน QC" ขาด `type="button"`

**ตำแหน่ง:** [`public/js/app.js`](file:///c:/atgv/pmt_flow/public/js/app.js) — ฟังก์ชัน `renderQC()` ส่วน `actionButtonHtml` (else branch / non-passed state)

**ปัญหา:** ปุ่มที่มีสถานะยังไม่ผ่าน (`else` branch) ไม่มี `type="button"` ในขณะที่ปุ่มสถานะผ่าน (`QC_PASSED`) มีถูกต้อง เบราว์เซอร์บางตัว/บาง context จะถือปุ่มนี้เป็น `type="submit"` ซึ่งอาจ trigger form behavior แทน click handler

**แก้ไขแล้ว:** เพิ่ม `type="button"` ให้ครบ

---

### 🔎 วิธีตรวจสอบเร็วเมื่อพบ "ปุ่มกดแล้วไม่ทำงาน" ในอนาคต

```powershell
# 1. ตรวจสอบว่า fetchQCJobsFromApi ใช้ parameter ถูกต้องไหม
Select-String -Path "public\js\app.js" -Pattern "fetchQCJobsFromApi" | Select-Object -First 5

# 2. ตรวจสอบว่า render functions ที่ถูกเรียกใน openQCDetailModal มี variable ครบ
Select-String -Path "public\js\app.js" -Pattern "renderQCHistorySection|renderQCSubtasks|renderQCIntPhotos" | Select-Object -First 5

# 3. ตรวจสอบว่าทุก action button ใน renderQC() มี type="button"
Select-String -Path "public\js\app.js" -Pattern "openQCDetailModal" | Select-Object -First 10
```

**กฎทอง QC Modal:** ทุกฟังก์ชันที่ถูกเรียกจาก `openQCDetailModal` ต้องมี try-catch ของตัวเอง หรือออกแบบไม่ให้ throw exception เนื่องจาก `openQCDetailModal` มี single outer try-catch ที่จะดักจับ error ทุกอย่างและ `return` โดยไม่เรียก `showModal()`

---

## 🛑 ข้อผิดพลาดที่พบบ่อยเกี่ยวกับ API Parameter Mismatch

| API Parameter | ✅ ถูกต้อง | ❌ ผิดพลาด | Server Behavior |
|---|---|---|---|
| กรอง QC jobs | `step=qc` | `status=qc` | `step=qc` → `WHERE status IN ('QC_PENDING',...)` |
| กรอง Step 1 | `step=step1` หรือ `status=step1_queue` | `status=new` (อาจไม่ครบ) | ดู `database.ts:dbLoadJobsPaginated` |
| กรอง Step 6 | `step=step6` | `status=closed` (ไม่ครบ) | `step=step6` → `WHERE status IN ('QC_PASSED','CLOSED')` |
| limit สูงสุด | `limit=100` | `limit=200` (server cap ที่ 100) | Server บังคับ `Math.min(100, rawLimit)` |

---

## 🔴 Issue #5: บันทึกปิดงาน QC / บันทึกแบบร่างไม่ได้ ขึ้นแจ้งเตือน "คงเหลือ 1 ข้อ" ทั้งที่หน้าจอติ๊ก Yes 100% แล้ว (2026-09-23)

> **เอกสารอ้างอิงฉบับเต็ม:** [`pmt_flow_issue_skill.md`](file:///c:/atgv/pmt_flow/pmt_flow_issue_skill.md)

### อาการ
- ในหน้าจอแบบฟอร์มตรวจรับรองมาตรฐาน QC (`#modal-qc-job-detail`) ผู้ใช้กดเลือก "✓ Yes — ผ่านเกณฑ์ (5.0 คะแนนเต็ม)" หน้าจอคำนวณคะแนนเป็น 100% (5.0 / 5.0) และปุ่ม "✓ บันทึกปิดงาน & อนุมัติผ่านเกณฑ์ QC & ส่งข้อมูลไป STK" เปิดใช้งาน
- แต่เมื่อคลิกปุ่มบันทึกปิดงาน เกิดแจ้งเตือน:
  `⚠️ ไม่สามารถส่งผลตรวจไป STK ได้: กรุณาประเมินและให้คะแนนงานย่อยให้ครบทุกข้อก่อน (คงเหลือ 1 ข้อ)`

### สาเหตุที่แท้จริง (Root Cause)
1. **ขาด Auto-save (PATCH):** เมื่อคลิกเลือกคำตอบใน `setQCSubtaskAnswer` หรือคลิก "บันทึกแบบร่าง" ในโค้ดเดิมบันทึกเฉพาะในหน่วยความจำ (`DB.jobs`) แต่ไม่ได้ยิง `PATCH /api/v1/jobs/:id` ไปยังฐานข้อมูลเซิร์ฟเวอร์
2. **Background Polling ล้างทับข้อมูล (Race Condition):** ระบบ Polling ทุก 15 วิ หรือตอนสลับแท็บเบราว์เซอร์ (`visibilitychange`) ฟังก์ชัน `fetchJobsFromApi` ดึงข้อมูลจากฐานข้อมูลที่มี `qc_subtasks: []` มาทับตัวแปรในหน่วยความจำโดยไม่ได้ป้องกันฟิลด์ QC ไว้ แต่หน้าจอโมดอลไม่ได้ Re-render ผู้ใช้จึงยังเห็นปุ่มสีเขียวอยู่
3. **การตรวจสอบใน `approveCurrentJobToSTK` ล้มเหลว:** เมื่อกดปุ่มบันทึกปิดงาน ฟังก์ชันตรวจพบว่าในหน่วยความจำไม่มีคำตอบ จึงขึ้นแจ้งเตือน "คงเหลือ 1 ข้อ" และบล็อกการบันทึก

### การแก้ไขที่ดำเนินการแล้ว
1. **Preserve QC State ใน `fetchJobsFromApi`:** ป้องกันไม่ให้ Background Sync นำค่าว่างมาทับ `qc_subtasks`, `qc_remarks`, `qc_inspector`, `qc_history` โดยเฉพาะใบงานที่กำลังเปิดหน้าฟอร์ม QC ตรวจอยู่ (`activeQCModalId`)
2. **Auto-save ทันที (PATCH):** ทุกครั้งที่มีการเลือกผลการตรวจ Yes/No หรือกดบันทึกแบบร่าง ระบบจะส่งคำสั่ง PATCH บันทึกลงฐานข้อมูล PostgreSQL ทันที
3. **Defensive DOM Fallback:** เพิ่มการตรวจสอบกู้คืนสำรองใน `approveCurrentJobToSTK()` หากหน่วยความจำสะดุดแต่บนหน้าจอผู้ใช้เลือก Yes/No ไว้อยู่แล้ว ระบบจะดึงค่าจากหน้าจอมาซิงค์ต่อให้อัตโนมัติและอนุมัติปิดงานส่ง STK ได้ทันที ไม่โดนบล็อก
4. **บันทึกลง `localStorage`:** เพิ่มฟิลด์ QC ใน `safeRecent` ของ `persistJobs()`
