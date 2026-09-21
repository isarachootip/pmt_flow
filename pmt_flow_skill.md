# PMT Flow - System Scope & Functional Specification (Skill Guide)

เอกสารกำหนดขอบเขตระบบ (System Scope), สถาปัตยกรรม และข้อกำหนดมาตรฐานฟังก์ชันการทำงานของ **PMT Flow (Enterprise Operations)** เพื่อใช้เป็นคู่มือและข้อกำหนดป้องกันไม่ให้ฟังก์ชันสำคัญหลุดจาก Scope ของระบบ

---

## 👥 1. ข้อกำหนดฟังก์ชันการจัดการผู้ใช้งาน (User Management Specification)

ระบบ **PMT Flow** ต้องมีฟังก์ชัน **User Management (จัดการผู้ใช้งาน)** เป็นแกนหลักของการควบคุมสิทธิ์ (Access Control) และความปลอดภัยของระบบ โดยมีขอบเขตและข้อกำหนดบังคับดังนี้:

### 1.1 สิทธิ์และบทบาทในระบบ (Role-Based Access Control - RBAC)
ระบบต้องรองรับ 4 บทบาทหลักอย่างเคร่งครัด:
| Role | ชื่อเรียกในระบบ | หน้าที่และความรับผิดชอบหลัก | สี/สัญลักษณ์ประจำตัว |
| :--- | :--- | :--- | :--- |
| **ADMIN** | ผู้ดูแลระบบ (Admin) | จัดการผู้ใช้ทั้งหมด, รีเซ็ตรหัสผ่าน, ดู Audit Logs, ตั้งค่าระบบ & API, สิทธิ์เต็มทุกขั้นตอน | ชมพู/แดง (`rose-500`) ไอคอน `ph-shield-star` |
| **AE** | ฝ่ายขาย (Account Executive) | รับคำสั่งซื้อใหม่ (INT Intake Step 1), บันทึกแบบแปลน (Step 2), จัดการคลัง BOQ และเตรียมแผนงาน (Step 3) | ฟ้า/น้ำเงิน (`blue-500`) ไอคอน `ph-briefcase` |
| **QC** | ตรวจสอบคุณภาพ (Quality Control) | ตรวจรับงานหน้างานและ Online (Step 5 / QC Inspection), ตรวจทานภาพถ่าย, อนุมัติ/ปฏิเสธงานพร้อมเหตุผล | เขียวมรกต (`emerald-500`) ไอคอน `ph-check-circle` |
| **CONTACT_CENTER** | บริการลูกค้า (Contact Center) | ตรวจสอบงานส่งมอบสำเร็จ, ดูแลสัญญา MA หลังการขาย, และประสานงานประเมิน CSAT ในระบบ STK | เหลืองส้ม (`amber-500`) ไอคอน `ph-phone` |

### 1.2 ฟังก์ชันบังคับของหน้าจอ User Management
1. **การ์ดสถิติผู้ใช้งาน (Stat Summary Cards)**:
   - แสดงผลจำนวนผู้ใช้งานแยกตาม Role (Admin, AE, QC, Contact Center) พร้อมตัวเลขรวม
   - สามารถคลิกการ์ดเพื่อ Filter กรองรายชื่อผู้ใช้ตาม Role นั้นๆ ได้ทันที
2. **ตัวกรองและการค้นหา (Filters & Search)**:
   - ค้นหาแบบเรียลไทม์ด้วย: ชื่อ-นามสกุล, Username, Email หรือรหัสผู้ใช้ (USR-XXX)
   - กรองตามบทบาท (Role Tabs: ทั้งหมด, Admin, AE, QC, Contact Center)
   - กรองตามสถานะการใช้งาน (เปิดใช้งานอยู่ / ปิดใช้งาน)
3. **การสร้างผู้ใช้งานใหม่ (Create User)**:
   - กำหนดข้อมูล: ชื่อ-นามสกุล, Username (ไม่ซ้ำ), อีเมล, กำหนด Role และรหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัวอักษร)
   - มีปุ่มเปิด-ปิดการมองเห็นรหัสผ่าน (Password Eye Toggle)
4. **การแก้ไขข้อมูลผู้ใช้งาน (Edit User)**:
   - แก้ไขชื่อ-นามสกุล, อีเมล, บทบาท (Role) และเปิด/ปิดสถานะบัญชี (Active/Inactive)
   - ล็อกช่อง Username ไม่ให้เปลี่ยนแปลงเพื่อรักษาความสมบูรณ์ของ Audit Trail
5. **การรีเซ็ตรหัสผ่าน (Reset Password)**:
   - โมดอลเฉพาะสำหรับ Admin ในการตั้งรหัสผ่านใหม่ให้ผู้ใช้
   - มีช่องยืนยันรหัสผ่าน (Confirm Password) และยกเลิก Session เก่าของผู้ใช้ทันทีเพื่อความปลอดภัย
6. **การระงับและเปิดใช้งานบัญชี (Soft Delete / Toggle Active)**:
   - ใช้วิธี **Soft Delete (is_active: false)** ห้ามลบข้อมูลผู้ใช้ออกจากฐานข้อมูลโดยตรง เพื่อรักษาประวัติการทำงานในคำสั่งซื้อ (Orders, Tickets, QC Records)
   - ไม่อนุญาตให้ระงับบัญชี Admin หลัก (`admin`)
7. **บันทึกประวัติการเข้าสู่ระบบ (Login Audit Logs)**:
   - บันทึกทุกเหตุการณ์การพยายาม Login (วันเวลา, Username, IP Address, User Agent / Browser, ผลลัพธ์ Success / Failed)
   - ตรวจสอบย้อนหลังได้ 100 รายการล่าสุด พร้อมระบบค้นหาในประวัติ

