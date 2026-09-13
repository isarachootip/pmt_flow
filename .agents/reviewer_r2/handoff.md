# PMT Flow - Adversarial Reviewer & QA (Round 2) Handoff Report

## Executive Summary
This document records the adversarial review, deep bug detection, and quality assurance actions performed on PMT Flow (`c:/atgv/pmt_flow`), specifically targeting the **"นำเข้าใบ BOQ / ใบเสนอราคา vFIX (Import BOQ)"** pipeline, Customer Name Protection standard, Date/Time standards, Light Theme compliance, and Online Manual synchronization.

---

## 1. Identified Defects from Prior Attempt & Root Cause Analysis

### Defect 1: JavaScript Runtime Method Shadowing Bug (Fatal Functional Risk)
- **Input:** Invocation of `this.formatDateDMY('25/8/69')` or `this.formatDateDMY(46259)`.
- **Expected:** Parse 2-digit Buddhist Era year `69` ➔ CE year `2026` (`25/08/2026`) and Excel serial date `46259` ➔ `25/08/2026`.
- **Actual:** Prior implementation added robust logic at line 412 in `public/js/app.js`, but an inferior duplicate definition of `formatDateDMY` and `formatDateTimeDMY` existed at line 13284, which silently shadowed and completely overwrote the comprehensive parser at runtime.
- **Root Cause:** Duplicate method declaration on the `PMTApp` object literal in `app.js`.
- **Fix:** Removed duplicate definitions around line 13284, ensuring the primary, fully-featured parser handles all date conversions globally.

### Defect 2: Unhandled Object Type on `job.customer` in BOQ Export & Modals (Fatal Runtime Crash)
- **Input:** Invocation of `exportCurrentBOQToExcel()` or `generateBOQFileObject()` when `job.customer` is an object `{ name: '...', phone: '...' }` (as returned by the backend schema in `server.ts` line 1837).
- **Expected:** Clean extraction of customer name string followed by filename sanitization (e.g., replacing spaces and special characters with underscores).
- **Actual:** `job.customer.replace(...)` threw `TypeError: job.customer.replace is not a function`, crashing the entire export action.
- **Root Cause:** Direct assumption that `job.customer` is always a primitive string.
- **Fix:** Added `const custName = (typeof job.customer === 'object' && job.customer !== null) ? (job.customer.name || '') : String(job.customer || '');` before calling string methods across all BOQ modals, export functions, and headers.

### Defect 3: Standard Violation - Browser Locale Dates in BOQ Export & Manage Modal
- **Input:** BOQ generation/export and modal rendering.
- **Expected:** Dates formatted strictly according to the mandatory `DD/MM/YYYY` standard (`this.formatDateDMY(...)` and `this.formatDateTimeDMY(...)`).
- **Actual:** Code invoked `toLocaleDateString('th-TH')` and `toLocaleString('th-TH')`, which formats with Thai month names or variable system formatting, violating the GEMINI.md mandate.
- **Root Cause:** Inconsistent helper usage in legacy export functions.
- **Fix:** Replaced all `toLocaleDateString` and `toLocaleString` invocations with `this.formatDateDMY` and `this.formatDateTimeDMY`.

### Defect 4: Excel Serial Date Timezone Offset Bug
- **Input:** Excel numeric serial dates (e.g. `46259` representing 25/08/2026).
- **Expected:** Deterministic output `25/08/2026` across all client timezones.
- **Actual:** Local methods (`getDate()`, `getMonth()`, `getFullYear()`) on converted serial timestamps were susceptible to date shifting under negative UTC offsets or boundary hour calculations.
- **Root Cause:** Usage of local timezone getters rather than UTC getters on epoch-offset calculations.
- **Fix:** Switched to UTC getters (`getUTCDate()`, `getUTCMonth()`, `getUTCFullYear()`) ensuring 100% timezone-immune date calculation.

### Defect 5: Unclamped Negative Numeric Inputs (Business Logic Flaw)
- **Input:** Negative discounts (e.g. `-500`), negative quantities, or negative unit prices in pasted/imported BOQ lines.
- **Expected:** Values clamped to `>= 0`. A negative discount should not increase the project payable total.
- **Actual:** Negative discounts increased the total payable amount, and negative quantities reduced invoice amounts without validation.
- **Root Cause:** Direct addition/subtraction without `Math.max(0, ...)`.
- **Fix:** Clamped discounts to `Math.max(0, Number(job.boq_discount) || 0)`, and line item quantities/prices to non-negative floats.

