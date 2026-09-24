# PMT Flow v2 — Backend API Mapping Reference (`API_MAP.md`)

> แผนผัง API ทั้งหมดที่ถูกประกาศใช้งานใน `server.ts` ของระบบ PMT Flow (Production REST API)  
> อ้างอิงตาม: `server.ts`, `openapi.yaml`, `database.ts`, และ `schema.sql`  
> วันที่ Audit: 24 กันยายน 2569 | จำนวน Route Handlers ทั้งหมด: 83 รายการ

---

## 1. หมวดความปลอดภัยและการยืนยันตัวตน (Authentication & User Profile)

### 1.1 `POST /api/v1/auth/login`
- **คำอธิบาย**: ตรวจสอบข้อมูลเข้าสู่ระบบของผู้ใช้งานและออก Bearer Session Token (อายุ 8 ชั่วโมง)
- **หน้าที่ใช้**: `#login-overlay`, `/v2/login`
- **Request Headers**: `Content-Type: application/json`
- **Request Body ตัวอย่าง**:
```json
{
  "username": "admin",
  "password": "Admin@1234"
}
```
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "data": {
    "token": "tok_1788397200000_abc123xyz",
    "user": {
      "id": 1,
      "user_code": "USR-001",
      "username": "admin",
      "email": "admin@pmt.com",
      "full_name": "ผู้ดูแลระบบ",
      "role": "ADMIN",
      "is_active": true
    }
  }
}
```
- **Error Response (401 / 400)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
  }
}
```

---

### 1.2 `POST /api/v1/auth/logout`
- **คำอธิบาย**: เพิกถอน Token และบันทึกประวัติออกจากระบบ
- **หน้าที่ใช้**: Topbar, Sidebar, `modal-my-profile`, `window.handleLogout`
- **Request Headers**: `Authorization: Bearer <token>`
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "message": "ออกจากระบบเรียบร้อยแล้ว"
}
```

---

### 1.3 `GET /api/v1/auth/me`
- **คำอธิบาย**: ตรวจสอบสถานะ Token และดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน
- **หน้าที่ใช้**: App bootup, Topbar profile info, Route Guard
- **Request Headers**: `Authorization: Bearer <token>`
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_code": "USR-001",
    "username": "admin",
    "email": "admin@pmt.com",
    "full_name": "ผู้ดูแลระบบ",
    "role": "ADMIN",
    "is_active": true
  }
}
```

---

### 1.4 `PATCH /api/v1/auth/profile`
- **คำอธิบาย**: ปรับปรุงชื่อ-นามสกุล และอีเมลของตนเอง
- **หน้าที่ใช้**: `modal-my-profile`
- **Request Body ตัวอย่าง**:
```json
{
  "full_name": "ผู้ดูแลระบบ งานปฏิบัติการ",
  "email": "admin.ops@pmt.com"
}
```
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "full_name": "ผู้ดูแลระบบ งานปฏิบัติการ",
    "email": "admin.ops@pmt.com"
  }
}
```

---

### 1.5 `POST /api/v1/auth/change-password`
- **คำอธิบาย**: เปลี่ยนรหัสผ่านของตนเอง (ต้องระบุรหัสผ่านเดิม)
- **หน้าที่ใช้**: `modal-my-profile`
- **Request Body ตัวอย่าง**:
```json
{
  "current_password": "Admin@1234",
  "new_password": "NewSecret@2026"
}
```
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "message": "เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย"
}
```

---

## 2. หมวดจัดการผู้ใช้งาน (User Management — Role ADMIN Only)

