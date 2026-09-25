# Reviewer Handoff: PMT Flow V2 "รับงาน & คิวงาน" (/orders) Enhancements

## Summary
Completed adversarial review and remediation of PMT Flow V2 "รับงาน & คิวงาน" (Orders & Queue Management at `/orders`). Identified and fixed 9 defects and robustness risks across search matching, appointment date fallbacks, timezone stability, table sorting, URL query preservation, button functionality, and UI font standards. Verified with full test suite (69 tests passing) and root `npm run build`.

---

## 1. What the Prior Attempt Got Wrong

### Issue 1: Unscheduled jobs displayed fake appointment date and fake "09:00 น." time badge
- **Input**: A job record with `plan_date: null` and `plan_time: null` (e.g. `JOB-2026-004`).
- **Expected**: In the "วันนัด" (Appointment Date) column, display `-` to indicate no appointment has been scheduled.
- **Actual**: Displayed the job's `created_at` date formatted as DD/MM/YYYY accompanied by a fake `09:00 น.` time badge.
- **Root Cause**: In `orders.tsx`, `rawDate` fell back to `(row as any).created_at`, and `displayTime` fell back to `'09:00 น.'` whenever `timeStr` was empty, treating record creation timestamp as an appointment.

### Issue 2: Date-only ISO strings shifted by -1 day in western / negative UTC timezones
- **Input**: `toDateTime('2026-09-24')` or DatePicker initialized with `value="2026-09-24"`.
- **Expected**: Date represents 24 September 2026 regardless of the user's or runner's local timezone.
- **Actual**: In timezones west of UTC (e.g. UTC-4, UTC-5), `new Date('2026-09-24')` is parsed as UTC midnight (`2026-09-24T00:00:00Z`), which shifts to 23 September (19:00 or 20:00 local time), causing `formatDMY` to display `23/09/2026`.
- **Root Cause**: `toDateTime` in `web/src/lib/date.ts` lacked a regex branch for date-only ISO strings (`YYYY-MM-DD`) and passed them directly to `new Date()`.

### Issue 3: Inflexible phone search & missing multi-token matching
- **Input**: Customer phone stored with hyphens (e.g. `082-345-6789`) searched with digits only (`0823456789`), or multi-token search queries like `"วิภาดา 089"`.
- **Expected**: Customer matches search results smoothly.
- **Actual**: `custPhone.includes(q)` failed because the stored string had hyphens while the search query didn't (or vice versa), and multi-word queries failed because no single field contained both terms.
- **Root Cause**: Search in `orders.tsx` did not strip non-numeric formatting characters from phone numbers and did not tokenize multi-word search queries.

### Issue 4: Inconsistency between Ref ID search and table display
- **Input**: Job with external reference stored under `stk_ref` (e.g. `STK-99004`).
- **Expected**: Ref ID column displays `STK-99004`.
- **Actual**: Ref ID column displayed `-`, even though searching for `STK-99004` matched the job.
- **Root Cause**: Search checked `job.stk_ref`, but the DataGrid column definition for `ref_id` only checked `external_ref_id` and `ref_id`.

### Issue 5: Non-numeric job IDs caused `NaN` in table sort
- **Input**: Jobs with non-numeric or string IDs (e.g. `JOB-2026-001`) with identical `created_at` timestamps.
- **Expected**: Deterministic secondary sort by ID / job number.
- **Actual**: `Number(b.id) - Number(a.id)` evaluated to `NaN - NaN = NaN`, corrupting array sort order in JavaScript.
- **Root Cause**: Direct `Number(row.id)` conversion on string-based IDs without regex extraction or fallback.

### Issue 6: Tab switching wiped out other URL search parameters
- **Input**: User on `/orders` with active query parameters (e.g. `?search=xyz`) switches detail tabs.
- **Expected**: Tab parameter updates while retaining other query parameters.
- **Actual**: `setSearchParams({ tab: value })` erased all other parameters.
- **Root Cause**: Called `setSearchParams` with a single-property object instead of updating the existing `URLSearchParams`.

### Issue 7: Inactive toolbar buttons ("+ สร้างงาน" and "ส่งออก")
- **Input**: User clicks "+ สร้างงาน" or "ส่งออก".
- **Expected**: "+ สร้างงาน" opens `CreateJobDrawer`; "ส่งออก" exports filtered records to CSV.
- **Actual**: Dead buttons with no click handlers.
- **Root Cause**: Buttons were UI placeholders without handlers.

