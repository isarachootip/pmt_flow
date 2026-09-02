# SPMT — API Integration & Technical Specification
## ระบบรับข้อมูลสำรวจและติดตั้งหน้างาน (Site Visit / Survey Report Ingestion)
> **เอกสารสำหรับ:** ทีมพัฒนาระบบ INT (Inbound Caller) และทีมพัฒนาระบบ SPMT  
> **เวอร์ชัน:** 1.0.0 | **วันที่:** 2 กันยายน 2569 | **สถานะ:** พร้อมใช้งาน (Production Ready)  
> **Production Base URL:** `https://vibepmt.online/api/v1`  
> **Swagger UI:** [https://vibepmt.online/docs](https://vibepmt.online/docs)

---

## 1. บทนำและวัตถุประสงค์ (Overview & Objectives)

เอกสารฉบับนี้จัดทำขึ้นเพื่อกำหนดมาตรฐานการเชื่อมต่อข้อมูล (API Interface Specification) ระหว่าง **ระบบ INT** (External System) กับ **ระบบ SPMT** (Store Project Management Tool) สำหรับส่งผลการเข้าสำรวจพื้นที่และประเมินหน้างาน (Site Visit Report) 

ระบบ SPMT ได้จัดเตรียม **Staging Landing Zone** สำหรับรับข้อมูลแบบ Fast-Ack เพื่อให้ระบบฝั่ง INT ได้รับ Response รวดเร็ว (< 200ms) และไม่สูญหาย ก่อนจะทำการ Validate และกระจายข้อมูลเข้าสู่ Core Database ต่อไป

---

## 2. แผนผังการทำงาน (Architecture & Ingestion Flow)

```
[ระบบ INT (Caller)] 
       │ 
       ▼ (1) POST /api/v1/jobs/survey-report + Headers: X-API-Key, X-Idempotency-Key
[SPMT API Gateway / Ingest Service]
       │
       ▼ (2) บันทึก Raw Payload ทั้งก้อนลง Staging Table
[(Staging Table) t_staging_survey_report] ◄── Status: PENDING
       │
       ├──► (3) ตอบกลับ INT ทันที: HTTP 201 Created (ภายใน < 150ms)
       │
       ▼ (4) Background Validation & Transformation Engine
┌─────────────────────────────────────────────────────────────┐
│ Validation Rules:                                           │
│ 1. รูปถ่ายหน้างานครบ >= 5 รูป หรือไม่?                      │
│ 2. ข้อมูลลูกค้าและพิกัดถูกต้องหรือไม่?                     │
│ 3. Check-in / Check-out Timestamps ครบหรือไม่?             │
└─────────────────────────────────────────────────────────────┘
       │
       ├── ผ่าน ──► Insert เข้า Core PMT Tables (Status -> CONVERTED)
       │             - m_customer
       │             - t_job (สถานะ: SURVEYED)
       │             - t_job_service
       │             - t_visit_checkin
       │             - t_site_photo
       │
       └── ไม่ผ่าน ─► Update Staging (Status -> VALIDATION_FAILED)
```

---

## 3. รายละเอียด API Specification

### 3.1 Endpoint Details
- **Method:** `POST`
- **URL Path:** `/api/v1/jobs/survey-report`
- **Full URL:** `https://vibepmt.online/api/v1/jobs/survey-report`
- **Content-Type:** `application/json`

### 3.2 Request Headers

| Header Name | Type | Required | Description / Example |
| :--- | :---: | :---: | :--- |
| `Authorization` | string | **Yes** | `Bearer <API_KEY>` (ใช้ค่ายืนยันสิทธิ์) |
| `X-Idempotency-Key` | string | **Yes** | Unique Transaction ID ป้องกันการส่งซ้ำ เช่น `INT-REQ-20260902-001` |
| `Content-Type` | string | **Yes** | `application/json` |

---

### 3.3 Request Body Schema & Example

```json
{
  "system": {
    "job_id": "031b0e16a-9a98-43bf-ae3e-b14e76b577f8",
    "created_at": "2026-09-02T09:00:00Z",
    "created_by": "system",
    "updated_at": "2026-09-02T09:00:00Z"
  },
  "job_info": {
    "job_number": "JOB202609001",
    "booking_no": "VFIX-260901-001",
    "ticket_no": "209051119",
    "source_reference": "REQ-PT2-2608220003",
    "status": "Approved",
    "stage": "Completed",
    "property_type": "บ้านเดี่ยว",
    "project_type": "Renovate",
    "project_sub_type": "งานกระเบื้องพื้น",
    "file_int_image": "renovate/int/eee85115-24c5-4216-9744-60b86a8fbe23.jpg"
  },
  "job_details": [
    {
      "job_type": "ติดตั้งแอร์ (ส่งพร้อมติดตั้ง)",
      "installation_detail": "R-ติดตั้ง แอร์ติดผนัง ขนาด 9000-17000 บีทียู ติดตั้งพร้อมรื้อถอน",
      "product_quantity": 2,
      "remark": "remark xxxx 500 char"
    },
    {
      "job_type": "ติดตั้งแอร์ (ส่งพร้อมติดตั้ง)",
      "installation_detail": "R-ติดตั้ง แอร์ติดผนัง ขนาด 18000-24000 บีทียู ติดตั้งพร้อมรื้อถอน",
      "product_quantity": 1,
      "remark": "remark xxxx 500 char"
    }
  ],
  "customer": {
    "code": "18a9359a-4363-4dda-8fdb-5f541d8a4b64",
    "name": "นภัสวรรณ มีศิริ",
    "mobile_no": "0812345678",
    "location": {
      "latitude": 13.7563,
      "longitude": 100.5018,
      "address": "มาบยายเลีย 41 เมืองพัทยา อำเภอบางละมุง ชลบุรี 20150",
      "google_map_url": "https://www.google.com/maps/search/?api=1&query=12.9326734,100.9239925"
    }
  },
  "agent": {
    "code": "87524b4a-8511-4a93-88fa-850c8d043868",
    "name": "Agent Name",
    "team": "QC RENOVATE & MENTAINANCE"
  },
  "store": {
    "code": "60964",
    "code3": "RA2",
    "name": "RAMA2",
    "location": {
      "latitude": 13.652,
      "longitude": 100.421,
      "google_map_url": "https://www.google.com/maps/search/?api=1&query=13.652,100.421"
    }
  },
  "schedule_plan": {
    "visit_date": "2026-09-05",
    "start_time": "09:00:00",
    "end_time": "12:00:00",
    "time_slot": "เช้า (09:00-12:00)",
    "distance": 15.5
  },
  "check_in": {
    "date": "2026-09-05T09:05:00Z",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "image": "renovate/check_in/9cf4f37a-045a-4bfb-91ec-611370e2b5a2.jpg"
  },
  "check_out": {
    "date": "2026-09-05T11:45:00Z",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "image": "renovate/check_out/9b5bb34f-51cc-4e38-b6f3-846666a89166.jpg"
  },
  "site_photos": [
    "renovate/site/2a206a2e-6615-4b68-826e-520c170c15c0.jpg",
    "renovate/site/6bf8a1b2-d1e2-49f1-a9b3-ffa6ea6e7005.jpg",
    "renovate/site/900726c6-2c57-4e5e-9681-ec1e45700415.jpg",
    "renovate/site/272395e6-763c-4a15-9fe4-aa7d94fb749e.jpg",
    "renovate/site/a958108b-9bbf-4285-ab98-fd3bb220f923.jpg"
  ],
  "approval": {
    "approve_by": "Phinyo Phoaon",
    "approve_date": "2026-09-05T12:00:00Z",
    "distance": 15.5
  },
  "visit_results": [
    "พื้นที่ยังไม่พร้อมสำหรับการสำรวจ",
    "ข้อมูลและขอบเขตงานไม่ครบถ้วน"
  ],
  "remarks": {
    "comment": "Work completed successfully",
    "note": "Customer requested callback before arrival"
  }
}
```

---

## 4. มาตรฐาน Response Codes & ผลลัพธ์ที่ตอบกลับ

### 4.1 กรณีสำเร็จ (HTTP 201 Created)
```json
{
  "success": true,
  "message": "Job survey report ingested to Staging and converted to Core PMT successfully",
  "data": {
    "staging_id": 1725301234567,
    "process_status": "CONVERTED",
    "converted_job_id": 1725301239999,
    "summary": {
      "job_number": "JOB202609001",
      "customer_name": "นภัสวรรณ มีศิริ",
      "photo_count": 5,
      "service_count": 2
    }
  }
}
```

### 4.2 กรณีส่งซ้ำเดิม (HTTP 200 OK — Idempotency Hit)
```json
{
  "success": true,
  "message": "Payload already ingested in staging",
  "staging_id": 1725301234567,
  "process_status": "CONVERTED",
  "converted_job_id": 1725301239999
}
```

### 4.3 กรณีข้อมูลไม่ครบถ้วน (HTTP 400 Bad Request)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "Field 'system.job_id' is required"
  }
}
```

---

## 5. กฎเกณฑ์ทางธุรกิจที่ต้องตรวจสอบ (Business Validation Rules)

1. **Idempotency Check:** ระบบจะใช้ `system.job_id` ในการเช็ก หากส่งซ้ำจะไม่บันทึกซ้ำซ้อน
2. **จำนวนรูปถ่ายหน้างาน (Site Photos):** ใน `site_photos` ต้องมีรูปถ่าย **อย่างน้อย 5 รูป**
3. **Check-in / Check-out Timestamps:** ต้องมีค่า `check_in.date` และ `check_out.date` เป็น ISO-8601 เสมอ
4. **ข้อมูลลูกค้า:** ต้องมี `customer.name` และ `customer.mobile_no` ที่ถูกต้อง

---

## 6. ช่องทางการทดสอบและติดต่อ (Testing Tools & Contacts)

- **Swagger UI (ทดสอบออนไลน์):** [https://vibepmt.online/docs](https://vibepmt.online/docs)
- **Postman Collection:** สามารถ Import ไฟล์ `PMT_INT_Integration_Postman_Collection.json`
- **ทีมผู้ประสานงาน SPMT:** ทีมพัฒนาระบบ SPMT / System Architect