### 2.1 `GET /api/v1/users`
- **คำอธิบาย**: ดึงรายชื่อผู้ใช้งานทั้งหมดในระบบ
- **หน้าที่ใช้**: `page-users`, `modal-user-form`
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_code": "USR-001",
      "username": "admin",
      "email": "admin@pmt.com",
      "full_name": "ผู้ดูแลระบบ",
      "role": "ADMIN",
      "is_active": true,
      "last_login_at": "2026-09-24T08:00:00.000Z"
    },
    {
      "id": 4,
      "user_code": "USR-003",
      "username": "ae.somchai",
      "email": "somchai@pmt.local",
      "full_name": "สมชาย ขยันทำ",
      "role": "AE",
      "is_active": true,
      "last_login_at": "2026-09-24T07:30:00.000Z"
    }
  ]
}
```

---

### 2.2 `GET /api/v1/users/:id`
- **คำอธิบาย**: ดึงข้อมูลผู้ใช้งานรายบุคคล
- **หน้าที่ใช้**: `modal-user-form`

---

### 2.3 `POST /api/v1/users`
- **คำอธิบาย**: สร้างผู้ใช้งานใหม่
- **หน้าที่ใช้**: `modal-user-form`
- **Request Body ตัวอย่าง**:
```json
{
  "username": "qc.prasit",
  "full_name": "ประสิทธิ์ ตรวจเป๊ะ",
  "email": "prasit@pmt.local",
  "role": "QC",
  "password": "Password@1234"
}
```
- **Response ตัวอย่าง (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": 9,
    "user_code": "USR-009",
    "username": "qc.prasit",
    "full_name": "ประสิทธิ์ ตรวจเป๊ะ",
    "email": "prasit@pmt.local",
    "role": "QC",
    "is_active": true
  }
}
```

---

### 2.4 `PATCH /api/v1/users/:id`
- **คำอธิบาย**: แก้ไขข้อมูลผู้ใช้, เปลี่ยน Role, หรือเปิด/ปิดใช้งาน (Soft Delete)
- **หน้าที่ใช้**: `modal-user-form`, `modal-user-toggle-status`
- **Request Body ตัวอย่าง**:
```json
{
  "full_name": "ประสิทธิ์ ตรวจเป๊ะ (QC Lead)",
  "role": "QC",
  "is_active": true
}
```

---

### 2.5 `POST /api/v1/users/:id/reset-password`
- **คำอธิบาย**: แอดมินตั้งรหัสผ่านใหม่ให้ผู้ใช้
- **หน้าที่ใช้**: `modal-user-reset-pwd`
- **Request Body ตัวอย่าง**:
```json
{
  "new_password": "NewUser@1234"
}
```

---

### 2.6 `DELETE /api/v1/users/:id`
- **คำอธิบาย**: ระงับการใช้งานผู้ใช้ (`is_active = false`) — Soft Delete
- **หน้าที่ใช้**: `modal-user-toggle-status`

---

