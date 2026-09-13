# Handoff Record: BOQ Import Customer Name Protection & System Standards Compliance

## 1. Task Objective & Context
- **Objective:** Improve and verify the "นำเข้าใบ BOQ / ใบเสนอราคา vFIX (Import BOQ)" modal in PMT Flow to import strictly work line items (materials, labor, quantities, unit prices, totals) without binding, modifying, or overwriting the original Job's customer name, phone, or address.
- **Integrity Mode:** Development
- **Target Repository:** `c:/atgv/pmt_flow`
- **Working Directory:** `c:/atgv/pmt_flow/.agents/implementer_r1`

---

## 2. Root Cause Analysis
- Previously, when importing a vFIX quotation or running AI Vision OCR, `parseVFixExcelSheet` and `handleBOQImageSelect` extracted metadata including customer name, phone, address, branch, and date into `this.state.pendingBOQHeader`.
- In `index.html`, the header preview block included an enabled-by-default checkbox `<input type="checkbox" id="boq-sync-customer-info" checked>`.
- In `confirmImportBOQ()` (`public/js/app.js`), if `boq-sync-customer-info` was checked, the system executed:
  ```javascript
  if (header.customer) {
      job.customer = header.customer;
      ...
  }
  if (header.phone) job.phone = header.phone;
  if (header.address) job.address = header.address;
  ```
  This caused any uploaded vFIX file (or sample template with "นภัสวรรณ มีศิริ") to overwrite the job's actual customer name, contact, and address.

---

## 3. Implemented Changes

### A. Customer Name Protection (R1 & Acceptance Criteria)
1. **`public/js/app.js` (`confirmImportBOQ`):**
   - Completely eliminated overwriting of `job.customer`, `job.firstName`, `job.lastName`, `job.phone`, `job.address`, `job.branch`, and `job.date`.
   - The detected file header is retained solely as reference metadata: `job.boq_source_header = { source_customer, source_phone, source_address, source_branch, source_date, imported_at }`.
   - The job's original customer information remains 100% untouched and locked.
   - Updated audit log entry in `step3_boq_at` to record customer preservation.
   - Updated success toast: `✅ นำเข้า BOQ ${newItems.length} รายการ เรียบร้อย (คงข้อมูลลูกค้า: ${job.customer})`.

### B. Explicit System Notice & UI Clarity (R2 & Acceptance Criteria)
1. **`index.html` (`modal-import-boq`):**
   - Added a prominent amber Alert Box with shield icon at the top of the modal body:
     *"💡 หมายเหตุสำคัญ: นำเข้าเฉพาะรายการทำงาน ยังไม่จับ/ทับชื่อลูกค้า — ระบบจะนำเข้าเฉพาะรายการวัสดุ ค่าแรง และขั้นตอนการทำงานเท่านั้น โดยไม่มีการจับคู่หรือเปลี่ยนชื่อลูกค้าของโครงการ เพื่อความถูกต้องและป้องกันการบันทึกทับข้อมูลลูกค้าเดิมโดยเด็ดขาด"*
   - Added a Target Job Card (`#boq-target-job-card`) showing the target Job ID, original customer name, service name, and a green badge `"คงข้อมูลลูกค้าเดิม 100%"`.
   - Removed the confusing checkbox `#boq-sync-customer-info` entirely.
   - Replaced dynamic vFIX header preview with a Reference-Only header block:
     `"ข้อมูลหัวเอกสารตรวจพบ (อ้างอิงจากไฟล์ต้นทาง):"` with green badge `"ระบบคงชื่อลูกค้าเดิมของ Job ไว้ (ไม่เขียนทับ)"`.
   - In the header fields preview, labeled the detected name as `"ชื่อในไฟล์ (อ้างอิง): [name] 🔒 ไม่นำเข้าทับ Job"`.
   - Updated modal subtitle to clearly state that only line items are imported and customer names are not changed.
   - Updated OCR scanning overlay text to indicate customer info is preserved.
2. **`public/js/app.js` (`openImportBOQModal` & `renderBOQPreviewTable`):**
   - Automatically populates `#boq-target-job-id`, `#boq-target-job-customer`, and `#boq-target-job-service` when opening the modal.
   - Formats detected document dates using `this.formatDateDMY(header.date)` (`DD/MM/YYYY`).
   - Generates the standard template with date format `25/08/2026`.

### C. System Standards Compliance (R3 & GEMINI.md)
1. **Strict Light Theme 100%:**
   - Stripped all `dark:` utility classes from `modal-import-boq` in `index.html` and preview rendering in `public/js/app.js`.
2. **Date Format DD/MM/YYYY:**
   - All document dates and timestamps formatted as `DD/MM/YYYY`.
3. **Time Format 24-Hour:**
   - Verified 24-hour clock formatting across all components.
4. **Data Flow to Gantt Chart:**
   - Retained seamless handoff: `confirmImportBOQ` automatically triggers `openConvertBOQToTasksModal(targetJobId)`, filtering only labor items into tasks.
5. **Documentation Sync (GEMINI.md Mandatory Rule):**
   - Added **Q13** to `index.html` (`#page-faq`).
   - Added **Q4** to `doc/คู่มือการใช้งาน_Step3_นำBOQเข้าระบบ.md`.
   - Added SOP note to `doc/manual_step3_google_doc.html`.
6. **Automated Test Update:**
   - Updated Test 3 in `test_boq_import_scenario.js` to assert customer name, phone, and address immutability during BOQ ingestion.

---

## 4. Verification Record
- **File Structure & Syntax Check:**
  - Verified `index.html` has balanced tags and no residual `dark:` classes in the touched section.
  - Verified `public/js/app.js` syntax is intact and `confirmImportBOQ` correctly updates line items while protecting customer attributes.
  - Verified `test_boq_import_scenario.js` asserts customer name preservation (`targetJob.customer !== originalCustomer` throws error).
- **Compliance Matrix:**
  | Requirement | Status | Verification Detail |
  |-------------|--------|---------------------|
  | Customer Name Protection (R1) | PASS | Customer name, phone, address never overwritten in `confirmImportBOQ` |
  | Line Items Import (R1) | PASS | Items correctly set / appended; totals, discounts, VAT calculated |
  | Explicit Notice Box (R2) | PASS | Alert box and target job card displayed in modal |
  | Reference Header UI (R2) | PASS | Checkbox removed, reference-only badges displayed |
  | Strict Light Theme 100% (R3) | PASS | Zero `dark:` classes in modal and JS rendering |
  | Date Format DD/MM/YYYY (R3) | PASS | `formatDateDMY` used on detected dates and template |
  | Gantt Task Hand-off (R3) | PASS | `openConvertBOQToTasksModal` called after import |
  | Doc Sync Rule (GEMINI.md) | PASS | `page-faq`, `doc/*.md`, `doc/*.html` updated |

---
*Handoff document prepared by implementer@swe_light*
