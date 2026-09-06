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
| **AE** | ฝ่ายขาย (Account Executive) | รับคำสั่งซื้อใหม่ (INT Intake Step 1), บันทึกแบบแปลน (Step 2), ประมาณการราคา BOQ (Step 3) | ฟ้า/น้ำเงิน (`blue-500`) ไอคอน `ph-briefcase` |
| **QC** | ตรวจสอบคุณภาพ (Quality Control) | ตรวจรับงานหน้างาน (Step 6 / QC Inspection), ตรวจทานภาพถ่าย, อนุมัติ/ปฏิเสธงานพร้อมเหตุผล | เขียวมรกต (`emerald-500`) ไอคอน `ph-check-circle` |
| **CONTACT_CENTER** | บริการลูกค้า (Contact Center) | จัดการ Ticket ปัญหา (Step 4), ดูแลสัญญา MA หลังการขาย และแบบสำรวจ CSAT | เหลืองส้ม (`amber-500`) ไอคอน `ph-phone` |

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

## 🔄 2. ภาพรวมขอบเขต Flow งาน 5+2 ขั้นตอน (Pipeline Scope)

ระบบ PMT Flow ควบคุมกระบวนการตั้งแต่ต้นน้ำถึงปลายน้ำ:
1. **Step 1: บันทึกคิวงานรับคำสั่งซื้อ (Order Intake)** - รับงานจากภายนอก/INT หรือสร้าง Order ภายใน
2. **Step 2: บันทึก Design & แบบแปลนติดตั้ง (Blueprints & CAD)** - แนบแบบแปลน 2D/3D และแบบติดตั้ง
3. **Step 3: นำ BOQ เข้าระบบ & ประมาณการราคา (Bill of Quantities)** - บันทึกรายการวัสดุ-อุปกรณ์ ค่าแรง ค่าติดตั้ง
4. **Step 4: บันทึก Ticket & แนบใบเสร็จ (Tickets & Receipts)** - บันทึกเบิกจ่าย ใบเสร็จ และปัญหาหน้างาน
5. **Step 5: บันทึก BOQ เข้า Project & แผนงาน Gantt** - แปลงวัสดุและช่างเข้าสู่ Project Timeline
6. **QC Inspection (ตรวจคุณภาพ)** - ตรวจรับรองงานตามเกณฑ์มาตรฐานพร้อมรูปถ่าย
7. **CSAT & MA Contracts** - ประเมินความพึงพอใจลูกค้าและติดตามสัญญาบำรุงรักษาหลังการขาย

---

## 🛡️ 3. ข้อบังคับด้านความปลอดภัยและ Deployment
1. **API Authentication**: ทุก Endpoint ภายใต้ `/api/v1/users` ต้องผ่าน Middleware `requireAuth` และ `requireRole(ADMIN)`
2. **Production First**: โค้ดทั้งหมดต้องทดสอบและ Build (`npm run build`) พร้อมผลักดันขึ้น `git push origin main` เพื่อให้อัปเดตสู่ระบบจริงที่ `https://vibepmt.online` เสมอ