### 2.7 `GET /api/v1/auth/login-logs`
- **คำอธิบาย**: ตรวจสอบประวัติ Login Audit Trail 100 รายการล่าสุด
- **หน้าที่ใช้**: `modal-user-login-logs`
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 105,
      "username": "admin",
      "full_name": "ผู้ดูแลระบบ",
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 ... Chrome/128.0",
      "success": true,
      "fail_reason": null,
      "created_at": "2026-09-24T08:00:00.000Z"
    }
  ]
}
```

---

## 3. หมวดเชื่อมโยงระบบภายนอก (INT & Staging Inbound)

### 3.1 `POST /api/v1/integration/orders`
- **คำอธิบาย**: Server-to-Server Push API รับคำสั่งซื้อใหม่และงานสำรวจจากระบบ INT (Inbound API #1)
- **หน้าที่ใช้**: ระบบภายนอก INT, Postman, `page-dashboard` (Simulate)
- **Request Headers**: `X-Idempotency-Key: INT-REQ-987654321`
- **Request Body ตัวอย่าง**:
```json
{
  "job_info": {
    "job_number": "JOB26090900001",
    "booking_no": "VFIX-260901-001",
    "ticket_no": "209051119",
    "project_type": "Renovate",
    "project_sub_type": "งานกระเบื้องพื้น"
  },
  "customer": {
    "name": "นภัสวรรณ มีศิริ",
    "mobile_no": "0812345678",
    "location": {
      "latitude": 13.7563,
      "longitude": 100.5018,
      "address": "มาบยายเลีย 41 เมืองพัทยา อำเภอบางละมุง ชลบุรี 20150"
    }
  },
  "job_details": [
    {
      "job_type": "ติดตั้งแอร์ (ส่งพร้อมติดตั้ง)",
      "installation_detail": "R-ติดตั้ง แอร์ติดผนัง ขนาด 9000-17000 บีทียู",
      "product_quantity": 2
    }
  ],
  "site_photos": [
    "renovate/site/photo1.jpg",
    "renovate/site/photo2.jpg",
    "renovate/site/photo3.jpg",
    "renovate/site/photo4.jpg",
    "renovate/site/photo5.jpg"
  ]
}
```
- **Response ตัวอย่าง (201 Created)**:
```json
{
  "success": true,
  "data": {
    "job_id": 101,
    "job_no": "JOB26090900001",
    "status": "SURVEYED"
  }
}
```

---

### 3.2 `POST /api/v1/jobs/survey-report` (Alias: `/api/v1/integration/survey-reports`)
- **คำอธิบาย**: รับ Webhook บันทึกผลการสำรวจหน้างาน (Visit Plan) เข้าสู่ Staging
- **หน้าที่ใช้**: ระบบ Visit Plan / Staging

---

### 3.3 `GET /api/v1/staging/survey-reports` & `GET /api/v1/staging/survey-reports/:id`
- **คำอธิบาย**: ดูรายการรายงานสำรวจที่อยู่ในคิว Staging
- **หน้าที่ใช้**: `page-jobs`

---

### 3.4 `POST /api/v1/staging/survey-reports/:id/convert`
- **คำอธิบาย**: แปลงรายงาน Staging เข้าเป็น Job จริงใน PMT Flow
- **หน้าที่ใช้**: `page-jobs`

---

### 3.5 `GET /api/v1/staging/config` & `POST /api/v1/staging/config/auto-convert`
- **คำอธิบาย**: ตรวจสอบและตั้งค่าเปิด/ปิดระบบแปลง Staging อัตโนมัติ
- **หน้าที่ใช้**: `page-settings`

---

## 4. หมวดโครงการและคำสั่งซื้อหลัก (Core Jobs Pipeline)

### 4.1 `GET /api/v1/jobs`
- **คำอธิบาย**: ค้นหาและดึงรายการคำสั่งซื้อ รองรับการกรอง, จัดหน้า (Pagination), และเรียงลำดับ
- **หน้าที่ใช้**: `page-master-orders`, `page-jobs`, `page-boq`, `page-project-pricing`, `page-report`, `page-csat`
- **Query Parameters**:
  - `page`: หมายเลขหน้า (ค่าเริ่มต้น 1)
  - `limit`: จำนวนต่อหน้า (ค่าเริ่มต้น 50)
  - `search`: ค้นหาข้อความ
  - `status`: กรองสถานะ เช่น `DRAFT`, `IN_PROGRESS`, `QC_PENDING`
  - `service`: กรองประเภทบริการ
  - `sort`: คอลัมน์ที่ต้องการเรียง เช่น `created_at`
  - `order`: `asc` หรือ `desc`
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "job_no": "JOB26090900001",
      "external_ref_id": "REF-2026-001",
      "customer_name": "นภัสวรรณ มีศิริ",
      "customer_phone": "0812345678",
      "job_type": "renovate",
      "status": "IN_PROGRESS",
      "overall_progress": 60,
      "plan_date": "2026-09-25",
      "boq_grand_total": 45000.00,
      "created_at": "2026-09-24T06:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 128,
    "page": 1,
    "limit": 50,
    "total_pages": 3
  }
}
```

---

