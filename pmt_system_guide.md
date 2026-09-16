# PMT Flow - คู่มือสถาปัตยกรรมและโครงสร้างระบบ (System Architecture & Technical Guide)

เอกสารสรุปสถาปัตยกรรมระบบ โครงสร้างฐานข้อมูล การจัดเก็บไฟล์รูปภาพ และข้อกำหนดทางเทคนิคของระบบ **PMT Flow (Enterprise Operations System)**

---

## 🗄️ 1. สถาปัตยกรรมฐานข้อมูลและความคงทนของข้อมูล (Database Persistence)

ระบบ **PMT Flow** ทั้งในสภาพแวดล้อม **Production** และ **UAT / Dev (Staging)** ทำงานบนระบบฐานข้อมูล **PostgreSQL แบบ Persistent Storage 100%** (ไม่ใช้การรันบนหน่วยความจำ In-Memory เพียงอย่างเดียว):

### 1.1 การแยกสภาพแวดล้อม (Two Independent Environments)

| คุณสมบัติ | Dev / UAT / Staging | Production |
|---|---|---|
| **URL** | https://vibepmt.online | https://prod.vibepmt.online |
| **Git Branch** | main | production |
| **Database Instance** | PostgreSQL บน Dev Server | PostgreSQL บน Production Server |
| **ระบบ Deploy** | Coolify Auto-deploy เมื่อพุช main | User Manual Deploy บน Coolify |
| **สถานะการเก็บข้อมูล** | บันทึกลง PostgreSQL ถาวร | บันทึกลง PostgreSQL ถาวร |

### 1.2 โครงสร้างตารางหลักใน PostgreSQL

| ชื่อตาราง (Table Name) | รายละเอียดข้อมูลที่จัดเก็บ | ความสำคัญ |
|---|---|---|
| **core_jobs** | ข้อมูลคำสั่งซื้อทั้งหมด, ข้อมูลลูกค้า, แบบแปลนติดตั้ง (Step 2), ข้อมูล BOQ & Tasks (Step 3), ใบเสร็จ/ตั๋วงาน (Step 4), แผนงานติดตั้ง Gantt, และผลประเมิน CSAT | แกนหลักของกระบวนการ 6-Step Pipeline |
| **core_daily_work_logs** | บันทึกการทำงานประจำวันของช่าง (Daily Technician Work Log) พร้อมรูปถ่ายหน้างาน | ตรวจสอบความคืบหน้ารายวันของช่าง |
| **core_qc_bookings** | ข้อมูลการนัดหมายและยืนยันคิวงาน QC (Online / On-site) | ตรวจสอบคุณภาพงานติดตั้ง |
| **ma_contracts & ma_rounds** | สัญญาบริการบำรุงรักษา (MA) และรอบการเข้าบริการ | งานบริการหลังการขาย |
| **sys_users** | ข้อมูลผู้ใช้งานระบบ, สิทธิ์บทบาท (ADMIN, AE, QC, CONTACT_CENTER), Password Hash | การจัดการผู้ใช้และการควบคุมสิทธิ์ RBAC |
| **sys_user_sessions** | ข้อมูล Session Token ที่เปิดใช้งานอยู่ | การตรวจสอบสิทธิ์การเข้าใช้งาน |
| **sys_login_log** | ประวัติการพยายามเข้าสู่ระบบ (Success / Failed, IP, User Agent) | ตรวจสอบความปลอดภัยและ Audit Trail |
| **sys_api_logs / inbound_api_logs** | บันทึกประวัติการเรียกใช้งาน Inbound & Outbound API | มอนิเตอร์ระบบและการเชื่อมต่อภายนอก |
| **core_staging_reports** | รายงานการตรวจรับและส่งมอบงาน Staging | การส่งต่องานระหว่างขั้นตอน |

### 1.3 กลไก In-Memory Cache (0ms Fast Layer)
* **Write Operations**: ทุกคำสั่งเพิ่ม ลบ หรือแก้ไขข้อมูล (Create/Update/Delete) จะเขียนและบันทึก (COMMIT) ลงฐานข้อมูล PostgreSQL ทันที
* **Server Boot / Hydration**: เมื่อเซิร์ฟเวอร์เริ่มทำงาน ฟังก์ชัน hydrateFromDatabase() จะดึงข้อมูลล่าสุดทั้งหมดจาก PostgreSQL ขึ้นมา Sync
* **Zero-Latency Response**: มี In-Memory Cache ช่วยให้อ่านข้อมูลได้รวดเร็วระดับ 0ms และทำหน้าที่เป็น Fail-safe ป้องกันหน้าจอหมุนค้าง

---

## 📸 2. โครงสร้างและการจัดเก็บไฟล์รูปภาพ (Image & Media Storage Architecture)

รูปภาพทั้งหมดที่มีการบันทึกในระบบ **จัดเก็บอยู่ภายในฐานข้อมูล PostgreSQL โดยตรง (Database-Level Storage)** ไม่ได้เก็บเป็นไฟล์แยกบนดิสก์ของคอนเทนเนอร์:

### 2.1 กระบวนการประมวลผลรูปภาพ (Image Processing Flow)
1. **Client-side Compression (การบีบอัดภาพหน้าบ้าน)**:
   - ฟังก์ชัน compressImage(file, maxDim = 1200, quality = 0.8) จะปรับลดขนาดรูปภาพไม่ให้เกิน 1200px และบีบอัดคุณภาพไฟล์
   - แปลงไฟล์รูปภาพให้อยู่ในรูปแบบ **Base64 Data URI** (data:image/jpeg;base64,...) หรือ URL มาตรฐาน
2. **Database Persistence (การบันทึกลงฐานข้อมูล)**:
   - ข้อมูลรูปภาพจะถูกบันทึกลงในคอลัมน์ประเภท **JSONB** หรือ **TEXT** ของ PostgreSQL ตามตารางที่กำหนด

### 2.2 ตารางและคอลัมน์ที่จัดเก็บรูปภาพ

| ประเภทรูปภาพ | ตารางใน PostgreSQL | คอลัมน์ที่จัดเก็บ | ชนิดข้อมูล (Data Type) |
|---|---|---|---|
| **รูปบันทึกงานช่างประจำวัน** (บังคับ 5 รูปขึ้นไป) | core_daily_work_logs | photos | JSONB (Array of Photo Objects / URLs) |
| **รูปภาพหน้างาน / ภาพงานติดตั้ง** | core_jobs | photos | JSONB (Array of Photo Objects) |
| **รูปตรวจรับรองคุณภาพ QC** (Online / On-site) | core_qc_bookings | photos | JSONB (Array of Photo Objects) |
| **รูปถ่ายการประเมินความพึงพอใจลูกค้า** (CSAT) | core_jobs | csat_photos | JSONB (Array of Photo Objects) |
| **รูปภาพแบบแปลนติดตั้ง** (Floor Plan Image) | core_jobs | ile_int_image | TEXT (Base64 Data URI) |
| **รูปถ่ายรายงานตรวจรับงาน Staging** | core_staging_reports | site_photos | JSONB (Array of Strings / URLs) |

### 2.3 จุดเด่นของการจัดเก็บบน Database
* ✅ **ข้อมูลคงอยู่ถาวร 100%**: ไม่สูญหายเมื่อคอนเทนเนอร์ Docker มีการ Build หรือ Restart ใหม่
* ✅ **สำรองข้อมูลง่าย (Unified Backup)**: สั่ง Dump ฐานข้อมูล PostgreSQL เพียงจุดเดียว จะได้ทั้งข้อมูลงานและรูปภาพประกอบครบถ้วนสมบูรณ์
* ✅ **แสดงผลรวดเร็ว**: รองรับการเปิดพรีวิวใน Lightbox Modal และ Gantt Chart ได้ทันที

---

## 👥 3. มาตรฐานความปลอดภัยและการจัดการผู้ใช้งาน (User Management & Security)

### 3.1 สิทธิ์และบทบาท (Role-Based Access Control)
* **ADMIN**: สิทธิ์สูงสุด ดูแลผู้ใช้งานทั้งหมด รีเซ็ตรหัสผ่าน ดู Audit Logs และตั้งค่าระบบ
* **AE (Account Executive)**: รับคำสั่งซื้อใหม่ (Step 1), บันทึกแบบแปลน (Step 2), นำเข้า BOQ และเตรียมแผนงาน (Step 3)
* **QC (Quality Control)**: นัดหมายและตรวจรับงานติดตั้ง (Step 5 / QC Inspection), ตรวจรูปถ่ายหน้างาน 5 รูป
* **CONTACT_CENTER**: ดำเนินการประเมินความพึงพอใจลูกค้า CSAT (Step 6), ปิดงานส่งมอบ และติดตามสัญญา MA

### 3.2 การรักษาความปลอดภัยและการ Logout (Strict Log-off)
* **First-line Gatekeeper**: ป้องกันผู้ใช้ที่ยังไม่ล็อกอินด้วย #login-overlay และ Route Navigation Guards
* **Strict Log-off Hard Reload**: เมื่อกดออกจากระบบ ระบบจะล้าง Token ในหน่วยความจำและ Storage ทั้งหมด พร้อมสั่ง **Hard Reload (window.location.replace('/'); window.location.reload();)** เพื่อคืนสู่หน้าล็อกอินโดยไม่มีตัวจับเวลาเบื้องหลังตกค้าง

---

## 🎨 4. มาตรฐานส่วนติดต่อผู้ใช้ (UI/UX Standards)

1. **Strict Light Theme Only**: ทุกหน้าจอแสดงผลใน **ธีมสว่าง 100%** ไม่มี Dark Mode เพื่อความคมชัดสูงสุดของแผนงาน Gantt และแบบแปลน
2. **Date Format Standard**: แสดงผลวันที่ในรูปแบบ **DD/MM/YYYY** (เช่น 16/09/2026) หรือ DD/MM/YYYY HH:mm เสมอ (ห้ามใช้ Native <input type="date"> ของเบราว์เซอร์)
3. **Time Format Standard**: ระบบเวลา **24 ชั่วโมง ( 0:00 - 23:59 น. หรือ HH:mm)** เท่านั้น (ห้ามมี AM/PM)
4. **Default List View**: ทุกหน้าจอเริ่มต้นแสดงผลเป็น **แบบตารางรายการ (List View) 100%** เสมอเพื่อความรวดเร็วในการสแกนข้อมูล
