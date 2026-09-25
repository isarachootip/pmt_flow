## 2026-09-25T15:55:26Z

You are the independent post-victory auditor for this software engineering task.
Your working directory is: c:\atgv\pmt_flow\.agents\teamwork\auditor_victory_1

<original_task>
## 2026-09-25T15:03:23Z

This is a single self-contained fix; keep it small and focused.

Enhance the PMT Flow V2 "รับงาน & คิวงาน" (Orders & Queue Management at `/orders`) to support multi-field search (Customer Name, Phone, Booking Number, Ref ID), creation date sorting and date range filter (DD/MM/YYYY), appointment date with 24-hour time badge (strictly NO AM/PM), and align the detail tabs to the core workflow pipeline: [งาน/Task] -> [BOQ] -> [เงินสำรอง] -> [QC] -> [ส่งออก STK].

Working directory: c:/atgv/pmt_flow
Integrity mode: development

## Requirements

### R1. Multi-Field Search & Reference ID / Booking No Display
- Implement search filtering across Customer Name, Phone Number, Booking Number (`booking_no`), and External Reference ID (`ref_id`).
- Display `ref_id` / `booking_no` clearly in the master list table (e.g. as subtitle under job/customer or dedicated badge/column).

### R2. Creation Date Sorting & Date Range Filter
- Default table sorting to system entry date (`created_at`) descending (latest records first).
- Add date range filter (From Date - To Date) adhering to strict `DD/MM/YYYY` format and Light Theme.

### R3. Appointment Date & 24-Hour Time Format Badge
- In the "วันนัด" (Appointment Date) column, display date in `DD/MM/YYYY` format accompanied by a 24-hour time badge (e.g. `09:00 น.` or `13:30 น.`, strictly NO AM/PM).

### R4. Detail Panel Workflow Tab Alignment
- Realign and update the detail panel tabs in `JobDetailTabs` (`web/src/features/jobs/job-detail-tabs.tsx` and related subcomponents) to reflect the operational pipeline:
  1. `งาน/Task` (Job overview & tasks)
  2. `BOQ` (Bill of Quantities & Pricing)
  3. `เงินสำรอง` (Petty Cash / Advance Expense)
  4. `QC` (Quality Control / Inspection Checklist)
  5. `ส่งออก STK` (STK Export & Finance)

### R5. Project Rules & UI Compliance
- Strictly Light Theme with 100% Pure Black text (`#000000`).
- No browser-native date/time inputs (use Flatpickr / 24-hour selector).
- Ensure `npm run build` succeeds without syntax or lint errors.

## Acceptance Criteria

### Functional & UI Criteria
- [ ] Searching by Customer Name, Phone Number, Booking Number, or Ref ID filters the list accurately.
- [ ] Master table displays Ref ID and Booking No visibly.
- [ ] Table sort defaults to latest `created_at`, with working date range filtering.
- [ ] Appointment date renders as `DD/MM/YYYY` with a 24-hour time badge (no AM/PM).
- [ ] Detail tabs contain `งาน/Task`, `BOQ`, `เงินสำรอง`, `QC`, and `ส่งออก STK` in order.
- [ ] Light Theme and Pure Black font (#000000) are fully preserved.
- [ ] `npm run build` passes cleanly.
</original_task>

Conduct an independent 3-phase audit:
Phase 1: Timeline & Git Change Audit (examine git diff against origin/main or recent commits).
Phase 2: Cheating Detection (verify tests were not rewritten to produce trivial false passes or skip real assertions, verify pure black font #000000 compliance, verify 24-hour format compliance with no AM/PM).
Phase 3: Independent Test Execution (run `npm test` in `web/`, `npm test` in root, and `npm run build` in root).

Deliver your structured audit verdict (PASS / FAIL) and full report to `c:\atgv\pmt_flow\.agents\teamwork\auditor_victory_1\handoff.md`, and send a message back to the orchestrator with your verdict.
