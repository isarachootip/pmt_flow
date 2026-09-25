# Implementation Handoff: PMT Flow V2 "รับงาน & คิวงาน" (/orders) Enhancements

## Summary
Enhanced the PMT Flow V2 "รับงาน & คิวงาน" (Orders & Queue Management at `/orders`) to support multi-field search (Customer Name, Phone, Booking Number, Ref ID), default creation date sorting (`created_at` descending), date range filtering with strict `DD/MM/YYYY` inputs, appointment date formatting with 24-hour time badges (strictly NO AM/PM), and alignment of the detail panel tabs in `JobDetailTabs` to the core operational pipeline: `[งาน/Task]` -> `[BOQ]` -> `[เงินสำรอง]` -> `[QC]` -> `[ส่งออก STK]`.

---

## 1. What Was Changed

### 1.1 `web/src/pages/orders.tsx`
- **Multi-Field Search**: Added a search input that searches in real-time across Customer Name, Phone Number, Booking Number (`booking_no`), External Reference ID (`ref_id`), and Job Number (`job_no`).
- **Dedicated Columns for Booking No & Ref ID**: Added dedicated columns in the master DataGrid for `Booking No` and `Ref ID` with clear font-mono badges and Pure Black text (`#000000`).
- **Creation Date Sorting**: Defaulted table sorting to system entry date (`created_at`) descending (latest records first), backed by secondary sorting on ID.
- **Date Range Filter**: Added a `DateRangePicker` component filter (From Date - To Date) enforcing strict `DD/MM/YYYY` placeholders and format, filtering jobs based on creation date / appointment date. Added a quick "ล้างตัวกรอง" button when filters are active.
- **Appointment Date & 24-Hour Time Format Badge**: In the "วันนัด" (Appointment Date) column, formatted the date in `DD/MM/YYYY` format and added a 24-hour time badge (e.g. `09:00 น.` or `13:30 น.`, strictly NO AM/PM).
- **Theme & Typography**: Strictly preserved Light Theme with 100% Pure Black font (`#000000`).

### 1.2 `web/src/features/jobs/job-detail-tabs.tsx`
- **Pipeline Tab Order**: Realigned detail panel tabs to the 5 core workflow steps in exact sequence:
  1. `งาน/Task` (value="task") - Job overview cards and task assignment table
  2. `BOQ` (value="boq") - Bill of Quantities & Pricing table (`BoqTab`)
  3. `เงินสำรอง` (value="petty_cash") - Petty Cash / Advance Expense summary, table of expense records, and modal form for "+ ขอเบิกเงินสำรอง"
  4. `QC` (value="qc") - Quality Control checklist with mandatory items, pass indicators, and button to open `QcInspectionForm`
  5. `ส่งออก STK` (value="stk") - STK Export & Finance view with STK Ref, export status, financial totals, and "+ ส่งออก STK" action
- **Backwards Compatibility**: Added mapping for legacy query params (`log` -> `petty_cash`, `history` -> `qc`, `finance` -> `stk`, `blueprint` -> `task`).
- **Pure Black Font Standard**: Ensured all headers, labels, metrics, and table values render in `#000000`.

### 1.3 `web/src/components/ui/date-picker.tsx`
- Enhanced `handleInputChange` to call `onChange?.('')` when the input is cleared by the user, enabling keyboard backspace clearing of dates.

### 1.4 `web/src/features/jobs/__tests__/orders-and-tabs.test.tsx`
- Created automated test suite covering:
  - Tab order in `JobDetailTabs` (`[งาน/Task]` -> `[BOQ]` -> `[เงินสำรอง]` -> `[QC]` -> `[ส่งออก STK]`)
  - Detail tab switching to Petty Cash, QC, and STK Export views
  - Master table display of Ref ID and Booking No columns
  - Default sorting by `created_at` descending
  - Multi-field search across Customer Name, Phone Number, Booking Number, Ref ID
  - Appointment date rendering with 24-hour time badge (and verifying absence of AM/PM)
  - Date range filtering with `DD/MM/YYYY` inputs

---

## 2. Verification Record

- **Deep Verification (ran actual tests):**
  - Ran `npm test` in `web/`: All 7 test suites (57 tests) passed cleanly, including all 12 tests in `orders-and-tabs.test.tsx`.
  - Ran `npm run build` in root: `scripts/check-syntax.js` verified all frontend JS files, `tsc -b && vite build` built `web/` without errors or warnings, and root `tsc` completed with exit code 0.
- **Shallow Verification (manual run only):**
  - Inspected generated markup, column widths, and CSS classes to ensure high contrast `#000000` text on light backgrounds.
- **Unverified aspects:**
  - Live deployment to `https://vibepmt.online` was not triggered (requires human git push as per protocol).
  - End-to-end browser interaction with actual PostgreSQL database records was tested via API query mocks in Vitest, not against live production DB.

---

## 3. Known Issues
- `Minor Robustness Risk` — If a job record lacks both `created_at` and `plan_date`, date range filtering will exclude it unless the filter is cleared.
- `Minor Robustness Risk` — If a job has a free-text time string that does not match standard 24-hr time patterns (e.g. "ช่วงบ่าย"), it falls back to the default `09:00 น.` badge.

---

## 4. Untested Edge Cases & Next Step
- Reviewers should verify behavior when filtering with empty strings or partial dates.
- Reviewers should verify responsiveness on smaller screens when detail panel is expanded.