### 1.3 ข้อกำหนดทางเทคนิคและการป้องกัน Error (Technical Safeguards)
- **Global Helper**: ต้องมีฟังก์ชัน `window.roleBadge(role)` เสมอ เพื่อให้การวาดป้าย Role มีสไตล์เดียวกันในทุกจุดของระบบ (หน้าตาราง, โมดอลรีเซ็ตรหัส, โมดอลปิดใช้งาน, โปรไฟล์ผู้ใช้)
- **Fallback Data Resilience**: โมดูล `userMgmt.js` ต้องมี `defaultSeedUsers` รองรับเสมอ ป้องกันหน้าจอว่างเปล่ากรณีเชื่อมต่อ API ขัดข้อง
- **Error Boundary**: บล็อก `load()` ต้องแยก `try/catch` ระหว่างการวาดตาราง (`applyFilters()`) และการคำนวณสถิติ (`renderStats()`) เพื่อป้องกัน cascading failure
- **Cache Invalidation**: ทุกครั้งที่มีการอัปเดตไฟล์สคริปต์ ต้อง Bump เวอร์ชัน query string (`?v=x.x.x`) ใน `index.html` เสมอ

---

## 🔐 2. ข้อกำหนดระบบการเข้าสู่ระบบและออกจากระบบ (User Log-in & Authentication System Specification)

ระบบ **PMT Flow** กำหนดให้ **ระบบการยืนยันตัวตน (Authentication: Log-in & Log-off)** เป็น **Skill สำคัญอันดับหนึ่งของความปลอดภัยระบบ** ที่ต้องคงอยู่และทำงานถูกต้องสมบูรณ์ตลอดเวลา:

### 2.1 หน้าจอและการทำงานเข้าสู่ระบบ (User Log-in Flow)
1. **เกราะป้องกันด่านแรก (First-line Gatekeeper Overlay)**:
   - หากผู้ใช้งานยังไม่มียืนยันตัวตน (`!auth.user` หรือ `!auth.token`) ระบบต้องแสดงหน้าต่าง **`#login-overlay`** ทันที และซ่อนการเข้าถึงข้อมูลระบบภายในทั้งหมด
   - มีฟอร์มระบุชื่อผู้ใช้งาน/อีเมล, รหัสผ่าน พร้อมปุ่มเปิด/ปิดการมองเห็นรหัสผ่าน (Password Visibility Toggle)
   - มีข้อความแจ้งเตือนข้อผิดพลาด (Error Alert) แสดงผลชัดเจนเมื่อรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ
2. **การตรวจสอบสิทธิ์ผ่าน Backend API (`/api/v1/auth/login`)**:
   - ตรวจสอบความถูกต้องของ Username/Email และ Hash รหัสผ่าน โดยค้นหาจาก In-Memory Store ก่อนเพื่อความเร็วระดับ 0ms (Zero-Latency) ป้องกันอาการหน้าจอหมุนค้าง
   - มีกลไก Timeout Guard (AbortController 6.5 วินาที) และ Local Fallback Mode สำหรับบัญชีทดสอบ ป้องกันระบบค้างกรณีเครือข่ายขัดข้อง
   - ตรวจสอบสถานะการเปิดใช้งาน (`is_active === true`) หากบัญชีถูกปิดการใช้งานต้องปฏิเสธด้วยรหัส `USER_INACTIVE`
   - ออก Session Token (Bearer Token อายุ 8 ชั่วโมง) และเก็บลงทั้ง `sessionStorage` และ `localStorage`
3. **การบันทึกประวัติความปลอดภัย (Login Audit Trail)**:
   - บันทึกทุกความพยายามเข้าใช้งาน (ทั้งสำเร็จและไม่สำเร็จ) พร้อม IP Address, User Agent และสาเหตุความล้มเหลว เพื่อใช้ตรวจสอบในหน้า User Management

### 2.2 ข้อกำหนดมาตรฐานการออกจากระบบ (Strict Log-off / Logout Specification)
1. **การคืนสถานะสู่หน้าจอ Login อย่างสมบูรณ์ (Mandatory Hard Reload Redirect to Login Screen)**:
   - **หัวใจสำคัญ**: เมื่อผู้ใช้กดออกจากระบบ (Log off) จากจุดใดก็ตามในระบบ ต้องคืนสถานะและรีเฟรชหน้าจอใหม่อย่างสมบูรณ์ (`window.location.replace('/'); window.location.reload();`) เสมอ
   - **ห้ามเพียงแค่เปิด Modal ทับหน้าจอเดิม**: การออกจากระบบต้องสั่งยกเลิก Background Polling / Timers (`clearTimeout`, `clearInterval`) ทั้งหมด เพื่อตัดการดึงข้อมูลในเบื้องหลังอย่างเด็ดขาด
2. **ลำดับขั้นตอนการ Log off ที่ต้องปฏิบัติอย่างเคร่งครัด**:
   - ส่งคำขอไปยังเซิร์ฟเวอร์ `POST /api/v1/auth/logout` แบบ `keepalive: true` เพื่อเพิกถอน Token
   - ล้างข้อมูล Token และ User ใน Storage ทั้งหมด: `sessionStorage.clear()`, `localStorage.clear()`
   - **มาตรฐานธีมสว่างบริสุทธิ์ (Strict Light Theme Only)**: กำหนดค่าธีม `pmt-theme` เป็น `'light'` เสมอ และปลดคลาส `'dark'` ออกอย่างถาวร (ไม่มีการสลับโหมดมืด เพื่อตัดปัญหาความขัดแย้งของคอนทราสต์)
   - สั่งนำทางทันทีด้วย **`window.location.replace('/'); window.location.reload();`** เพื่อให้เบราว์เซอร์ล้างหน่วยความจำและโหลดหน้าจอ Login สดใหม่ 100%
3. **จุดเชื่อมโยงปุ่ม Log off ในระบบ (All Logout Entrypoints)**:
   - ปุ่มใน Topbar มุมขวาบน (`#topbar-auth-btn`)
   - ปุ่มใน Sidebar มุมซ้ายล่าง (`#sidebar-auth-btn`)
   - ปุ่มในโมดอลข้อมูลโปรไฟล์ส่วนตัว (`#modal-my-profile`)
   - ทุกปุ่มต้องผูกกับ `window.handleLogout()` หรือ `auth.logout()` ที่มีการรับประกัน Fail-safe Hard Reload