### 4.2 `GET /api/v1/jobs/summary`
- **คำอธิบาย**: ดึงสถิติตัวเลขภาพรวมงานทุกสถานะและ KPI
- **หน้าที่ใช้**: `page-dashboard`, Sidebar counters, `page-report`
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "data": {
    "total_jobs": 128,
    "step1": 14,
    "in_progress": 28,
    "qc_pending": 7,
    "qc_passed": 64,
    "after_sale": 15,
    "completed": 64,
    "cancelled": 3
  }
}
```

---

### 4.3 `GET /api/v1/jobs/:id`
- **คำอธิบาย**: ดึงข้อมูลคำสั่งซื้อแบบ Job 360 ฉบับสมบูรณ์ (รวม BOQ, Tasks, Daily Logs, QC History, Photos)
- **หน้าที่ใช้**: `page-job-detail`, `modal-job-preview-detail`, `modal-qc-job-detail`

---

### 4.4 `POST /api/v1/jobs`
- **คำอธิบาย**: สร้างคำสั่งซื้อใหม่แบบ Manual ในระบบ PMT Flow
- **หน้าที่ใช้**: `modal-create-job`
- **Request Body ตัวอย่าง**:
```json
{
  "firstName": "สมชาย",
  "lastName": "ขยันยิ่ง",
  "phone": "0891234567",
  "address": "456 ถนนสุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กทม.",
  "lat": 13.6932,
  "lng": 100.6124,
  "service": "ติดตั้งเครื่องทำน้ำอุ่น",
  "jobType": "quick",
  "planDate": "2026-09-26",
  "specialInstructions": "เข้าเช้า 09:00 น."
}
```

---

### 4.5 `PATCH /api/v1/jobs/:id`
- **คำอธิบาย**: ปรับปรุงข้อมูลคำสั่งซื้อ (สถานะ, คำสั่งพิเศษ, หมายเหตุ, ความคืบหน้า, Timestamps)
- **หน้าที่ใช้**: ทุกขั้นตอนที่มีการบันทึกหรือเปลี่ยนสถานะ

---

### 4.6 `POST /api/v1/jobs/:id/checkin`
- **คำอธิบาย**: บันทึกการ Check-in หน้างานของช่าง พร้อมตรวจสอบ Geofence รัศมี 400 ม. และรูปถ่าย 5 รูป
- **หน้าที่ใช้**: `page-jobs`, `page-job-detail`
- **Request Body ตัวอย่าง**:
```json
{
  "lat": 13.7563,
  "lng": 100.5018,
  "summary": "เข้าสำรวจหน้างานห้องครัว พร้อมบันทึกภาพถ่าย 5 จุด",
  "photos": [
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,..."
  ]
}
```
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "data": {
    "checkin": {
      "checkin_at": "2026-09-24T09:05:00.000Z",
      "distance_meters": 180,
      "is_in_radius": true,
      "photo_count": 5
    },
    "updated_job_status": "SURVEYED"
  }
}
```

---

### 4.7 `POST /api/v1/jobs/:id/photos` & `DELETE /api/v1/jobs/:id/photos/:photoId`
- **คำอธิบาย**: แนบภาพถ่ายหน้างานเพิ่มเติม และลบรูปภาพ
- **หน้าที่ใช้**: `modal-upload-photo`, `page-job-detail`

---

### 4.8 Endpoints ควบคุมสำหรับทดสอบและ Dev (Strict Dev Only)
- `POST /api/v1/jobs/reset-status` — ถอยสถานะงานทั้งหมดกลับเป็น `SURVEYED`/`DRAFT`
- `POST /api/v1/jobs/reset` (Alias: `/api/v1/jobs/simulate-int`) — สร้างข้อมูลตัวอย่าง 10 งาน
- `DELETE /api/v1/jobs` (Alias: `POST /api/v1/system/wipe-transactions`) — ล้างข้อมูล Transaction ทั้งหมด

---

## 5. หมวดแบบแปลนและไฟล์ออกแบบ (Blueprints & CAD — Step 2)

### 5.1 `GET /api/v1/blueprints`
- **คำอธิบาย**: ดึงรายการแบบแปลนทั้งหมด
- **หน้าที่ใช้**: `page-blueprints`

### 5.2 `POST /api/v1/blueprints`
- **คำอธิบาย**: บันทึก/อัปโหลดไฟล์แบบแปลนใหม่ พร้อมระบุเวอร์ชัน
- **หน้าที่ใช้**: `modal-upload-blueprint`
- **Request Body ตัวอย่าง**:
```json
{
  "jobId": "JOB26090900001",
  "name": "แบบแปลนติดตั้งระบบไฟฟ้าและแอร์ v2.0 Approved",
  "fileType": "pdf",
  "filePath": "/uploads/blueprints/bp_001.pdf",
  "version": "v2.0 Approved",
  "zone": "ห้องนอนใหญ่และห้องโถง",
  "uploadedBy": "คุณธนกฤต (Designer)"
}
```

