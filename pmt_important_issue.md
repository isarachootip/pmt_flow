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