### 2.3 การป้องกันการเข้าถึงหน้าจอและ API (Route & Action Guards)
- **Navigation Guard**: ฟังก์ชัน `app.navigate(view)` ต้องตรวจสอบสถานะการ Login เสมอ หากยังไม่ได้เข้าสู่ระบบ ต้องเรียก `auth.showLoginOverlay()` และระงับการเปลี่ยนหน้าจอทันที
- **API Guard**: ทุก Endpoint ที่เป็นข้อมูลลับหรือการปฏิบัติงาน ต้องมี `requireAuth` Middleware ตรวจสอบ Bearer Token เสมอ

### 2.4 ข้อกำหนดโครงสร้าง DOM และการแสดงผลหน้าจอ Login (DOM Integrity & Anti-Blank Screen Safeguards)
1. **ตำแหน่งใน DOM Tree บังคับ (Top-Level Direct Child of `<body>`)**:
   - คอมโพเนนต์ **`#login-overlay` ต้องอยู่ระดับบนสุด เป็น Direct Child ของ `<body>` เสมอ**
   - **ข้อห้ามเด็ดขาด (Strict Prohibition)**: ห้ามนำ `#login-overlay` ไปซ้อนอยู่ภายใน Modal อื่น หรือ Container ย่อยใดๆ เด็ดขาด
   - **การปิดแท็ก HTML (Tag Balancing)**: ทุก Modal ใน `index.html` ต้องมีแท็กปิด `</div>` อย่างครบถ้วนสมบูรณ์ เพื่อป้องกันไม่ให้โมดอลอื่นครอบคลุม `#login-overlay` ซึ่งจะทำให้คลาส `.hidden-view` (`display: none !important;`) ของโมดอลแม่ไปล็อกไม่ให้หน้าต่าง Log-in แสดงผล
2. **การป้องกันหน้าจอว่างเปล่าสีขาว (Anti-Blank Screen Standard)**:
   - ฟังก์ชัน `auth.showLoginOverlay()` **ห้ามสั่งซ่อน `#page-container` ด้วย `display: none !important;` เด็ดขาด** เพราะจะทำให้หน้าจอกลางกลายเป็นสีขาวว่างเปล่า และทำให้ไลบรารี Chart.js พัง (Crash) เนื่องจากไม่สามารถคำนวณขนาด Canvas ได้
   - ให้ใช้คุณสมบัติของ `#login-overlay` ที่มี `fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md` ปูทับหน้าจอทั้งหมดแทน ซึ่งจะสร้างภาพเบลอสวยงาม และไม่ทำให้ Layout หรือ Canvas ใน DOM เสียหาย
3. **การส่งโฟกัสอัตโนมัติ (Auto-focus)**:
   - เมื่อ `#login-overlay` แสดงผลขึ้นมา ต้องตั้งเวลา (Timeout ~150ms) ให้ Cursor โฟกัสไปที่ช่องกรอกชื่อผู้ใช้ (`#login-username`) ทันที พร้อมให้ผู้ใช้กดแป้นพิมพ์ได้เลย

---

## 📅 3. มาตรฐานการแสดงผลวันที่ทุกหน้าจอ (Date Display Standard: DD/MM/YYYY)

ระบบ **PMT Flow** กำหนดมาตรฐานการแสดงผลวันที่สำหรับ**ทุกหน้าจอ ทุกตาราง และทุกการ์ดข้อมูล** ไว้อย่างเคร่งครัด:

### 3.1 รูปแบบวันที่มาตรฐานบังคับ (Mandatory Date Format)
- **วันที่ทั่วไป**: ต้องแสดงผลในรูปแบบ **`DD/MM/YYYY`** (วัน/เดือน/ปี ค.ศ. มีเลข 0 นำหน้า เช่น `07/09/2026`, `15/01/2026`)
- **วันที่พร้อมเวลา**: ต้องแสดงผลในรูปแบบ **`DD/MM/YYYY HH:mm`** หรือ **`DD/MM/YYYY HH:mm:ss`** (เช่น `07/09/2026 14:30`)
- **ช่วงวันที่ (Date Range)**: แสดงในรูปแบบ **`DD/MM/YYYY ถึง DD/MM/YYYY`** (เช่น `01/09/2026 ถึง 09/09/2026`)

### 3.2 ขอบเขตการบังคับใช้ (Applicable Scope - All Views)
ข้อกำหนดนี้ครอบคลุมทุกหน้าจอในระบบอย่างไม่มีข้อยกเว้น:
1. **แดชบอร์ดภาพรวม (Dashboard Overview)**: วันที่สร้างคำสั่งซื้อ, วันที่เริ่มงาน, วันที่ส่งมอบ
2. **Step 1: รับ Order & เปิดใบงาน (Survey / Order Intake)**: วันที่รับงาน INT, วันที่นัดสำรวจหน้างาน, วันที่สั่งซื้อ
3. **Step 2: ออกแบบ & แปลนติดตั้ง (Design & Blueprint)**: วันที่อัปโหลดแบบ, วันที่อนุมัติแบบ CAD
4. **Step 3: เตรียมแผนงานและทีมช่าง (Project Conversion)**: วันที่แปลงเข้าแผนงาน, วันที่มอบหมายช่าง
5. **Step 4: ติดตั้ง & แผนงาน Gantt (Gantt Projects Timeline & Daily Logs)**: วันที่เริ่มต้น/สิ้นสุดแต่ละ Task, วันบันทึกช่างประจำวัน
6. **Step 5: ตรวจรับงาน QC (QC Online / On-site Audit & Scoring)**: วันนัดตรวจ QC, วันที่ลงตรวจจริง, วันที่ส่งรายงาน
7. **Step 6: สรุปงานสำเร็จ & ส่งต่อ STK (Completed Jobs Summary & STK Outbound)**: วันที่ส่ง API ปิดงานเข้าระบบ STK (คะแนน CSAT ดำเนินการในระบบ STK)
8. **คลังรายการ BOQ กลาง (Central BOQ Repository)**: วันที่สร้างใบเสนอราคา, วันที่อนุมัติงบประมาณ
9. **บริการหลังการขาย & สัญญา MA**: วันที่เริ่ม-สิ้นสุดสัญญา MA, วันรอบตรวจบำรุงรักษา
10. **User Management & Audit Logs**: วันที่เข้าสู่ระบบล่าสุด (Last Login), วันเวลาที่บันทึก Login Audit Trail

