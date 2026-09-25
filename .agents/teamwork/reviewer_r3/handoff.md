# Reviewer Round 3 Handoff: PMT Flow V2 "รับงาน & คิวงาน" (/orders) Enhancements

## Summary
Adversarial review round 3 thoroughly audited all requirements R1-R5, fixed the failing Vitest test in `orders-and-tabs.test.tsx`, identified and resolved two TypeScript compilation errors (TS6133), fixed a root API integration failure (`TC-DLOG-11`), broadened multi-field search and routing resiliency, and verified 100% test and build pass rates.

---

## 1. What the Prior Attempt Got Wrong

### Issue 1: Asynchronous Query Blocked Synchronous Header Rendering in `BoqTab`
- **Input**: `<JobDetailTabs job={sampleJob} defaultTab="BOQ" />`
- **Expected**: Header `<h3>รายการประเมินราคา</h3>` renders immediately in document.
- **Actual**: `TestingLibraryElementError: Unable to find an element with the text: รายการประเมินราคา`
- **Root Cause**: `BoqTab` executed an asynchronous `useQuery` without `initialData` and unconditionally returned `if (isLoading) return <div className="p-4 text-sm">กำลังโหลด...</div>;`, unmounting the entire component tree (including header title and action button) on the initial render tick.

### Issue 2: TypeScript Unused Identifiers (TS6133) in Web Frontend
- **Input**: `npm run build` (`tsc -b && vite build`)
- **Expected**: Zero TypeScript errors.
- **Actual**:
  - `src/features/boq/boq-tab.tsx(29,26): error TS6133: 'isLoading' is declared but its value is never read.`
  - `src/lib/date.ts(1,18): error TS6133: 'parse' is declared but its value is never read.`
- **Root Cause**: Destructured `isLoading` in `boq-tab.tsx` was unused after moving loading indicators inside the table, and `parse` from `date-fns` was left behind in `date.ts` after migrating to custom regex parsers.

### Issue 3: Missing `POST /api/v1/jobs/:id/export-stk` in `server.ts`
- **Input**: `npm test` at root (`node test_daily_work_log_and_qc_pipeline.js`)
- **Expected**: TC-DLOG-11 passes (100% 21/21 tests pass).
- **Actual**: `💥 [TC-DLOG-11] FAIL REASON: Must declare POST /api/v1/jobs/:id/export-stk`
- **Root Cause**: `server.ts` did not declare the `POST /api/v1/jobs/:id/export-stk` route with the `ALREADY_QC_PASSED` gating rule, even though the frontend `JobDetailTabs` Tab 5 (`useExportSTK`), `openapi.yaml`, and system test suites expected it.

### Issue 4: Fragile Browser-Global History Access in `OrdersPage`
- **Input**: Row selection and close interactions in `OrdersPage`.
- **Expected**: Consistent query param preservation via React Router.
- **Actual**: Used raw `typeof window !== 'undefined' ? window.location.search : ''` which can drift or fail during client-side memory navigations.
- **Root Cause**: Not utilizing `useLocation()` hook provided by React Router.

---

## 2. What I Changed

1. **`web/src/features/boq/boq-tab.tsx`**:
   - Added `initialData: { items: job.boq_items || [], discount: 0 }` to `useQuery`.
   - Replaced anti-pattern `useMemo` with `useEffect` for syncing `boqData` into local state.
   - Fixed endpoint path to `/api/v1/jobs/${job.id}/boq`.
   - Removed unused `isLoading` destructured property to satisfy TS6133.
   - Kept header "รายการประเมินราคา" permanently mounted.

2. **`web/src/lib/date.ts`**:
   - Removed unused `parse` import from `date-fns` to fix TS6133.

3. **`server.ts`**:
   - Implemented `POST ['/api/v1/jobs/:id/export-stk', '/api/v1/jobs/:id/stk-export']` handler.
   - Added `ALREADY_QC_PASSED` conflict gating rule (HTTP 409) for duplicate export attempts.
   - Added STK sync dispatching via `dispatchStkSync`, dual timestamp recording (`qc_passed_at` & `stk_exported_at`), and persistence to PostgreSQL via `dbUpdateJob`.

4. **`web/src/pages/orders.tsx`**:
   - Integrated `useLocation()` hook from `react-router-dom` for reliable query parameter preservation on row click and detail panel close.
   - Expanded multi-field search to cover `services` and `project_type` in addition to customer name, phone, booking number, reference ID, job number, and technician.

5. **`web/src/features/jobs/__tests__/orders-and-tabs.test.tsx`**:
   - Added test for case-insensitive tab aliases: `pettycash`, `advance`, `pricing`, `inspection`, `export`.
   - Added test for searching by service name (`ติดตั้งเครื่องทำน้ำอุ่น`).
   - Added test for searching by project type (`Renovate`).
   - Added test for one-sided date range filtering (`startDate` only).

---

## 3. Verification Record

- **Deep Verification (ran actual tests):**
  - `npm test` in `web/`: **85 passed (85 tests, 7 test files, 100% pass)**
    - `src/lib/__tests__/rbac.test.ts` (5 tests)
    - `src/types/job.test.ts` (3 tests)
    - `src/lib/date.test.ts` (30 tests)
    - `src/components/ui/__tests__/status-badge.test.tsx` (9 tests)
    - `src/components/ui/__tests__/time-picker-24.test.tsx` (4 tests)
    - `src/components/ui/__tests__/date-picker.test.tsx` (4 tests)
    - `src/features/jobs/__tests__/orders-and-tabs.test.tsx` (30 tests)
  - `npm test` in root `c:\atgv\pmt_flow`: **21/21 passed (100% pass)**
    - `test_boq_import_scenario.js` passed
    - `test_daily_work_log_and_qc_pipeline.js` passed (21/21, TC-DLOG-01 through TC-DLOG-11, TC-QC-01 through TC-QC-04, TC-STK-01 through TC-STK-06)
  - `npm run build` in root `c:\atgv\pmt_flow`: **Passed with exit code 0**
    - `node scripts/check-syntax.js`: All 5 frontend files validated
    - `npm --prefix web run build`: `tsc -b && vite build` bundled cleanly (3,478 modules transformed)
    - Root `tsc`: passed cleanly without type errors

- **Shallow Verification (manual only):**
  - Inspected DOM tree styling: verified 100% Light Theme compliance and Pure Black font (`text-black`, `#000000`) across all inputs, table headers, cells, and modals.
  - Inspected 24-hour time badge rendering: strictly NO AM/PM across all appointment displays.

- **Unverified aspects:**
  - Live deployment to `https://vibepmt.online` was not triggered (requires human or agent commit/push to `main` per GEMINI.md protocol).
  - Production database deployment was not run (per GEMINI.md protocol: dev-only deployments by agents, human releases production).

---

## 4. Known Issues
- `Shallow Verification`: Full end-to-end browser interaction with actual PostgreSQL database records was tested via API query mocks in Vitest and script simulation, not against live running dev container.
- `Minor Robustness Risk`: If a job record lacks both `created_at` and `plan_date`, date range filtering will exclude it unless the filter is cleared (intended filter behavior).

---

## 5. Remaining Risk & Next Step
- The task requirements R1-R5 are 100% satisfied and all tests and builds pass with zero errors.
- Next step: Stage and commit the reviewed changes to `main` for Dev deployment if requested.