### 5.3 `PATCH /api/v1/blueprints/:id` & `DELETE /api/v1/blueprints/:id`
- **คำอธิบาย**: ปรับปรุงข้อมูล/อนุมัติแบบแปลน และลบแบบแปลน

---

## 6. หมวด Ticket & สลิปชำระเงิน (Tickets & Receipts — Step 2)

### 6.1 `GET /api/v1/tickets`
- **คำอธิบาย**: ดึงรายการ Ticket ทั้งหมด

### 6.2 `POST /api/v1/tickets`
- **คำอธิบาย**: สร้าง Ticket ใหม่พร้อมแนบสลิปชำระเงิน
- **หน้าที่ใช้**: `modal-create-ticket`
- **Request Body ตัวอย่าง**:
```json
{
  "ticket_no": "TKT-2609-0012",
  "job_id": "JOB26090900001",
  "paid_amount": 45000.00,
  "payment_method": "โอนเงินผ่านธนาคาร",
  "bank_name": "KBANK",
  "paid_at": "2026-09-24T14:30:00.000Z",
  "slip_url": "data:image/jpeg;base64,..."
}
```

### 6.3 `PATCH /api/v1/tickets/:id` & `DELETE /api/v1/tickets/:id`
- **คำอธิบาย**: แก้ไขข้อมูลและยกเลิก Ticket

---

## 7. หมวด BOQ & ไฟล์เอกสาร (BOQ & Storage — Step 2 & 3)

### 7.1 `POST /api/v1/jobs/:id/boq`
- **คำอธิบาย**: บันทึกรายการวัสดุ/ค่าแรง พร้อมคำนวณราคาสุทธิ
- **หน้าที่ใช้**: `modal-manage-boq`, `page-boq`
- **Request Body ตัวอย่าง**:
```json
{
  "boq_items": [
    {
      "id": "item-1",
      "category": "ค่าแรง/บริการ",
      "name": "ค่าแรงติดตั้งแอร์ติดผนัง",
      "qty": 2,
      "unit": "เครื่อง",
      "unit_price": 2500,
      "cost_price": 1800
    },
    {
      "id": "item-2",
      "category": "วัสดุ/อุปกรณ์",
      "name": "ท่อน้ำยาแอร์ทองแดงสำเร็จรูป",
      "qty": 8,
      "unit": "เมตร",
      "unit_price": 450,
      "cost_price": 320
    }
  ],
  "boq_discount": 500.00
}
```

### 7.2 `POST /api/v1/jobs/:id/boq/upload-file`
- **คำอธิบาย**: อัปโหลดไฟล์ Excel/CSV เข้าสู่ `data/boq_files/<jobId>/` (ผ่าน Multer)
- **หน้าที่ใช้**: `modal-import-boq`

### 7.3 `GET /api/v1/boq-files/:jobId/:filename` & `DELETE /api/v1/jobs/:id/boq/file`
- **คำอธิบาย**: ดาวน์โหลดและลบไฟล์ BOQ

---

## 8. หมวด Tasks, Conversion & แผนงาน Gantt (Step 3 & 4)

### 8.1 `GET /api/v1/jobs/:id/tasks`
- **คำอธิบาย**: ดึงรายการ Tasks ทั้งหมดของงานที่เลือก
- **หน้าที่ใช้**: `page-project-conversion`, `page-gantt`, `page-job-detail`

### 8.2 `POST /api/v1/jobs/:id/tasks/import-boq`
- **คำอธิบาย**: แปลงรายการค่าแรงจาก BOQ เป็น Task อัตโนมัติ
- **หน้าที่ใช้**: `modal-convert-boq-tasks`

### 8.3 `POST /api/v1/jobs/:id/tasks` & `PUT /api/v1/jobs/:id/tasks/:taskId` & `DELETE /api/v1/jobs/:id/tasks/:taskId`
- **คำอธิบาย**: เพิ่ม, แก้ไข (กำหนดช่าง, ปรับวันเริ่ม-เสร็จ, อัปเดต % ความคืบหน้า), และลบ Task