### Issue 8: Washed-out gray text in DateRangePicker & DatePicker violating Pure Black Font rule
- **Input**: Date range separator ("ถึง") and DatePicker preset buttons / icon.
- **Expected**: Pure Black text (`#000000`) per GEMINI.md standard.
- **Actual**: Used `text-[var(--text-secondary)]` (`#4E5969`).
- **Root Cause**: Missing explicit `text-black` overrides.

### Issue 9: Thai presets ("ช่วงบ่าย") and 12-hour AM/PM badge formatting risks
- **Input**: Free-text time strings like `'ช่วงบ่าย'` or 12-hour formats like `'01:30 PM'`.
- **Expected**: Normalized to standard 24-hour time badges (`13:00 น.`, `13:30 น.`, strictly NO AM/PM).
- **Actual**: Free text like `'ช่วงบ่าย'` was appended with `' น.'` to produce `'ช่วงบ่าย น.'`.
- **Root Cause**: Lack of dedicated 24-hour time badge normalization utility.

---

## 2. What Was Changed

1. **`web/src/lib/date.ts`**:
   - Enhanced `toDateTime` to safely parse date-only ISO strings (`YYYY-MM-DD`) at local midnight, preventing timezone offset rollback in negative UTC zones.
   - Added `format24HourTimeBadge(timeInput, dateInput, defaultFallback)` utility to strictly normalize 12-hour AM/PM, Thai presets (`ช่วงเช้า` -> `09:00 น.`, `ช่วงบ่าย` -> `13:00 น.`, `ช่วงเย็น` -> `17:00 น.`), 24-hour ranges (`09:00 - 12:00 น.`), and standard 24-hr times with `น.` suffix.
2. **`web/src/pages/orders.tsx`**:
   - Enhanced multi-field search to support tokenized queries (matching across name, phone, booking, ref ID, job no) and stripped phone formatting for robust hyphenated/unhyphenated phone matching.
   - Fixed `plan_date` column to strictly display `-` when an appointment is unscheduled, avoiding fake dates or fake `09:00 น.` badges.
   - Fixed `ref_id` column to support `stk_ref` fallback consistent with search.
   - Fixed sorting to safely parse `created_at` timestamps with `toDateTime` and handle secondary sort on ID without `NaN`.
   - Wired up "+ สร้างงาน" to open `CreateJobDrawer` and "ส่งออก" to download filtered rows as UTF-8 CSV (with BOM).
3. **`web/src/features/jobs/job-detail-tabs.tsx`**:
   - Updated `handleTabChange` to preserve existing URL search parameters using functional `setSearchParams`.
   - Made `taskList` DataGrid source resilient to raw array responses and preloaded `job.tasks`.
   - Formatted Petty Cash IDs cleanly (`PC-001`, `PC-002`, ...).
4. **`web/src/components/ui/date-picker.tsx` & `date-range-picker.tsx`**:
   - Updated DatePicker to initialize and sync state using `toDateTime(value)` rather than `new Date(value)`.
   - Applied 100% Pure Black text (`#000000`) to the "ถึง" separator, calendar trigger icon, and quick preset buttons.
5. **`web/src/features/jobs/__tests__/orders-and-tabs.test.tsx` & `web/src/lib/date.test.ts`**:
   - Expanded automated test coverage from 57 to 69 tests covering multi-token search, phone hyphen handling, fallback ref IDs, 12-hr AM/PM normalization, Thai presets, null appointment dates, petty cash budget updates, and CSV export.

---

## 3. Verification Record

- **Deep Verification (ran actual tests):**
  - Ran `npm test` in `web/`: All 7 test suites (69 tests) passed cleanly (0 failures, 0 unhandled errors).
  - Ran `npm run build` in root: `scripts/check-syntax.js` validated all frontend JavaScript files, `tsc -b && vite build` bundled `web/` without errors or warnings, and root `tsc` completed with exit code 0.
- **Shallow Verification (manual inspection):**
  - Inspected DOM markup and styles for `#000000` text across all tables, headers, badges, and modals.
  - Verified Thai 24-hour time formatting across multiple scenarios.
- **Unverified aspects:**
  - Production database deployment was not run (per GEMINI.md protocol: dev-only deployments by agents, human releases production).

---

## 4. Known Issues
- `Minor Robustness Risk` — If a job has neither `created_at` nor `plan_date`, date range filtering will exclude it until filters are reset. (Expected filter behavior).

---

## 5. Next Steps
Task requirements R1 through R5 are 100% satisfied, fully tested, and cleanly built. Ready for deployment to dev server.