### 3.3 ข้อห้ามและแนวทางปฏิบัติ (Guidelines & Restrictions)
- **ข้อห้ามเด็ดขาด (Strict Prohibition)**: **ห้ามใช้ Native `<input type="date">` หรือ `<input type="datetime-local">` ของเบราว์เซอร์เด็ดขาด** เนื่องจากเบราว์เซอร์ (Chromium/Windows) จะดึง Locale ของระบบปฏิบัติการมาใช้ ทำให้วันที่สลับเป็น `MM/DD/YYYY` (เช่น `09/10/2026`) ซึ่งขัดแย้งกับมาตรฐานขององค์กร
- **Mandatory Custom Flatpickr**: ช่องกรอกวันที่ทุกช่องในระบบต้องใช้ **Custom Light-Theme Flatpickr (`data-datepicker="true"`, `placeholder="DD/MM/YYYY"`)** พร้อมไอคอนปฏิทิน (`ph-calendar`) และป๊อปอัปเลือกวันที่ภาษาไทย/อังกฤษที่สวยงามอ่านง่าย 100%
- **Data Conversion Standard**:
  - แสดงผลบน UI: ใช้ `app.formatDateDMY(date)` หรือ `app.formatDateTimeDMY(datetime)`
  - แปลงเพื่อส่ง API/เก็บข้อมูล: ใช้ `app.formatDateISO(date)` หรือ `app.formatDateTimeISO(datetime)`
- **Prohibited Formats**: ห้ามแสดงวันที่ในรูปแบบ `YYYY-MM-DD` (เช่น `2026-09-07`) หรือ `MM/DD/YYYY` (เช่น `09/07/2026`) บนหน้าจอแสดงผลที่ผู้ใช้งานมองเห็น (User-Facing UI) เด็ดขาด

---

## ⏰ 4. มาตรฐานการแสดงผลและบันทึกเวลา 24 ชั่วโมง (24-Hour Time Standard: Strictly NO AM/PM)

ระบบ **PMT Flow** กำหนดมาตรฐานเวลาสำหรับทุกหน้าจอและทุกฟอร์มบันทึกเวลาไว้อย่างเด็ดขาด:

### 4.1 รูปแบบเวลามาตรฐานบังคับ (Mandatory 24-Hour Clock)
- **ระบบเวลา 24 ชั่วโมง**: ต้องใช้ระบบ 24 ชม. เท่านั้น (`00:00 - 23:59 น.` เช่น `07:00`, `08:30`, `12:00`, `13:00`, `17:00`, `18:00`)
- **ข้อห้ามเด็ดขาด (Prohibited)**: ห้ามแสดงผลหรือมีปุ่ม AM / PM บน UI ที่ผู้ใช้งานมองเห็นเด็ดขาด (เช่น ห้าม `08:30 AM`, ห้าม `05:00 PM`)
- **การเลือกเวลา (Time Input)**: ห้ามใช้ Native `<input type="time">` ของเบราว์เซอร์โดยตรง เนื่องจาก Chromium/Windows จะเปิดตัวเลือกแบบ 12 ชม. (AM/PM) ตาม Locale ของเครื่อง
- **Custom 24-Hour Picker**: ให้ใช้คอมโพเนนต์ Custom Dropdown:
  - **ชั่วโมง (Hour)**: `06`, `07`, `08`, `09`, `10`, `11`, `12`, `13`, `14`, `15`, `16`, `17`, `18`, `19`, `20`, `21`, `22`, `23`, `00`..`05`
  - **นาที (Minute)**: `00`, `05`, `10`, `15`, `20`, `25`, `30`, `35`, `40`, `45`, `50`, `55`
  - **ปุ่มลัดกะเวลาด่วน (Quick Shift Presets)**: เช่น `08:00 - 17:00`, `08:30 - 17:00`, `08:30 - 17:30`, `09:00 - 18:00`, `13:00 - 17:00`
  - เก็บค่าลง `<input type="hidden">` ในรูปแบบมาตรฐาน `"08:30"` และ `"17:00"` เสมอ

---

## 🛠️ 5. ข้อกำหนดฟังก์ชันบันทึกงานช่างประจำวัน (Daily Technician Work Log Specification)

ระบบต้องมีฟังก์ชันบันทึกงานช่างประจำวัน เพื่อให้ช่างหน้างานรายงานความคืบหน้ารายวันได้อย่างละเอียดและส่งต่องานเข้าสู่กระบวนการตรวจ QC:

### 5.1 ขอบเขตหน้าจอและการเข้าถึง (Single-Entry Integrated Modal)
1. **เข้าถึงแบบรวมศูนย์จุดเดียว (Single-Entry Modal)**: รวมศูนย์การบันทึกงานช่างประจำวันไว้ที่จุดเดียวผ่าน **โมดอลป๊อปอัป (`modal-daily-work-log`)** โดยกดจากแถบงานของช่างแต่ละ Task ในตาราง Gantt Chart ผ่านปุ่ม **"บันทึกช่าง"** (`app.openDailyWorkLogModal(taskId)`) เพื่อตัดความซ้ำซ้อนและป้องกันความสับสนในการบันทึกข้อมูล
2. **Auto-Redirect ป้องกัน Broken Links**: หากมีการเรียก `app.navigate('daily-logs')` ระบบจะทำ Clean Redirect ไปยังหน้า Gantt Timeline (`app.navigate('gantt')`) อัตโนมัติ

