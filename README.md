# SPMT / PMT — Store Project Management Tool

ระบบบริหารงานโครงการและงานติดตั้งหน้าร้าน (Store Project Management & Installation Tracking)

## 📌 Project Overview
SPMT/PMT เป็นระบบบริหารจัดการโครงการและงานติดตั้งภาคสนามแบบครบวงจร รองรับตั้งแต่การรับ Order จากระบบ INT, การเข้าเยี่ยมหน้างานพร้อมบันทึก Check-in GPS และรูปถ่าย 5 รูป, งานออกแบบ (Design Versioning), การทำราคา (BOQ), การจัดคิวช่าง (Gantt Chart), การตรวจคุณภาพ (QC), งานหลังการขาย (After Sale & CSAT), จนถึงการส่งข้อมูลปิดงานไประบบ BMT

---

## 📁 Repository Structure
```
c:/atgv/pmt_flow/
├── index.html          # Web Application Frontend (Luxury Gold-Black Theme)
├── server.ts           # Production Backend REST API (TypeScript / Express)
├── schema.sql          # PostgreSQL Database Schema & Initial Data Seeding
├── docker-compose.yml  # Docker Container Setup (PostgreSQL, Redis, API, Web)
├── openapi.yaml        # OpenAPI 3.0 (Swagger) Specification
├── REQUIREMENTS.md     # Software Requirements Specification (v1.3)
└── README.md           # Documentation
```

---

## 🚀 Quick Start (Local Run)
1. **เปิด Frontend Web Application:**
   เปิด `index.html` บน Web Browser ใดก็ได้เพื่อทดสอบ UI และ Demo Data

2. **รันระบบผ่าน Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **รัน Database Schema:**
   ```bash
   psql -U spmt_admin -d spmt_db -f schema.sql
   ```

---

## 🔐 API Reference
ดูรายละเอียด API Specification ทั้งหมดได้ที่ `openapi.yaml` หรือนำไปนำเข้าใน Postman / Swagger UI

---
© 2569 SPMT / PMT System