### 8.4 `POST /api/v1/jobs/:id/tasks/reorder`
- **คำอธิบาย**: ปรับลำดับการทำงานของ Tasks

### 8.5 `GET /api/v1/tasks/gantt`
- **คำอธิบาย**: ดึงข้อมูล Tasks ทั้งหมดในรูปแบบ Timeline Dataset สำหรับวาด Gantt Chart
- **หน้าที่ใช้**: `page-gantt`

---

## 9. หมวดบันทึกงานช่างประจำวัน (Daily Technician Work Logs — Step 4)

### 9.1 `GET /api/v1/daily-logs` & `GET /api/v1/jobs/:id/daily-logs`
- **คำอธิบาย**: ดึงประวัติการเข้างานประจำวันของช่าง
- **หน้าที่ใช้**: `page-gantt`, `modal-daily-work-log`, `page-job-detail`

### 9.2 `POST /api/v1/jobs/:id/daily-logs` (Alias: `POST /api/v1/daily-logs`)
- **คำอธิบาย**: บันทึกความคืบหน้ารายวันของช่าง (เวลา 24 ชม., เนื้องาน, รูป 5 ช่อง)
- **หน้าที่ใช้**: `modal-daily-work-log`
- **Request Body ตัวอย่าง**:
```json
{
  "taskId": "T_JOB26090900001_1",
  "taskName": "ติดตั้งระบบไฟฟ้าและเดินท่อแอร์",
  "logDate": "24/09/2026",
  "startTime": "08:30",
  "endTime": "17:00",
  "workHours": "8.5 ชม.",
  "dayNumber": 1,
  "totalDays": 3,
  "technician": "สมศักดิ์ ช่างแอร์ (ทีม A)",
  "reporterRole": "TECH",
  "workDescription": "เจาะผนังร้อยท่อทองแดง และติดตั้งชุดเบรกเกอร์ตัดไฟ",
  "materialsUsed": "ท่อ PVC ขาว 2 เส้น, เบรกเกอร์ 20A 1 ตัว",
  "photos": [
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,..."
  ]
}
```

### 9.3 `DELETE /api/v1/daily-logs/:logId`
- **คำอธิบาย**: ลบบันทึกงานช่าง

---

## 10. หมวดตรวจคุณภาพและปิดงานส่ง STK (QC & Closeout — Step 5 & 6)

### 10.1 `GET /api/v1/qc/bookings`
- **คำอธิบาย**: ดึงรายการคิวนัดตรวจ QC ทั้งหมด
- **หน้าที่ใช้**: `page-qc`

### 10.2 `POST /api/v1/qc/bookings/sync-all`
- **คำอธิบาย**: ระบบตรวจสอบและสร้างนัดหมาย QC ล่วงหน้า 5 วันก่อน Task จบ
- **หน้าที่ใช้**: `page-qc` (ปุ่มซิงก์แจ้งเตือน)

### 10.3 `PUT /api/v1/qc/bookings/:id/confirm` & `PUT /api/v1/qc/bookings/:id`
- **คำอธิบาย**: ยืนยันการตรวจและปรับปรุงเช็คลิสต์ QC

### 10.4 `POST /api/v1/jobs/:id/qc-inspection`
- **คำอธิบาย**: บันทึกผลการตรวจรับรองคุณภาพ QC (Pass / Rework)
- **หน้าที่ใช้**: `modal-qc-job-detail`
- **Request Body ตัวอย่าง**:
```json
{
  "items": [
    { "item_id": "Q1", "result": "PASS", "is_mandatory": true },
    { "item_id": "Q2", "result": "PASS", "is_mandatory": true },
    { "item_id": "Q3", "result": "PASS", "is_mandatory": true },
    { "item_id": "Q4", "result": "PASS", "is_mandatory": true },
    { "item_id": "Q5", "result": "PASS", "is_mandatory": true }
  ],
  "remarks": "ติดตั้งเรียบร้อยตามมาตรฐาน เก็บขยะคืนพื้นที่เรียบร้อย"
}
```