### 5.2 ข้อมูลที่บันทึกในแต่ละวัน (เน้นเฉพาะบันทึกความคืบหน้ารายวัน)
- **วันที่เข้าทำงาน (Work Date)**: แสดงผลในรูปแบบ `DD/MM/YYYY`
- **รอบที่ / วันที่ในแผนงาน (Day #)**: ระบุรอบวันทำงาน เช่น รอบที่ 1 / 3 วัน
- **เวลาเริ่มและสิ้นสุด (Time Tracking)**: ใช้ Custom 24-Hour Picker พร้อมสรุปเวลารวมเรียลไทม์ เช่น `⏱️ รวม 8 ชม. 30 นาที (08:30 - 17:00 น.)`
- **ผู้บันทึก & บทบาท**: ดึงชื่อช่างที่รับผิดชอบงานหรือผู้ใช้งานปัจจุบันอัตโนมัติ โดยมีบทบาทเริ่มต้นเป็นช่างหน้างาน (`TECH`)
- **รายละเอียดงานที่ทำในวันนี้ (Daily Accomplishment)**: ช่องระบุเนื้องานที่ทำเสร็จในวันนั้น
- **ข้อมูลเพิ่มเติม & อุปกรณ์ที่ติดตั้ง**: ระบุแบบแปลน CAD อ้างอิง และรายการอุปกรณ์/อะไหล่ที่ติดตั้งจริง
- **ปัญหาและอุปสรรคหน้างาน**: บันทึกสภาพอากาศ หรืออุปสรรคหน้างาน
- **ปุ่มบันทึก**: มีปุ่ม `💾 บันทึกความคืบหน้ารายวัน` และปุ่ม `ยกเลิก` พร้อมลิงก์นำทางไปยังหน้าถัดไป (Step 5: ตรวจรับรองคุณภาพ QC & บันทึกปิดงาน)
- **การตัดองค์ประกอบส่วนเกินตามความต้องการผู้ใช้**: ตัดแถบปุ่มลัดกะเวลา Preset, ตัดแถบ Slider ความคืบหน้าแบบปรับมือ, ตัดกล่องติ๊กจบงานก่อนกำหนด และตัดปุ่มส่งตรวจ QC ออกจากฟอร์มนี้ เพื่อให้ฟอร์มทำงานกระชับและบันทึกเฉพาะความคืบหน้ารายวัน

### 5.3 แผงแนบรูปถ่ายหน้างาน 5 รูป (5 Photo Slots) พร้อมระบบ Preview
- บังคับแบ่ง 5 ช่องตามขั้นตอนงาน:
  1. `รูปที่ 1: ก่อนเริ่มงาน (Before)`
  2. `รูปที่ 2: ระหว่างทำ #1 (During 1)`
  3. `รูปที่ 3: ระหว่างทำ #2 (During 2)`
  4. `รูปที่ 4: ความปลอดภัย & ทดสอบ (Testing)`
  5. `รูปที่ 5: งานเสร็จสมบูรณ์ (After)`
- รองรับการอัปโหลดไฟล์จริงจากเครื่องหรือถ่ายรูปผ่านสมาร์ตโฟน
- แสดงผล Thumbnail ตัวอย่างทันที
- **ระบบ Preview ขยายดูรูปใหญ่ (Lightbox Modal)**: คลิกที่รูปเพื่อเปิดดูรูปขนาดเต็ม พร้อมคำบรรยาย, Phase, ชื่อช่าง และเวลาบันทึก
- มีปุ่มโหลดรูปตัวอย่างเสมือนจริง 5 ภาพ (`Load Sample Photos`) สำหรับการสาธิตและทดสอบ

### 5.4 การแยกขั้นตอนบันทึกปิดงานโครงการ (Job Closeout Moved to Step 5: QC)
- **การบันทึกงานช่างประจำวัน (Daily Log)**: ทำหน้าที่บันทึกความคืบหน้าของช่างในแต่ละวัน โดยระบบคำนวณเปอร์เซ็นต์สะสมตามจำนวนวันที่เข้างานจริงเทียบกับแผนงานใน Gantt อัตโนมัติ
- **การบันทึกปิดงานโครงการ (บันทึกปิดงาน ให้ไปอยู่หน้าถัดไป)**: ย้ายการปิดงานโครงการไปอยู่ที่ **Step 5: การตรวจรับรองคุณภาพ QC** โดยทีมผู้ตรวจ QC จะเป็นผู้ตรวจสอบเนื้องาน ภาพถ่าย ประเมินเกณฑ์มาตรฐาน และคลิกปุ่ม **"✓ บันทึกปิดงาน & อนุมัติผ่านเกณฑ์ QC"** เพื่อสรุปและปิดโครงการ พร้อมส่งข้อมูลเข้าสู่ระบบ STK ต่อไป

---

## 🔄 6. ภาพรวมขอบเขต Flow งาน 6 ขั้นตอน (6-Step Pipeline Scope)

ระบบ PMT Flow ควบคุมกระบวนการตั้งแต่ต้นน้ำถึงปลายน้ำ โดยแบ่งประเภทงานออกเป็น 2 สายหลัก:
- **Renovate Projects (งานปรับปรุง/ต่อเติม)**: ดำเนินงานครบ 6 ขั้นตอน (Step 1 ➔ Step 2 ➔ Step 3 ➔ Step 4 ➔ Step 5 [On-site QC & Advance Booking] ➔ Step 6)
- **Quick Services (งานบริการติดตั้งด่วน)**: ดำเนินงานแบบ Fast-track (Step 1 ➔ ข้าม Step 2, 3, 4 ตรงเข้า Step 5 [QC Online จากภาพถ่าย Visit Plan] ➔ Step 6) ในหน้าจอ One-Stop Studio จะ Disable Step 2 (Design) และ Step 3 (BOQ) อัตโนมัติ ข้อมูลช่างจะถูก STAMP มาจาก INT โดยตรง และไม่ต้องไปหน้า Ticket เมื่อกด Save (บันทึกข้อมูล) จะวิ่งตรงเข้าคิวตรวจ QC Online ทันทีเพื่อปิดงาน

รายละเอียดขั้นตอนหลัก 6 ขั้นตอน:
1. **Step 1: รับเรื่อง & เปิดใบงาน (Survey / Order Intake)** - รับงานจากภายนอก/INT หรือสร้าง Order ภายใน พร้อมระบบนัดหมายสำรวจหน้างาน
2. **Step 2: ออกแบบ & แปลนติดตั้ง (Design & Blueprint / Ticket & Receipt)** - แนบแบบแปลน 2D/3D และแบบติดตั้ง ออก Ticket และแนบสลิปชำระเงิน
3. **Step 3: เตรียมแผนงานและทีมช่าง (Project Conversion: BOQ -> Tasks & Assign Tech)** - แปลงรายการค่าแรงจาก BOQ เป็น Task กิจกรรมและจัดสรรช่างเข้าทีม (เฉพาะงาน Renovate)
4. **Step 4: ติดตั้ง & แผนงาน Gantt (Gantt Projects Timeline & Daily Work Logs)** - แผนงาน Gantt ติดตามความคืบหน้าหน้างาน และบันทึกงานช่างประจำวัน (Daily Log 24 ชม. พร้อมรูปถ่าย 5 ช่อง)
5. **Step 5: ตรวจรับงาน QC (QC Online / On-site Audit & Scoring)** - ตรวจรับรองงานตามเกณฑ์มาตรฐาน:
   - **Quick Services**: ตรวจแบบ Online จากภาพถ่าย Visit Plan / INT ประเมิน **1 ข้อคำถามเดียวจบกระบวนการ ("ช่างทำงานได้ตามมาตรฐานการทำงานที่กำหนด")** ตัดปุ่มเหมา 5 ข้อออก
   - **Renovate Projects**: จองคิวช่าง QC Lead ล่วงหน้า และประเมินให้คะแนนมาตรฐาน Isara Chootip (5 ข้อคำถาม Yes=5/No=1)
   - **ระบบบันทึกประวัติการตรวจ & ส่งแก้งาน (Inspection & Rework History)**: บันทึกใน `job.qc_history` ทุกครั้ง (ระบุครั้งที่ 1, 2, 3, 4..., วันที่-เวลา 24 ชม., ผู้ตรวจ, ผลตรวจ, คะแนน, หมายเหตุ)
   - **🚨 กฎเหล็กคะแนนรอบแก้ไข (Strict 1.0 Score Penalty for Round >= 2)**: รอบแรกผ่านได้ 5.0 คะแนนเต็ม หากผ่านการแจ้งส่งกลับแก้ไขงาน (Rework) หรือเป็นการตรวจตั้งแต่ครั้งที่ 2 เป็นต้นไป แม้จะกดให้ผ่าน (Yes) ระบบจะบังคับล็อกคะแนนที่ **1.0 คะแนนอัตโนมัติ** เสมอ เพื่อความโปร่งใสและสะท้อนคุณภาพงานตามเกณฑ์ First-time Pass
6. **Step 6: สรุปงานสำเร็จ & ส่งต่อ STK (Completed Jobs Summary & STK Outbound)** - รวบรวมงานที่ผ่าน QC และส่งถ่ายข้อมูลปิดงานผ่าน REST API เข้าสู่ระบบ STK (สถานะ CLOSED, 200 OK) โดยการประเมินคะแนนความพึงพอใจลูกค้า (CSAT) จะดำเนินการผ่านระบบ STK โดยตรง พร้อมดูแลสัญญา MA ต่อเนื่อง

*หมายเหตุเรื่องคลังรายการ BOQ*: **คลังรายการ BOQ กลาง (Central BOQ Repository)** ทำหน้าที่เป็นศูนย์กลางข้อมูลประมาณการราคาและรายการพัสดุ (Master BOQ Data) ที่เข้าถึงได้อิสระจาก Topbar/Sidebar/Job Modals โดยปลดออกจากลำดับขั้นตอนบังคับใน Pipeline เพื่อความคล่องตัวสูงสุด (Decoupled from linear execution)

---

## 🛡️ 7. ข้อบังคับด้านความปลอดภัยและ Deployment
1. **API Authentication**: ทุก Endpoint ภายใต้ `/api/v1/users` ต้องผ่าน Middleware `requireAuth` และ `requireRole(ADMIN)`
2. **Production First**: โค้ดทั้งหมดต้องทดสอบและ Build (`npm run build`) พร้อมผลักดันขึ้น `git push origin main` เพื่อให้อัปเดตสู่ระบบจริงที่ `https://vibepmt.online` เสมอ

---

## 📚 8. ข้อบังคับการปรับปรุงคู่มือระบบ Online ทุกครั้งที่มีการแก้ไข Process (Mandatory Online System Manual Update)

**🚨 ข้อบังคับสูงสุด (Strict Mandatory Rule):**
ทุกครั้งที่มีการปรับปรุง พัฒนา หรือเปลี่ยนแปลงกระบวนการทำงาน (Workflow / Process / Business Logic / State Transition / UI Flow) ในระบบ PMT Flow ไม่ว่าจะเป็นส่วนงานใด:
1. **การอัปเดตคู่มือระบบ Online ทันที (Synchronous Manual Updates)**:
   - เมื่อทำการแก้ไขโค้ดและทดสอบความถูกต้องเรียบร้อยแล้ว **จะต้องทำการอัปเดตเอกสารคู่มือระบบ Online ที่เกี่ยวข้องควบคู่ไปด้วยเสมอ**
   - ห้ามปิดงานหรือหยุดการทำงานโดยไม่ได้อัปเดตคู่มือระบบเด็ดขาด
2. **ขอบเขตเอกสารคู่มือที่ต้องปรับปรุง**:
   - **ไฟล์คู่มือการใช้งานในโฟลเดอร์ `doc/`**:
     - `doc/คู่มือการใช้งาน_Step1_คิวงานรับคำสั่งซื้อใหม่.md`
     - `doc/คู่มือการใช้งาน_Step2_บันทึกแบบแปลนติดตั้ง.md`
     - `doc/คู่มือการใช้งาน_Step3_นำBOQเข้าระบบ.md`
     - `doc/คู่มือการใช้งาน_Step4_บันทึกTicketและใบเสร็จ.md`
     - `doc/คู่มือการใช้งาน_Step5_บันทึกBOQเข้าProjectและGantt.md`
     - `doc/คู่มือการใช้งาน_Step6_ตรวจรับรองคุณภาพQC.md`
     - `doc/คู่มือการใช้งาน_Step7_CSATและบริการหลังการขาย.md`
     - `doc/คู่มือการใช้งาน_การเข้าหน้างานและCheckIn.md`
     - `doc/คู่มือการใช้งาน_แดชบอร์ดและจัดการผู้ใช้งาน.md`
     - `doc/PMT_Flow_User_Training_Manual.md` และ `doc/PMT_Training_Curriculum_Master.md`
   - **หน้าจอศูนย์รวมคู่มือฝึกอบรมและ FAQ ภายในระบบ (`page-faq` ใน `index.html`)**:
     - อัปเดตเนื้อหาในโมดูลที่เกี่ยวข้อง, ผังขั้นตอน End-to-End Workflow, และตาราง Status Transition Reference Table ให้ตรงกับ Process ล่าสุด
3. **การรับประกันความสอดคล้อง (100% Documentation & Live Code Sync)**:
   - เอกสารและคู่มือทั้งหมดต้องเปิดอ่านได้จริงบนระบบ Online (`https://vibepmt.online`) ผ่านเมนู **"คู่มือ & FAQ ระบบ"** (`nav-faq`) เพื่อให้เจ้าหน้าที่ปฏิบัติงาน, วิทยากรผู้ฝึกอบรม (Trainer), และผู้บริหาร ได้รับข้อมูลที่ถูกต้องตรงกับระบบจริงเสมอ

---

## 📊 9. ข้อกำหนดรูปแบบมุมมองเริ่มต้นของระบบ (Mandatory Default List View Standard: Strictly List View First)

ระบบ **PMT Flow** กำหนดมาตรฐานรูปแบบมุมมองเริ่มต้น (Default Initial View Mode) สำหรับทุกหน้าจอที่มีระบบสลับมุมมอง (View Switchers) ไว้อย่างเคร่งครัด:

### 9.1 รูปแบบมุมมองเริ่มต้นบังคับ (Mandatory Default: List View Only)
- **มุมมองเริ่มต้น (Default View)**: ทุกโมดูลที่มีปุ่มสลับมุมมองระหว่างแบบการ์ด (Card View) และแบบตารางรายการ (List View) **ต้องเริ่มต้นการแสดงผลเป็น "แบบตารางรายการ (List View)" เสมอ**
- **เหตุผลความจำเป็น**: 
  - เพื่อให้เจ้าหน้าที่ (SA / Admin / AE / QC) สามารถกวาดสายตาตรวจสอบข้อมูลคำสั่งซื้อ, ป้ายสถานะ (Status Badges), ป้ายรายการใหม่ (`NEW!`), และวันที่ ได้ครบถ้วนในบรรทัดเดียว
  - ลดการเลื่อนหน้าจอ (Vertical Scrolling) เมื่อเทียบกับ Card View ที่กินพื้นที่หน้าจอสูง
  - สะดวกต่อการ Sort, Search, และเปรียบเทียบข้อมูลจำนวนมาก
- **มุมมองการ์ด (Card View)**: คงไว้เป็นทางเลือกเสริม (Optional Alternative) สำหรับผู้ใช้ที่ต้องการดูภาพตัวอย่างขนาดใหญ่ แต่**ห้ามตั้งเป็นค่าเริ่มต้นของระบบเด็ดขาด**

### 9.2 ขอบเขตหน้าจอและตัวแปรควบคุม (Applicable Modules & Control Variables)
ข้อกำหนดนี้บังคับใช้กับทุกหน้าจอที่มี View Mode Switcher:
1. **Step 2: บันทึก Design & แบบแปลนติดตั้ง (Blueprints & CAD)**:
   - State Variable: `blueprintViewMode = 'list'`
   - Storage Key: `localStorage.getItem('pmt_blueprint_view_mode') || 'list'`
   - HTML Active Button: ปุ่ม `#btn-blueprint-view-list` ต้องมีคลาส Active เป็นค่าเริ่มต้น
2. **Step 3: เตรียมแผนงานและทีมช่าง (Project Conversion)**:
   - State Variable: `conversionViewMode = 'list'`
   - Storage Key: `localStorage.getItem('pmt_conversion_view_mode') || 'list'`
   - HTML Active Button: ปุ่ม `#btn-conversion-view-list` ต้องมีคลาส Active เป็นค่าเริ่มต้น
3. **Step 4: Gantt Projects (เลือกโครงการในหน้า Gantt Timeline)**:
   - State Variable: `projectViewMode = 'list'`
   - Storage Key: `localStorage.getItem('pmt_project_view_mode') || 'list'`
   - HTML Active Button: ปุ่ม `#btn-project-view-list` ต้องมีคลาส Active เป็นค่าเริ่มต้น
4. **คลังรายการ BOQ กลาง (Central BOQ Repository)**:
   - State Variable: `boqViewMode = 'list'`
   - Storage Key: `localStorage.getItem('pmt_boq_view_mode') || 'list'`
   - HTML Active Button: ปุ่ม `#btn-boq-view-list` ต้องมีคลาส Active เป็นค่าเริ่มต้น
5. **รายการ Ticket & ใบเสร็จ (Tickets & Receipts)**:
   - State Variable: `ticketViewMode = 'list'`
   - Storage Key: `localStorage.getItem('pmt_ticket_view_mode') || 'list'`
   - HTML Active Button: ปุ่ม `#btn-ticket-view-list` ต้องมีคลาส Active เป็นค่าเริ่มต้น

### 9.3 ข้อกำหนดทางเทคนิค (Technical Safeguards)
- ทุกฟังก์ชันสลับมุมมอง เช่น `updateBlueprintViewModeButtons()`, `updateBOQViewModeButtons()`, `updateTicketViewModeButtons()`, `updateConversionViewModeButtons()`, `updateProjectViewModeButtons()` ต้องใช้ Fallback Value เป็น `'list'` เสมอ
- ใน `index.html` แท็กปุ่ม List View ต้องได้รับสไตล์ Active (`bg-white shadow-sm text-indigo-600 font-semibold`) และปุ่ม Card View ต้องเป็น Inactive (`text-slate-500 hover:text-slate-700`)

---

## 🗄️ 10. สถาปัตยกรรมฐานข้อมูลและการจัดเก็บรูปภาพ (Database & Media Storage Specification)

### 10.1 ฐานข้อมูล PostgreSQL Persistent Storage 100%
- ทั้งสภาพแวดล้อม **Production (`prod.vibepmt.online`)** และ **Dev/UAT (`vibepmt.online`)** ทำงานบนฐานข้อมูล PostgreSQL แยก Instance กันโดยสมบูรณ์ ไม่มีการรันบนหน่วยความจำ In-Memory เพียงอย่างเดียว
- การเขียนข้อมูล (Create, Update, Delete) จะทำการบันทึกลงตาราง PostgreSQL (`core_jobs`, `core_daily_work_logs`, `core_qc_bookings`, `ma_contracts`, `ma_rounds`, `sys_users`, `sys_user_sessions`, `sys_login_log`, `sys_api_logs`, `core_staging_reports`) ทันที
- มีกลไก In-Memory Cache ช่วยให้อ่านข้อมูลได้รวดเร็วระดับ 0ms และทำหน้าที่เป็น Fallback เมื่อระบบเน็ตเวิร์กมี Latency

### 10.2 การจัดเก็บรูปภาพ (Image & Photo Storage)
- **การบีบอัดภาพหน้าบ้าน**: ฝั่ง Frontend บีบอัดรูปภาพด้วยฟังก์ชัน `compressImage(file, maxDim = 1200, quality = 0.8)` ให้อยู่ในรูป Base64 Data URI หรือ URL
- **การบันทึกลง Database**: จัดเก็บรูปภาพลงในคอลัมน์ `JSONB` และ `TEXT` ของตาราง PostgreSQL โดยตรง (`core_daily_work_logs.photos`, `core_jobs.photos`, `core_qc_bookings.photos`, `core_jobs.csat_photos`, `core_jobs.file_int_image`)
- **ความคงทนของข้อมูล**: ข้อมูลรูปภาพจะไม่สูญหายเมื่อมีการ Deploy หรือ Restart คอนเทนเนอร์ และสามารถสำรองข้อมูล (Backup) ร่วมกับฐานข้อมูลได้ในจุดเดียว

---

## 🖤 11. มาตรฐานสีตัวอักษรสีดำทุกหน้าจอ (Strict Black Font Standard: 100% Pure Black Text for Maximum Legibility)

ระบบ **PMT Flow** กำหนดมาตรฐานสีตัวหนังสือสำหรับทุกหน้าจอ, ทุกตาราง, ทุกการ์ด, และทุกฟอร์มกรอกข้อมูล ไว้อย่างเคร่งครัดสูงสุด:

### 11.1 ข้อกำหนดสีตัวอักษรมาตรฐานบังคับ (Mandatory Pure Black Text)
- **สีตัวหนังสือหลัก 100% สีดำ**: ตัวอักษรเนื้อหา, ป้ายกำกับ (Labels), หัวเรื่อง (Headings), ข้อมูลในตาราง (Table Data `th`, `td`), รายละเอียดในการ์ด (Card Details), ช่องกรอกข้อมูล (Inputs, Textareas, Selects), และเมนู Sidebar ในสภาวะปกติ **ต้องแสดงผลเป็นสีดำบริสุทธิ์ (`#000000` หรือ Pure Black)** เสมอ
- **ตัดปัญหาตัวหนังสือสีเทาจาง (Zero Washed-Out Text)**: ห้ามใช้สีตัวอักษรสีเทาอ่อนหรือเทาจาง (เช่น `text-gray-400`, `text-slate-400`, หรือ `--muted-foreground: #71717a`) สำหรับข้อมูลสำคัญ เพราะจะทำให้กลืนกับพื้นหลังสีขาวหรืออ่านยากในสภาพแสงจ้า
- **ความคมชัดสูงสุด (Maximum Contrast Ratio)**: การใช้สีดำบนพื้นหลังสีขาว/สว่าง (Light Theme) ช่วยให้เจ้าหน้าที่ปฏิบัติงาน (AE, QC, Admin, CC) อ่านข้อมูล รหัสคำสั่งซื้อ วันที่ และรายละเอียดหน้างานได้อย่างรวดเร็ว ถูกต้อง แม่นยำ ไม่ปวดสายตา

### 11.2 การกำหนดค่าตัวแปร CSS System (CSS Design Tokens)
ในไฟล์ `public/css/app.css` ทั้ง `:root` และคลาส `.dark` ต้องกำหนดตัวแปรสีตัวอักษรเป็นสีดำ `#000000`:
- `--foreground: #000000;`
- `--card-foreground: #000000;`
- `--popover-foreground: #000000;`
- `--secondary-foreground: #000000;`
- `--muted-foreground: #000000;`
- `--accent-foreground: #000000;`

### 11.3 ขอบเขตการบังคับใช้ระดับคอมโพเนนต์ (Component-Level Scope)
1. **ตารางและรายการข้อมูล (Tables & Lists - Step 1 ถึง Step 6)**:
   - หัวคอลัมน์ (`th`): ข้อความสีดำเข้มชัดเจน
   - แถวข้อมูล (`td`): รหัส Order, ชื่อลูกค้า, เบอร์โทรศัพท์, วันที่, แพ็กเกจบริการ แสดงผลเป็นสีดำชัดเจน
2. **ฟอร์มและอินพุต (Forms & Input Fields)**:
   - ข้อความที่พิมพ์ในช่องกรอก (`input`, `select`, `textarea`): สีดำ `#000000`
   - ช่องที่ถูกล็อกอ่านอย่างเดียว (`readonly`) หรือปิดการใช้งาน (`disabled`): แสดงผลด้วยสีดำ `#000000` (ห้ามจางหรือโปร่งแสงจนอ่านไม่ออก)
   - ข้อความตัวอย่าง (Placeholder): สีเทากลาง (`#64748b`) เพื่อให้แยกแยะออกจากข้อความที่กรอกจริงได้อย่างชัดเจน
3. **การ์ดและป๊อปอัปโมดอล (Cards, Panels & Modal Popups)**:
   - หัวข้อ (`h1` - `h6`), รายละเอียดปลีกย่อย, คำอธิบายฟิลด์, และป้ายกำกับฟอร์ม (`label`) ทั้งหมดต้องเป็นสีดำ
4. **ปุ่มและป้ายสถานะเฉพาะ (Protected Exceptions)**:
   - ข้อความบนปุ่มหลักสีเข้ม (เช่น ปุ่มม่วง `btn-artifact-primary`, ปุ่มสถานะสีทึบ) ยังคงใช้ข้อความสีขาว (`text-white`)
   - ป้ายสถานะงาน (Status Badges เช่น `.status-new` สีแดง, `.status-qc-passed` สีเขียว, `.status-in-progress` สีส้ม) ยังคงรักษาสีสถานะตามมาตรฐานเพื่อการสื่อสารสถานะที่ถูกต้อง




