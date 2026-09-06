---
name: daily-work-log
description: >-
  Specifications, guidelines, and standards for Daily Technician Work Logs (บันทึกงานช่างประจำวัน)
  and the mandatory 24-Hour Time Format Standard (00:00 - 23:59, strictly NO AM/PM) across PMT Flow.
---

# Daily Technician Work Log & 24-Hour Time Standard Skill

## 🎯 Purpose & Overview
This skill governs the **Daily Technician Work Log (บันทึกงานช่างประจำวัน)** and enforces the **24-Hour Time Standard (ไม่มี AM/PM)** across all views and forms in PMT Flow (`https://vibepmt.online`).

---

## ⏰ 1. Standard: 24-Hour Time Format (Strictly NO AM/PM)

### 1.1 Core Rules
- **Pure 24-Hour Clock**: All time representations, selectors, and summary displays MUST use standard 24-hour time format (`HH:mm` or `HH:mm น.`), such as `07:00`, `08:30`, `12:00`, `13:30`, `17:00`, `18:00`.
- **Prohibited**: Never use 12-hour clocks with AM / PM (e.g. `08:30 AM`, `05:00 PM`) anywhere on user-facing UI.
- **No Native `<input type="time">`**: Native browser `<input type="time">` triggers OS-dependent popups that force 12-hour AM/PM columns on Windows machines. **Always use custom 24-hour hour & minute selectors** (`render24HourTimePickerHtml`) or controlled dropdowns with hidden inputs.

### 1.2 Custom 24-Hour Picker Implementation
```javascript
// Dropdown Hour options: 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 00..05
// Dropdown Minute options: 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 (every 5 mins)
```
- Store clean string `"08:30"` into hidden input element `${prefix}-input-${type}-time` so downstream APIs and duration calculators receive standard `HH:mm`.

### 1.3 Quick Shift Presets (ปุ่มลัดกะเวลาทำงานด่วน)
Provide 1-click preset buttons for technicians:
- `08:00 - 17:00`
- `08:30 - 17:00` (Default shift)
- `08:30 - 17:30`
- `09:00 - 18:00`
- `13:00 - 17:00` (Afternoon half-day)

---

## 📋 2. Daily Technician Work Log Architecture

### 2.1 Dual-Access Views
1. **Dedicated Page (`page-daily-logs`)**:
   - Accessible via sidebar menu **"บันทึกงานช่างประจำวัน"** (`nav-daily-logs`).
   - Filterable by Job (Project) and Gantt Task.
   - Shows chronological timeline cards and active day progress.
2. **Integrated Gantt Modal (`modal-daily-work-log`)**:
   - Accessible from Gantt task rows via button **"บันทึกช่าง"** (`app.openDailyWorkLogModal(taskId)`).
   - Allows quick log entry while inspecting project timeline.

### 2.2 Form Fields
- **Work Date**: Standard Date input (must display in `DD/MM/YYYY` format).
- **Day Number (รอบที่)**: Day # out of total task days (e.g., Day 1 / 3).
- **Time In / Time Out**: Custom 24-hour selectors with automatic duration calculation (`⏱️ รวม 8 ชม. 30 นาที (08:30 - 17:00 น.)`).
- **Recorded By & Role**: Technician Name & Role (`TECH` / `QC`).
- **Progress Slider**: 0% to 100% cumulative completion slider with quick buttons (35%, 70%, 100%).
- **Daily Accomplishment**: Required details of work done on the day.
- **Additional Details & Materials**: Installed materials, equipment, and reference CAD drawings.
- **Issues / Blockers**: Site obstacles, weather, or smooth progress notes.

---

## 📸 3. 5-Photo Slots Specification with Live Preview & Lightbox

### 3.1 Five Standard Phases
1. **รูปที่ 1: ก่อนเริ่มงาน (Before)** — Inspection of original site condition before work begins.
2. **รูปที่ 2: ระหว่างทำ #1 (During 1)** — Demolition, piping layout, structural preparation.
3. **รูปที่ 3: ระหว่างทำ #2 (During 2)** — Core electrical wiring, plumbing, or main installation.
4. **รูปที่ 4: ความปลอดภัย & ทดสอบ (Testing)** — Voltage/pressure testing, anchor safety, compliance.
5. **รูปที่ 5: งานเสร็จสมบูรณ์ (After)** — Completed installation, site cleaned, ready for handover.

### 3.2 Photo Features
- Real file upload via `FileReader.readAsDataURL(file)`.
- Instant thumbnail preview in 5 responsive slots.
- Click to open full-screen **Lightbox Modal** (`app.showLightbox(url, title, phase, desc, time)`).
- One-click sample loader (`app.loadSamplePhotosForDailyLog(prefix)`).

---

## 🔗 4. QC & Gantt Handoff
- Checking **"☑️ ช่างบันทึกสำเร็จ (งานติดตั้งเสร็จสมบูรณ์ 100%)"** or clicking **"🚀 ยืนยันสำเร็จ & ส่งตรวจ QC"**
  - Updates Task status to `DONE` (`100%`).
  - Updates Project status to `QC_PENDING` (`85%`).
  - Confirms QC booking date on task end date (`qcBookingDate`).
  - Adds audit trail entry and notifies system toast.