### 10.5 `POST /api/v1/jobs/:id/export-stk` (Alias: `/api/v1/integrations/stk/qc-results`)
- **คำอธิบาย**: Outbound Push API ส่งข้อมูลปิดงานและผลตรวจ QC เข้าระบบ STK
- **หน้าที่ใช้**: `modal-qc-job-detail`, `page-csat`
- **Response ตัวอย่าง (200 OK)**:
```json
{
  "success": true,
  "data": {
    "stk_ref": "STK-QC-2026-894125",
    "job_no": "JOB26090900001",
    "status": "DELIVERED",
    "exported_at": "2026-09-24T16:00:00.000Z"
  }
}
```

### 10.6 `GET /api/v1/jobs/:id/stk-payload` (Alias: `/api/v1/integrations/stk/qc-results/:id`)
- **คำอธิบาย**: พรีวิวข้อมูล Payload STK ก่อนส่งออกจริง
- **หน้าที่ใช้**: `modal-stk-payload-view`

### 10.7 `POST /api/v1/jobs/:id/after-sale/csat`
- **คำอธิบาย**: บันทึกคะแนน CSAT (1-5 ดาว) และความคิดเห็นของลูกค้า
- **หน้าที่ใช้**: `modal-csat-eval`

---

## 11. หมวดสัญญา MA บริการหลังการขาย (MA Recurring Maintenance)

### 11.1 `GET /api/v1/ma-checklist-templates`
- **คำอธิบาย**: ดึงเทมเพลตเช็คลิสต์ตรวจบำรุงรักษา (ล้างแอร์, โซลาร์เซลล์, ประปา, CCTV)
- **หน้าที่ใช้**: `modal-ma-checklist`, `page-ma-contracts`

### 11.2 `GET /api/v1/ma-contracts` & `GET /api/v1/ma-contracts/:id`
- **คำอธิบาย**: ดึงรายการสัญญาทั้งหมด และดึงรายละเอียดสัญญาพร้อมรอบตรวจย่อย

### 11.3 `POST /api/v1/ma-contracts`
- **คำอธิบาย**: สร้างสัญญา MA ใหม่ และคำนวณวันนัดของรอบตรวจย่อยล่วงหน้าอัตโนมัติ
- **หน้าที่ใช้**: `modal-create-ma`
- **Request Body ตัวอย่าง**:
```json
{
  "contract_no": "MAC-2026-0042",
  "customer_name": "บริษัท สยามพาณิชย์ จำกัด",
  "customer_phone": "02-123-4567",
  "site_name": "สำนักงานใหญ่ อาคาร A",
  "site_address": "88/1 ถนนรัชดาภิเษก แขวงจตุจักร กทม.",
  "service_type": "ล้างแอร์",
  "frequency_months": 3,
  "total_rounds": 4,
  "contract_start_date": "2026-10-01",
  "contract_value": 18000.00
}
```

### 11.4 `POST /api/v1/ma-rounds` & `PATCH /api/v1/ma-rounds/:id`
- **คำอธิบาย**: เพิ่มรอบตรวจ หรือบันทึกผลการตรวจรอบ MA (`status = 'Completed'`)

---

## 12. หมวดมอนิเตอร์และระบบจัดการ (System Monitor & Meta)

### 12.1 `GET /api/v1/system/api-logs` & `DELETE /api/v1/system/api-logs`
- **คำอธิบาย**: ดึงประวัติ Inbound Request Logs เชิงลึก และล้างประวัติ
- **หน้าที่ใช้**: `page-api-logs`, `/apimonitor`

### 12.2 `GET /doc/:filename(*)`
- **คำอธิบาย**: เสิร์ฟไฟล์คู่มือ Markdown จากโฟลเดอร์ `doc/`
- **หน้าที่ใช้**: `page-faq`, `modal-training-viewer`

### 12.3 Documentation Endpoints
- `GET /openapi.yaml` & `GET /openapi-dynamic.yaml`
- `GET /docs` & `GET /api-docs` (Swagger UI)
- `GET /SPMT_API_Specification_GoogleSheets.xlsx`
- `GET /api_spec.csv`
