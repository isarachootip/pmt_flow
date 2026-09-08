# 📘 คู่มือการใช้งานระบบ PMT Flow (Enterprise Operations Manual)
### เอกสารประกอบการฝึกอบรมผู้ใช้งาน (User & Trainer Training Manual)

---

## 📑 สารบัญ (Table of Contents)
1. [ภาพรวมระบบและสถาปัตยกรรมกระบวนการ (System Overview)](#1-ภาพรวมระบบและสถาปัตยกรรมกระบวนการ)
2. [บทบาทและหน้าที่ผู้ใช้งาน (User Roles & Responsibilities)](#2-บทบาทและหน้าที่ผู้ใช้งาน)
3. [ขั้นตอนการปฏิบัติงานมาตรฐาน (Standard Operating Procedure: 7-Step Pipeline)](#3-ขั้นตอนการปฏิบัติงานมาตรฐานของระบบ-pmt-flow-pipeline-architecture)
   - [Step 1: รับ Order, Design & BOQ (One-Stop Studio)](#step-1-รับ-order-design--boq-unified-one-stop-order-studio)
   - [Step 2: คลังแบบแปลน (Design & Blueprints Repository)](#step-2-คลังแบบแปลนติดตั้ง--design-studio)
   - [Step 3: คลังรายการ BOQ (BOQ Repository & Costing)](#step-3-คลังรายการ-boq--ประมาณการราคา)
   - [Step 4: บันทึก Ticket & ใบเสร็จ (Work Ticket & Receipts)](#step-4-บันทึก-ticket--ใบเสร็จรับเงิน)
   - [Step 5: แปลง BOQ เข้า Project & Gantt (Gantt Timeline)](#step-5-แปลง-boq-เข้า-project--gantt-timeline)
   - [Step 6: การตรวจรับรองคุณภาพงาน (QC Online & On-site)](#step-6-การตรวจรับรองคุณภาพงาน-qc-inspection)
   - [Step 7: สรุปผลความพึงพอใจ & ปิดงานส่งไประบบ BMT (CSAT & Close Job)](#step-7-สรุปผลความพึงพอใจ--ส่งต่อบริการหลังการขาย-csat)
4. [ฟังก์ชันเสริมและการติดตามงาน (Additional Features)](#4-ฟังก์ชันเสริมและการติดตามงาน)
5. [คำถามที่พบบ่อยและข้อควรระวัง (FAQ & Best Practices)](#5-คำถามที่พบบ่อยและข้อควรระวัง)

---

## 1. ภาพรวมระบบและสถาปัตยกรรมกระบวนการ

ระบบ **PMT Flow** ถูกออกแบบมาเพื่อเป็นศูนย์กลางการบริหารจัดการงานโครงการติดตั้ง, ออกแบบแปลน, ควบคุมต้นทุน (BOQ), วางแผนงานช่าง (Gantt), ควบคุมคุณภาพ (QC) และบริการหลังการขาย โดยเชื่อมต่อกับระบบภายนอกอย่างสมบูรณ์:

```mermaid
flowchart LR
    A["🛒 ระบบ AE / INT<br/>(ขาย & จองคิว)"] -->|"Webhook / API<br/>Auto-Ingest"| B["⚡ ระบบ PMT Flow<br/>(One-Stop Studio • Gantt • QC)"]
    B -->|"Close Job API<br/>Auto-Sync"| C["🏢 ระบบ BMT<br/>(บัญชี & ปิดงานสมบูรณ์)"]
```

### จุดเด่นของ Workflow:
1. **One-Stop Order Studio:** รวมการรับ Order, แนบแบบแปลน CAD/PDF และถอดราคา BOQ ไว้ในหน้าต่างเดียวใน Step 1
2. **Dual Fast-track & Project Track:** รองรับทั้งงาน Quick Services (จบงานเร็วใน 1 คลิก) และงาน Renovate (ส่งต่อเข้าสู่ระบบวิศวกรรมและ Gantt)
3. **GPS & Photo Verification:** ยืนยันพิกัดเข้างานจริงด้วย Geo-fence รัศมี 400 เมตร พร้อมตรวจสอบภาพถ่ายหน้างาน 5 รูปหลัก
4. **Standardized QC Inspection:** ตรวจสอบคุณภาพงานทั้งแบบ QC Online (งานด่วน) และ QC On-site พร้อมระบบจองช่าง Lead QC
5. **CSAT to BMT:** บันทึกคะแนนความพึงพอใจลูกค้า 5 ดาว และส่งข้อมูลปิดงานเข้าสู่ระบบบัญชี/การเงิน BMT อัตโนมัติ

---

## 2. บทบาทและหน้าที่ผู้ใช้งาน

| บทบาท (Role) | สิทธิ์และหน้าที่หลักในระบบ PMT |
| :--- | :--- |
| **Project Manager (PM) / Solutions Architect (SA)** | บริหารจัดการคำสั่งซื้อผ่าน One-Stop Studio ใน Step 1, จัดสรรทีมช่าง, และติดตามภาพรวมความคืบหน้าบน Gantt Timeline |
| **ทีมช่างเทคนิค (Field Technician)** | กด Check-in ยืนยันพิกัด GPS, บันทึกรูปถ่ายหน้างาน (5 รูปหลัก + รูปเพิ่มเติม) และลงบันทึกประจำวัน (Daily Logs) |
| **เจ้าหน้าที่ควบคุมคุณภาพ (QC Inspector)** | บันทึกข้อควรระวังหน้างาน, ตรวจสอบ Checklist มาตรฐาน (PASS/FAIL), อนุมัติส่งมอบงาน (QC Online / On-site) |
| **Cost Controller / Designer** | จัดการคลังแบบแปลน (Blueprints) ใน Step 2, นำเข้า/ส่งออกและวิเคราะห์ต้นทุน BOQ ใน Step 3 |
| **Contact Center / บริการหลังการขาย** | โทรสอบถามประเมินความพึงพอใจลูกค้า (CSAT), บันทึกข้อเสนอแนะ, กด Close Job ส่งข้อมูลไประบบ BMT |

---

## 3. ขั้นตอนการปฏิบัติงานมาตรฐานของระบบ PMT Flow (Pipeline Architecture)

ระบบ PMT Flow รองรับการไหลของงาน 2 สายหลัก:
- **Quick Services (งานด่วน):** Step 1 (One-Stop Studio) ➔ **1-Click Proceed เข้าสู่ Step 4 (เปิด Ticket & ใบเสร็จ)** ➔ Step 6 (QC Online ตรวจรูปถ่าย) ➔ Step 7 (CSAT & Close BMT)
- **Renovate Projects (งานโครงการ):** Step 1 (One-Stop Studio) ➔ **1-Click Proceed เข้าสู่ Step 5 (แปลง BOQ เข้า Gantt Timeline)** ➔ Step 6 (QC On-site ตรวจหน้างาน) ➔ Step 7 (CSAT & ปิดสัญญา MA)

```mermaid
graph TD
    S1["Step 1: One-Stop Order Studio<br/>(Order Intake + Design Studio + BOQ Ingestion)"]
    
    S1 -->|Quick Services (Fast-track)| S4["Step 4: บันทึก Ticket & แนบสลิปชำระเงิน"]
    S1 -->|Renovate / Projects| S5["Step 5: แปลง BOQ เข้า Project & Gantt"]
    
    S4 --> S6Q["Step 6: QC Online (ตรวจรูปถ่าย Visit Plan)"]
    S5 --> S6R["Step 6: ตรวจรับรอง On-site & จองช่าง QC Lead"]
    
    S6Q --> S7["Step 7: ความพึงพอใจลูกค้า CSAT & ปิดงาน BMT / สัญญา MA"]
    S6R --> S7
```

---

### Step 1: รับ Order, Design & BOQ (Unified One-Stop Order Studio)
*(Order Intake, Blueprints CAD & BOQ Costing)*

*(สำหรับคู่มือฝึกอบรมฉบับสมบูรณ์ โปรดดูที่: [คู่มือการใช้งาน_Step1_คิวงานรับคำสั่งซื้อใหม่.md](คู่มือการใช้งาน_Step1_คิวงานรับคำสั่งซื้อใหม่.md))*

1. **การรับงานและเปิด Studio:**
   - Order ใหม่จากระบบ INT จะปรากฏในสถานะ **`Draft`** พร้อมป้ายแสดงสถานะแบบแปลน (Design) และราคา (BOQ) ในตาราง
   - คลิกปุ่ม **`[ Studio: จัดการ Order/แบบ/BOQ ]`** หรือคลิกที่ Badge ในตาราง เพื่อเปิดหน้าต่าง One-Stop Studio
2. **การทำงานใน 3 แท็บ:**
   - **แท็บ 1 (ข้อมูลคำสั่งซื้อ & ลูกค้า):** ตรวจสอบข้อมูลลูกค้า, เบอร์โทร, พิกัด GPS, นัดหมายเวลา (รูปแบบ 24 ชม.) และมอบหมายทีมช่าง
   - **แท็บ 2 (แบบแปลน & CAD Studio):** เลือกโซนงาน (เช่น ครัว, ห้องน้ำ) และแนบไฟล์แปลนติดตั้ง CAD/PDF
   - **แท็บ 3 (รายการถอดราคา BOQ):** บันทึกรายการวัสดุและค่าแรง คำนวณยอดเงิน Subtotal, ส่วนลด, VAT 7% และ Grand Total แบบ Real-time
3. **การส่งต่องาน 1-Click Proceed:**
   - ตรวจสอบความพร้อมของข้อมูลทั้ง 3 แท็บ
   - คลิกปุ่ม **`🚀 ยืนยันข้อมูล & ส่งต่อไปขั้นตอนถัดไป`** เพื่อส่งต่องานเข้าสู่ Step 4 หรือ Step 5 ทันที

---

### Step 2: คลังแบบแปลนติดตั้ง & Design Studio
*(Blueprints & CAD Repository)*

*(สำหรับคู่มือฝึกอบรมฉบับสมบูรณ์ โปรดดูที่: [คู่มือการใช้งาน_Step2_บันทึกแบบแปลนติดตั้ง.md](คู่มือการใช้งาน_Step2_บันทึกแบบแปลนติดตั้ง.md))*

- ทำหน้าที่เป็นศูนย์กลางจัดเก็บและบริหารแบบแปลนของทุกโครงการ (Multi-Zone Blueprints Library)
- รองรับการเปิดดูแบบแปลนความละเอียดสูงผ่าน Lightbox, จัดการเวอร์ชันแบบแปลน (`v1 Draft`, `v2 Approved`, `v3 Final`) และดาวน์โหลดไฟล์ CAD/PDF

---

### Step 3: คลังรายการ BOQ & ประมาณการราคา
*(BOQ Repository & Costing)*

*(สำหรับคู่มือฝึกอบรมฉบับสมบูรณ์ โปรดดูที่: [คู่มือการใช้งาน_Step3_นำBOQเข้าระบบ.md](คู่มือการใช้งาน_Step3_นำBOQเข้าระบบ.md))*

- ทำหน้าที่เป็นศูนย์กลางคลังรายการ BOQ รวมของระบบ
- รองรับการนำเข้าไฟล์ใบเสนอราคาภายนอก (Excel `.xlsx` / `.csv` / vFIX), การเลือกชุด Template สำเร็จรูป 4 กลุ่มงาน และการวิเคราะห์ต้นทุนโครงการ

---

### Step 4: บันทึก Ticket & ใบเสร็จรับเงิน
*(Work Ticket & Receipts)*

1. เปิดใบสั่งงาน (Work Ticket) สำหรับมอบหมายให้ทีมช่างเข้าปฏิบัติงาน
2. บันทึกและแนบหลักฐานสลิปการชำระเงิน หรือใบเสร็จรับเงินจากลูกค้า
3. ตรวจสอบความพร้อมก่อนส่งต่อเข้าสู่กระบวนการตรวจรับรองคุณภาพงาน (QC)

---

### Step 5: แปลง BOQ เข้า Project & Gantt Timeline
*(Convert BOQ to Project Tasks & Gantt)*

1. ระบบดึงเฉพาะรายการหมวด **"ค่าแรง / บริการ"** จาก BOQ มาแปลงเป็น Tasks บน Gantt Chart โดยอัตโนมัติ
2. กำหนดช่วงเวลาปฏิบัติงาน (Start - End Date) และมอบหมายช่างหรือทีมช่าง (Crew)
3. ติดตามสถานะงานบน Gantt Chart แบบ Real-time

---

### Step 6: การตรวจรับรองคุณภาพงาน (QC Inspection)
*(QC Online & On-site Inspection)*

1. **QC Online (สำหรับงาน Quick Services):** ตรวจสอบรูปถ่ายหน้างาน 5 รูปหลักที่ช่างอัปโหลดผ่าน Visit Plan และอนุมัติผลผ่านระบบ
2. **QC On-site (สำหรับงาน Renovate):** จองคิวช่าง Lead QC เข้าตรวจสอบหน้างานจริงพร้อมแบบฟอร์ม Checklist มาตรฐาน (PASS/FAIL)

---

### Step 7: สรุปผลความพึงพอใจ & ส่งต่อบริการหลังการขาย (CSAT)
*(CSAT Evaluation & Close Job to BMT)*

1. Contact Center โทรสอบถามความพึงพอใจลูกค้า บันทึกคะแนน (⭐ 1 ถึง 5 ดาว) และข้อเสนอแนะ
2. คลิกปุ่ม **`Close & ส่ง BMT`** เพื่อส่งข้อมูลปิดงานเข้าสู่ระบบการเงินและบัญชี BMT
3. ส่งต่องานเข้าสู่ระบบติดตามการรับประกันและสัญญาบำรุงรักษา (MA Contracts)

---

## 4. ฟังก์ชันเสริมและการติดตามงาน

### 4.1 แผนงาน Gantt Timeline
- เมนู **`แผนงาน (Gantt Timeline)`** แสดงตารางเวลาการทำงานของแต่ละทีมช่างในรูปแบบแถบสี Timeline ชัดเจน

### 4.2 บันทึกงานช่างประจำวัน (Daily Technician Work Logs)
- หน้าจอ `บันทึกงานช่าง` และโมดอลใน Gantt Chart รองรับการบันทึกชั่วโมงการทำงานจริง (รูปแบบ 24 ชม.), หมายเหตุหน้างาน และรูปถ่ายผลงาน 5 รูปพร้อม Lightbox

### 4.3 ระบบค้นหาด่วน (Global Quick Search)
- กดคีย์ลัด `Ctrl + K` (หรือ `⌘K`) เพื่อเปิดหน้าต่างค้นหา Job ID, ชื่อลูกค้า, เบอร์โทร หรือช่างได้ทั่วทั้งระบบ

---

## 5. คำถามที่พบบ่อยและข้อควรระวัง (FAQ & Best Practices)

> [!IMPORTANT]
> **Q: ระบบ PMT Flow กำหนดมาตรฐานวันที่และเวลาอย่างไร?**
> **A:** ทุกหน้าจอของระบบแสดงผลวันที่ในรูปแบบ **`DD/MM/YYYY`** (เช่น `08/09/2026`) และรูปแบบเวลา **24 ชั่วโมง (`00:00 - 23:59 น.`)** โดยไม่มีระบบ AM/PM

> [!NOTE]
> **Q: สามารถแก้ไขข้อมูล BOQ หรือแบบแปลนหลังจากบันทึกผ่าน Step 1 Studio ได้หรือไม่?**
> **A:** สามารถเปิด Studio กลับมาแก้ไขได้ตลอดเวลา หรือเข้าไปจัดการผ่านเมนู Step 2 (คลังแบบแปลน) และ Step 3 (คลัง BOQ) โดยข้อมูลจะซิงค์กันแบบ Real-time 100%

---

**จัดทำโดย:** ทีมพัฒนาระบบ PMT Flow (Enterprise Operations)  
**เวอร์ชันเอกสาร:** v3.0 (Unified One-Stop Order Studio Edition)  
**วันที่ปรับปรุงล่าสุด:** กันยายน 2026