### Defect 6: Residual `dark:` Tailwind Utility Classes (GEMINI.md Compliance)
- **Input:** Rendering of Topbar user management button, auth button, Dashboard cards, Status table in FAQ, and MA checklist.
- **Expected:** Pure Light Theme 100% with no residual dark mode classes.
- **Actual:** Multiple elements in `index.html` and `public/js/app.js` contained `dark:` classes.
- **Root Cause:** Incomplete manual cleanup in prior rounds.
- **Fix:** Purged all remaining `dark:` utility classes from `index.html` and targeted BOQ/KPI components.

---

## 2. Files Modified & Changes Summary

1. **`public/js/app.js`**:
   - `formatDateDMY` (lines 412-424): Added numeric Excel serial date parsing via UTC methods.
   - Removed shadowing duplicates of `formatDateDMY` and `formatDateTimeDMY` (lines 13284-13318).
   - `recalculateJobBOQ`, `parseVFixExcelSheet`, `parsePastedBOQ`, `confirmImportBOQ`, `renderManageBOQModal`, `updateModalBOQItem`, `recalculateModalBOQSummary`: Implemented non-negative clamping for discount, quantity, and unit prices.
   - `openImportBOQModal`, `renderManageBOQModal`, `generateBOQFileObject`, `exportCurrentBOQToExcel`: Added safe customer string extraction for object customers, eliminating `TypeError: job.customer.replace is not a function`.
   - Replaced locale date methods with `this.formatDateDMY` and `this.formatDateTimeDMY`.

2. **`index.html`**:
   - Purged residual `dark:` utility classes from `topbar-user-mgmt-btn`, `topbar-auth-btn`, dashboard KPI cards, `modal-confirm-proceed-boq`, `modal-manage-boq`, `modal-csat-eval`, `upload-bp-dropzone`, `modal-step-audit-report`, `modal-daily-work-log`, `modal-api-log-detail`, `modal-ma-checklist`, and FAQ status table.
   - Verified that Notice / Alert in `modal-import-boq` prominently communicates Customer Name Protection with lock badge.

3. **`test_boq_import_scenario.js`**:
   - Expanded test suite to 9 automated test scenarios covering template parsing, cost breakdown, customer protection, labor-to-task conversion, hybrid item pricing, Buddhist Era/Excel serial dates, customer object resilience, non-negative clamping, and pasted BOQ SKU fallback generation.

4. **Documentation (`doc/*.md` and `page-faq` in `index.html`)**:
   - Updated `doc/คู่มือการใช้งาน_Step3_นำBOQเข้าระบบ.md` with Q4 explaining Customer Name Protection standard.
   - Synced `page-faq` in `index.html` with Q13 detailing line-items-only ingestion and customer data locking.

---

## 3. Verification & Test Evidence

- **Automated Verification (`test_boq_import_scenario.js`):**
  - Test 1: vFIX quotation template extraction (Customer: นภัสวรรณ มีศิริ, 5 items).
  - Test 2: Material (฿3,900) vs Labor (฿2,500) cost breakdown, Subtotal ฿6,400, VAT 7% ฿413.00, Grand Total ฿6,313.00.
  - Test 3: Customer protection verification (`job.customer` remains 'ณวัฒน์ รักสงบ', not overwritten by source file).
  - Test 4: Labor-only task conversion (pure materials filtered out; only 1 labor item converted to Gantt task).
  - Test 5: Hybrid line items calculation (Mat ฿1,200 + Labor ฿800 = ฿2,000 unit price, Total ฿4,000).
  - Test 6: Buddhist Era (`25/8/69`, `25/08/2569`), CE (`2026-09-05`), and Excel serial date (`46259`) normalization to `DD/MM/YYYY`.
  - Test 7: Customer object resilience (`job.customer = { name: '...', phone: '...' }` safely sanitized without TypeError).
  - Test 8: Non-negative clamping (negative discount clamped to 0).
  - Test 9: Pasted BOQ fallback SKU generation.

- **Manual / Code Structure Verification:**
  - Verified that `login-overlay` remains top-level direct child of `<body>`.
  - Verified that all modal `<div>` tags are balanced.
  - Verified that List View remains the default view across all steps.
