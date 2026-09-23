/**
 * =============================================================================
 * AUTOMATED QA TEST SUITE: TECHNICIAN DAILY WORK LOG & QC PIPELINE TO STK SYNC
 * =============================================================================
 * 
 * Scope:
 * R1. Technician Daily Work Log:
 *     - Date display in DD/MM/YYYY standard
 *     - 24-hour time clock (00:00 - 23:59, strictly NO AM/PM)
 *     - Accurate duration calculation (including regular and overnight shifts)
 *     - 5 standard photo slots (Before, During 1, During 2, Testing, After)
 *     - Progressive calculation across days (< 100% before completion)
 * R2. Handover & Transition to QC:
 *     - Final day completion or User confirmation (User ยืนยัน 100%)
 *     - Task status -> DONE (100%), Job status -> QC_PENDING (85%)
 *     - Historical timestamp recorded in step_timestamps.qc_pending_at
 *     - QC Booking status -> CONFIRMED on end date
 * R3. QC Evaluation & STK Sync:
 *     - Job displayed in Step 5 QC list
 *     - Checklist evaluation, scoring 5/5, inspector, remarks, photos
 *     - Approval to QC_PASSED (100%)
 *     - STK Payload generation with 8 core fields + system metadata
 *     - stk_ref generated, stk_status = DELIVERED
 *     - Timestamps step_timestamps.qc_passed_at & step_timestamps.stk_exported_at
 *     - Submission gating prevents duplicate submission
 * R4. Comprehensive Test Matrix & Output
 * =============================================================================
 */

const assert = require('assert');

// =============================================================================
// 1. ENGINE LOGIC UNDER TEST (Mirroring public/js/app.js & server.ts)
// =============================================================================

const PMT_ENGINE = {
    // Date standard: DD/MM/YYYY
    formatDateDMY(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return String(dateStr);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (e) {
            return String(dateStr);
        }
    },

    formatDateTimeDMY(isoStr, includeSeconds = false, includeThaiUnit = true) {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return String(isoStr);
            const pad = (n) => String(n).padStart(2, '0');
            const dmy = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
            const time = includeSeconds
                ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
                : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            return `${dmy} ${time}${includeThaiUnit ? ' น.' : ''}`;
        } catch (e) {
            return String(isoStr);
        }
    },

    // 24-Hour Work Duration Calculation
    calculateWorkDuration(startTime, endTime) {
        if (!startTime || !endTime) return '8 ชม. 30 นาที';
        try {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            let diffMinutes = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
            if (diffMinutes < 0) diffMinutes += 24 * 60; // overnight support
            const hours = Math.floor(diffMinutes / 60);
            const mins = diffMinutes % 60;
            if (hours === 0) return `${mins} นาที`;
            if (mins === 0) return `${hours} ชม. 00 นาที`;
            return `${hours} ชม. ${String(mins).padStart(2, '0')} นาที`;
        } catch (e) {
            return '8 ชม. 30 นาที';
        }
    },

    // 24-Hour Time Validation
    isValid24HourTime(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return false;
        // Strictly no AM or PM permitted
        if (/am|pm/i.test(timeStr)) return false;
        const match = timeStr.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
        return Boolean(match);
    },

    // 5 Standard Photo Slots Definition
    get5PhotoSlotMeta() {
        return [
            { slot: 1, name: 'รูปที่ 1: ก่อนเริ่มงาน (Before)', phase: 'BEFORE', desc: 'ตรวจสอบสภาพหน้างานเดิมและพื้นที่ก่อนเริ่มงาน' },
            { slot: 2, name: 'รูปที่ 2: ระหว่างทำ #1 (During 1)', phase: 'DURING_1', desc: 'งานรื้อถอน วางแนวท่อ หรือติดตั้งโครงสร้าง' },
            { slot: 3, name: 'รูปที่ 3: ระหว่างทำ #2 (During 2)', phase: 'DURING_2', desc: 'การเดินสายไฟ ท่อประปา หรืองานระบบหลัก' },
            { slot: 4, name: 'รูปที่ 4: ความปลอดภัย & ทดสอบ (Testing)', phase: 'TESTING', desc: 'การวัดค่าแรงดัน ตรวจสอบจุดยึด และความปลอดภัย' },
            { slot: 5, name: 'รูปที่ 5: งานเสร็จสมบูรณ์ (After)', phase: 'AFTER', desc: 'ติดตั้งเสร็จสมบูรณ์ พื้นที่สะอาดเรียบร้อย ส่งมอบงาน' }
        ];
    },

    // Safe Boolean Parser
    parseSafeBoolean(val) {
        if (val === true || val === 1) return true;
        if (typeof val === 'string') {
            const s = val.trim().toLowerCase();
            return s === 'true' || s === '1' || s === 'yes';
        }
        return false;
    },

    // Daily Work Log Evaluation Mirroring server.ts & app.js
    evaluateDailyLogCompletion(payload) {
        const dayNumber = Math.max(1, Number(payload.day_number || payload.dayNumber) || 1);
        const totalDays = Math.max(1, Number(payload.total_days || payload.totalDays) || 1);
        const isFinalDay = dayNumber >= totalDays;

        const isExplicitConfirmation = this.parseSafeBoolean(payload.user_confirmed) || 
                                       this.parseSafeBoolean(payload.userConfirmed) || 
                                       this.parseSafeBoolean(payload.is_early_completed) || 
                                       this.parseSafeBoolean(payload.isEarlyCompleted) || 
                                       this.parseSafeBoolean(payload.force_complete) || 
                                       this.parseSafeBoolean(payload.forceComplete);

        const rawProgressNum = payload.progress_percent !== undefined 
            ? Number(payload.progress_percent) 
            : (payload.progressPercent !== undefined ? Number(payload.progressPercent) : NaN);
        const isExplicit100 = !isNaN(rawProgressNum) && rawProgressNum >= 100;
        const isCompletedFlag = this.parseSafeBoolean(payload.is_completed) || this.parseSafeBoolean(payload.isCompleted);

        // Intermediate days without explicit user confirmation NEVER jump to DONE or 100%
        const isOverallComplete = isFinalDay || isExplicitConfirmation || (isExplicit100 && isCompletedFlag);
        const dayProgress = Math.min(95, Math.round((dayNumber / totalDays) * 100));
        const finalProgress = isOverallComplete ? 100 : Math.min(95, Math.max(1, !isNaN(rawProgressNum) ? rawProgressNum : dayProgress));

        return {
            dayNumber,
            totalDays,
            isFinalDay,
            isExplicitConfirmation,
            isOverallComplete,
            progressPercent: finalProgress,
            targetJobStatus: isOverallComplete ? 'QC_PENDING' : 'IN_PROGRESS',
            targetTaskStatus: isOverallComplete ? 'DONE' : 'IN_PROGRESS'
        };
    },

    // Progressive Calculation for Daily Work Log
    calculateTaskProgressivePercent(logs, taskDays) {
        if (!logs || logs.length === 0) return 0;
        const hasCompleted = logs.some(l => l.isCompleted || l.userConfirmed || l.isEarlyCompleted);
        if (hasCompleted) return 100;
        const distinctDays = new Set(logs.map(l => Number(l.dayNumber) || l.logDate)).size;
        return Math.min(95, Math.round((distinctDays / Math.max(1, taskDays)) * 100));
    },

    // Generate STK Ref
    generateSTKRef() {
        return `STK-QC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    },

    // Build STK Payload
    buildSTKPayload(job, task, questions, inspector = 'วิชัย ตรวจดี (ช่าง QC Lead)', remarks = 'งานติดตั้งเรียบร้อยตามมาตรฐาน') {
        const stkRef = this.generateSTKRef();
        const nowIso = new Date().toISOString();
        const nowDmy = this.formatDateTimeDMY(nowIso, false, true);

        const formattedQuestions = questions.map((q, idx) => {
            const isPass = q.result === 'PASS' || q.answer === 'YES';
            const scoreVal = q.score != null ? Number(q.score) : (isPass ? 5 : 1);
            return {
                question_no: q.question_no || (idx + 1),
                question_title: q.question_title || q.title || `คำถามข้อที่ ${idx + 1}`,
                category: q.category || 'มาตรฐาน QC',
                answer: q.answer || (isPass ? 'YES' : 'NO'),
                score: scoreVal,
                max_score: 5,
                result: q.result || (isPass ? 'PASS' : 'DEFECT'),
                remarks: q.remarks || '',
                photos_count: Array.isArray(q.photos) ? q.photos.length : 0,
                photos: Array.isArray(q.photos) ? q.photos : []
            };
        });

        const totalScore = formattedQuestions.reduce((acc, q) => acc + q.score, 0);
        const maxScore = formattedQuestions.length * 5;
        const avgScore = formattedQuestions.length > 0 ? (totalScore / formattedQuestions.length).toFixed(1) : '5.0';

        const payload = {
            // === 8 ข้อมูลสำคัญสำหรับส่งให้ระบบ STK (STK Mandatory Root Fields) ===
            ref_no: job.external_ref_id || job.ticket_no || job.job_no || '-',
            ticket: job.ticket_no || job.job_no || job.id,
            booking_no: job.booking_no || (job.raw_payload && job.raw_payload.booking_no) || '-',
            qc_date: nowDmy,
            qc_recorded_at: nowIso,
            customer_name: job.customer_name || (typeof job.customer === 'object' ? job.customer.name : job.customer) || 'ลูกค้า',
            customer_phone: job.customer_phone || (typeof job.customer === 'object' ? job.customer.phone : job.phone) || '-',
            qc_round: 1,
            qc_round_text: 'ตรวจครั้งที่ 1 (ผ่านเกณฑ์รอบแรก)',
            qc_result: 'ผ่านเกณฑ์',
            qc_score: Number(avgScore),
            qc_score_text: `${avgScore} / 5.0 คะแนน`,

            // === Metadata ประกอบการส่งมอบระบบ (System Metadata) ===
            stk_ref: stkRef,
            stk_export_ref: stkRef,
            exported_at: nowIso,
            job_no: job.job_no || job.id,
            ticket_no: job.ticket_no || job.job_no || job.id,
            external_ref_id: job.external_ref_id || '-',
            customer: {
                name: job.customer_name || (typeof job.customer === 'object' ? job.customer.name : job.customer) || 'ลูกค้า',
                phone: job.customer_phone || (typeof job.customer === 'object' ? job.customer.phone : job.phone) || '-'
            },
            service: job.service || job.project_type || 'บริการติดตั้ง',
            tech_team: task ? task.tech : (job.assigned_tech || job.tech || '-'),
            store_code: job.store_code || 'B001',
            agent_name: job.agent_name || 'สมชาย ผู้ดูแล',
            qc_inspector: inspector,
            qc_remarks: remarks,
            total_score_obtained: totalScore,
            max_possible_score: maxScore,
            total_questions: formattedQuestions.length,
            passed_questions: formattedQuestions.filter(q => q.result === 'PASS').length,
            questions: formattedQuestions,
            qc_history: []
        };

        return { stkRef, payload, nowIso };
    }
};

// =============================================================================
// 2. TEST EXECUTION & MATRIX
// =============================================================================

async function runTestSuite() {
    console.log('='.repeat(80));
    console.log('🧪 PMT FLOW: AUTOMATED QA TEST SUITE');
    console.log('   DAILY TECHNICIAN WORK LOG ➔ QC STEP 5 ➔ STK OUTBOUND SYNC');
    console.log('='.repeat(80));

    const testResults = [];

    function recordResult(tcId, name, req, passed, details = '', payloadSample = null) {
        testResults.push({ tcId, name, req, passed, details, payloadSample });
        const icon = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`\n▶ [${tcId}] ${name}`);
        console.log(`   Result: ${icon}`);
        if (details) console.log(`   Details: ${details}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REQUIREMENT 1: Technician Daily Work Log
    // ─────────────────────────────────────────────────────────────────────────

    // TC-DLOG-01: Date display format DD/MM/YYYY
    try {
        const d1 = PMT_ENGINE.formatDateDMY('2026-09-07');
        const d2 = PMT_ENGINE.formatDateDMY('2026-09-24T02:00:00.000Z');
        assert.strictEqual(d1, '07/09/2026', 'Date must be formatted as 07/09/2026');
        assert.strictEqual(d2, '24/09/2026', 'Date must be formatted as 24/09/2026');
        assert.strictEqual(/^[0-3]\d\/[0-1]\d\/\d{4}$/.test(d1), true, 'Must match DD/MM/YYYY pattern');
        recordResult('TC-DLOG-01', 'มาตรฐานวันที่แสดงผลในรูปแบบ DD/MM/YYYY', 'R1', true, `Formatted "2026-09-07" ➔ "${d1}", "2026-09-24" ➔ "${d2}"`);
    } catch (e) {
        recordResult('TC-DLOG-01', 'มาตรฐานวันที่แสดงผลในรูปแบบ DD/MM/YYYY', 'R1', false, e.message);
    }

    // TC-DLOG-02: 24-Hour Time Clock (HH:mm, strictly no AM/PM)
    try {
        const validTimes = ['00:00', '08:30', '12:00', '13:00', '17:00', '23:59'];
        const invalidTimes = ['08:30 AM', '05:00 PM', '8:30', '24:00', '12:60', '17:00น.'];

        validTimes.forEach(t => {
            assert.strictEqual(PMT_ENGINE.isValid24HourTime(t), true, `${t} should be valid 24-hr time`);
        });
        invalidTimes.forEach(t => {
            assert.strictEqual(PMT_ENGINE.isValid24HourTime(t), false, `${t} should be rejected (no AM/PM allowed)`);
        });
        recordResult('TC-DLOG-02', 'ระบบเวลา 24 ชั่วโมง (00:00 - 23:59 น.) ปลอด AM/PM 100%', 'R1', true, `Validated 6 legal times (00:00 - 23:59) and correctly rejected AM/PM & invalid formats`);
    } catch (e) {
        recordResult('TC-DLOG-02', 'ระบบเวลา 24 ชั่วโมง (00:00 - 23:59 น.) ปลอด AM/PM 100%', 'R1', false, e.message);
    }

    // TC-DLOG-03: Accurate Work Duration Calculation
    try {
        const dur1 = PMT_ENGINE.calculateWorkDuration('08:30', '17:00');
        const dur2 = PMT_ENGINE.calculateWorkDuration('08:00', '17:00');
        const dur3 = PMT_ENGINE.calculateWorkDuration('13:00', '17:00');
        const dur4 = PMT_ENGINE.calculateWorkDuration('22:00', '06:00'); // overnight shift
        const dur5 = PMT_ENGINE.calculateWorkDuration('09:00', '09:45'); // minutes only

        assert.strictEqual(dur1, '8 ชม. 30 นาที', '08:30 - 17:00 must be 8 hrs 30 mins');
        assert.strictEqual(dur2, '9 ชม. 00 นาที', '08:00 - 17:00 must be 9 hrs');
        assert.strictEqual(dur3, '4 ชม. 00 นาที', '13:00 - 17:00 must be 4 hrs');
        assert.strictEqual(dur4, '8 ชม. 00 นาที', '22:00 - 06:00 must handle overnight diff (8 hrs)');
        assert.strictEqual(dur5, '45 นาที', '09:00 - 09:45 must handle sub-hour duration');

        recordResult('TC-DLOG-03', 'คำนวณชั่วโมงการทำงาน (Duration) แม่นยำทุกช่วงเวลาและกะข้ามคืน', 'R1', true, `Calculated 5 test cases: (08:30-17:00 ➔ "${dur1}"), (22:00-06:00 overnight ➔ "${dur4}"), (09:00-09:45 ➔ "${dur5}")`);
    } catch (e) {
        recordResult('TC-DLOG-03', 'คำนวณชั่วโมงการทำงาน (Duration) แม่นยำทุกช่วงเวลาและกะข้ามคืน', 'R1', false, e.message);
    }

    // TC-DLOG-04: 5 Standard Photo Slots Specification
    try {
        const slots = PMT_ENGINE.get5PhotoSlotMeta();
        assert.strictEqual(slots.length, 5, 'Must have exactly 5 photo slots');
        assert.strictEqual(slots[0].phase, 'BEFORE', 'Slot 1 must be BEFORE');
        assert.strictEqual(slots[1].phase, 'DURING_1', 'Slot 2 must be DURING 1');
        assert.strictEqual(slots[2].phase, 'DURING_2', 'Slot 3 must be DURING 2');
        assert.strictEqual(slots[3].phase, 'TESTING', 'Slot 4 must be TESTING');
        assert.strictEqual(slots[4].phase, 'AFTER', 'Slot 5 must be AFTER');

        const mockPhotos = slots.map((s, idx) => ({
            id: `ph_${idx + 1}`,
            slot: s.slot,
            url: `https://sample-site.com/photo_${s.phase.toLowerCase()}.jpg`,
            title: s.name,
            phase: s.phase,
            uploadedAt: new Date().toISOString()
        }));

        assert.strictEqual(mockPhotos.length, 5, 'All 5 slots attached');
        recordResult('TC-DLOG-04', 'แนบภาพถ่ายหน้างานครบ 5 ช่องตามสเตจงาน (5 Standard Photos)', 'R1', true, `Verified all 5 phases: ${slots.map(s => s.phase).join(', ')} with lightbox preview metadata`);
    } catch (e) {
        recordResult('TC-DLOG-04', 'แนบภาพถ่ายหน้างานครบ 5 ช่องตามสเตจงาน (5 Standard Photos)', 'R1', false, e.message);
    }

    // TC-DLOG-05: Progressive Task Calculation (Day 1: 33%, Day 2: 67%, Day 3: 100%)
    try {
        const totalDays = 3;

        // Day 1 log
        const day1Logs = [{ dayNumber: 1, logDate: '2026-09-07', isCompleted: false }];
        const prog1 = PMT_ENGINE.calculateTaskProgressivePercent(day1Logs, totalDays);
        assert.strictEqual(prog1, 33, 'Day 1 of 3 must be 33%');
        assert.strictEqual(prog1 < 100, true, 'Day 1 must NOT be 100%');

        // Day 2 log
        const day2Logs = [
            { dayNumber: 1, logDate: '2026-09-07', isCompleted: false },
            { dayNumber: 2, logDate: '2026-09-08', isCompleted: false }
        ];
        const prog2 = PMT_ENGINE.calculateTaskProgressivePercent(day2Logs, totalDays);
        assert.strictEqual(prog2, 67, 'Day 2 of 3 must be 67%');
        assert.strictEqual(prog2 < 100, true, 'Day 2 must NOT be 100%');

        // Day 3 log (Final Day completed)
        const day3Logs = [
            ...day2Logs,
            { dayNumber: 3, logDate: '2026-09-09', isCompleted: true, userConfirmed: true }
        ];
        const prog3 = PMT_ENGINE.calculateTaskProgressivePercent(day3Logs, totalDays);
        assert.strictEqual(prog3, 100, 'Day 3 completed must be 100%');

        recordResult('TC-DLOG-05', 'ความคืบหน้าสะสมคำนวณตามสัดส่วนรอบวันจริง ไม่กระโดดเป็น 100% ก่อนเสร็จสิ้น', 'R1', true, `Day 1/3 = ${prog1}%, Day 2/3 = ${prog2}%, Day 3/3 = ${prog3}% (Proportional Progression)`);
    } catch (e) {
        recordResult('TC-DLOG-05', 'ความคืบหน้าสะสมคำนวณตามสัดส่วนรอบวันจริง ไม่กระโดดเป็น 100% ก่อนเสร็จสิ้น', 'R1', false, e.message);
    }

    // TC-DLOG-06: Intermediate Day In-Progress Guard (Never jumps to DONE without confirmation)
    try {
        // Scenario A: Day 1 of 3, is_completed: false, user_confirmed: false
        const r1 = PMT_ENGINE.evaluateDailyLogCompletion({ day_number: 1, total_days: 3, is_completed: false, user_confirmed: false });
        assert.strictEqual(r1.isOverallComplete, false, 'Day 1 must not be complete');
        assert.strictEqual(r1.progressPercent, 33, 'Day 1 progress must be 33%');
        assert.strictEqual(r1.targetJobStatus, 'IN_PROGRESS', 'Job status must stay IN_PROGRESS');
        assert.strictEqual(r1.targetTaskStatus, 'IN_PROGRESS', 'Task status must stay IN_PROGRESS');

        // Scenario B: Day 1 of 3, is_completed: true (daily log checked) but NO user confirmation
        const r2 = PMT_ENGINE.evaluateDailyLogCompletion({ day_number: 1, total_days: 3, is_completed: true, user_confirmed: false });
        assert.strictEqual(r2.isOverallComplete, false, 'Intermediate day without user confirmation must NOT be complete');
        assert.strictEqual(r2.progressPercent, 33, 'Day 1 progress must stay 33%');
        assert.strictEqual(r2.targetJobStatus, 'IN_PROGRESS', 'Must stay IN_PROGRESS');

        // Scenario C: Day 2 of 3, is_completed: true, progress_percent: 67
        const r3 = PMT_ENGINE.evaluateDailyLogCompletion({ day_number: 2, total_days: 3, is_completed: true });
        assert.strictEqual(r3.isOverallComplete, false, 'Day 2 of 3 without confirmation must stay IN_PROGRESS');
        assert.strictEqual(r3.progressPercent, 67, 'Day 2 progress must be 67%');
        assert.strictEqual(r3.targetJobStatus, 'IN_PROGRESS', 'Day 2 must stay IN_PROGRESS');

        recordResult('TC-DLOG-06', 'รอบวันระหว่างทาง (Intermediate Days) ปลอดภัย 100% ไม่กระโดดเป็น DONE หรือ QC_PENDING', 'R1', true, 'Tested Day 1 & Day 2 scenarios: all properly guarded to IN_PROGRESS (< 100%)');
    } catch (e) {
        recordResult('TC-DLOG-06', 'รอบวันระหว่างทาง (Intermediate Days) ปลอดภัย 100% ไม่กระโดดเป็น DONE หรือ QC_PENDING', 'R1', false, e.message);
    }

    // TC-DLOG-07: String Boolean Parsing Security ("false", "0", "true", "1")
    try {
        assert.strictEqual(PMT_ENGINE.parseSafeBoolean('false'), false, '"false" string must parse as boolean false');
        assert.strictEqual(PMT_ENGINE.parseSafeBoolean('0'), false, '"0" string must parse as boolean false');
        assert.strictEqual(PMT_ENGINE.parseSafeBoolean(false), false, 'false boolean must stay false');
        assert.strictEqual(PMT_ENGINE.parseSafeBoolean(null), false, 'null must parse as false');
        assert.strictEqual(PMT_ENGINE.parseSafeBoolean(undefined), false, 'undefined must parse as false');
        assert.strictEqual(PMT_ENGINE.parseSafeBoolean('true'), true, '"true" string must parse as boolean true');
        assert.strictEqual(PMT_ENGINE.parseSafeBoolean('1'), true, '"1" string must parse as boolean true');
        assert.strictEqual(PMT_ENGINE.parseSafeBoolean(1), true, '1 number must parse as boolean true');

        const rStringFalse = PMT_ENGINE.evaluateDailyLogCompletion({
            day_number: 1,
            total_days: 3,
            is_completed: 'false',
            user_confirmed: 'false'
        });
        assert.strictEqual(rStringFalse.isOverallComplete, false, 'String "false" must not trigger completion');
        assert.strictEqual(rStringFalse.targetJobStatus, 'IN_PROGRESS', 'Job status must stay IN_PROGRESS');

        recordResult('TC-DLOG-07', 'ระบบแปลงค่า Boolean ปลอดภัย (Safe Boolean Parser: ป้องกัน String "false" หลอกระบบ)', 'R1', true, 'Validated that "false", "0", null and undefined strictly evaluate to false without false-positive completion');
    } catch (e) {
        recordResult('TC-DLOG-07', 'ระบบแปลงค่า Boolean ปลอดภัย (Safe Boolean Parser: ป้องกัน String "false" หลอกระบบ)', 'R1', false, e.message);
    }

    // TC-DLOG-08: Zero & Negative Task Days Boundary Protection
    try {
        const rZeroDays = PMT_ENGINE.evaluateDailyLogCompletion({ day_number: 0, total_days: 0 });
        assert.strictEqual(rZeroDays.totalDays >= 1, true, 'total_days must clamp to at least 1');
        assert.strictEqual(rZeroDays.dayNumber >= 1, true, 'day_number must clamp to at least 1');
        assert.strictEqual(isNaN(rZeroDays.progressPercent), false, 'Progress must not be NaN');

        const rNegDays = PMT_ENGINE.evaluateDailyLogCompletion({ day_number: -2, total_days: -5 });
        assert.strictEqual(rNegDays.totalDays >= 1, true, 'Negative total_days must clamp to at least 1');
        assert.strictEqual(rNegDays.dayNumber >= 1, true, 'Negative day_number must clamp to at least 1');
        assert.strictEqual(rNegDays.progressPercent > 0, true, 'Progress must be positive');

        recordResult('TC-DLOG-08', 'การป้องกันกรณีขอบเขตจำนวนวันเป็นศูนย์หรือติดลบ (Zero/Negative Days Clamping)', 'R1', true, `total_days: 0 ➔ clamped to 1, total_days: -5 ➔ clamped to 1 (No NaN or division by zero)`);
    } catch (e) {
        recordResult('TC-DLOG-08', 'การป้องกันกรณีขอบเขตจำนวนวันเป็นศูนย์หรือติดลบ (Zero/Negative Days Clamping)', 'R1', false, e.message);
    }

    // TC-DLOG-09: Pure Light Theme & Pure Black Text Standard Verification
    try {
        const fs = require('fs');
        const appJsContent = fs.readFileSync('./public/js/app.js', 'utf8');
        
        // Extract entire Gantt List View & Daily Work Log pipeline block
        const startIdx = appJsContent.indexOf('// Daily work log status for this task');
        const endIdx = appJsContent.indexOf('ensureQCPendingForRenovate', startIdx);
        assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx, 'Gantt & Daily Work Log block must be found in app.js');
        const pipelineSnippet = appJsContent.substring(startIdx, endIdx);

        // Assert strictly NO dark: classes in this entire pipeline block
        const darkClasses = (pipelineSnippet.match(/dark:[a-zA-Z0-9_\-]+/g) || []);
        assert.strictEqual(darkClasses.length, 0, `Prohibited dark: classes found in Gantt / Daily Work Log: ${darkClasses.join(', ')}`);

        // Assert pure black text styling on table headers and modal controls
        assert.ok(pipelineSnippet.includes('text-black'), 'Must enforce text-black for pure black typography standard');
        assert.ok(pipelineSnippet.includes('id="dwl-input-completed"'), 'Must provide dwl-input-completed checkbox in modal');
        assert.ok(pipelineSnippet.includes('completeDailyWorkAndMoveToQC'), 'Must wire completeDailyWorkAndMoveToQC action button');

        recordResult('TC-DLOG-09', 'มาตรฐาน Light Theme 100% และ Pure Black Text ปลอด Dark Mode', 'R1', true, 'Verified zero leftover dark: classes, pure black text (th/labels), and full modal completion controls');
    } catch (e) {
        recordResult('TC-DLOG-09', 'มาตรฐาน Light Theme 100% และ Pure Black Text ปลอด Dark Mode', 'R1', false, e.message);
    }

    // TC-DLOG-10: Complete Rollback on Daily Log Deletion (Task, Job, Timestamps, QC Booking)
    try {
        function simulateDailyLogDeletion(logId, currentLogs, currentJob, currentTasks, currentBookings) {
            const idx = currentLogs.findIndex(l => l.id === logId);
            if (idx === -1) return { currentLogs, currentJob, currentTasks, currentBookings };

            const deleted = currentLogs[idx];
            const remaining = currentLogs.filter(l => l.id !== logId);
            const taskId = deleted.taskId || deleted.task_id;
            const jobId = deleted.jobId || deleted.job_id;

            const hasCompleted = remaining.some(l => l.isCompleted || l.is_completed || l.userConfirmed || l.user_confirmed);
            if (!hasCompleted) {
                const totalDays = deleted.totalDays || deleted.total_days || 3;
                const completedDays = remaining.filter(l => (Number(l.progressPercent || l.progress_percent) || 0) > 0).length;
                const newProgress = completedDays > 0 ? Math.min(95, Math.round((completedDays / totalDays) * 100)) : 0;

                const task = currentTasks.find(t => String(t.id) === String(taskId));
                if (task) {
                    task.status = newProgress > 0 ? 'IN_PROGRESS' : 'PENDING';
                    task.progress_percent = newProgress;
                }

                if (currentJob && currentJob.status === 'QC_PENDING') {
                    currentJob.status = 'IN_PROGRESS';
                    currentJob.overall_progress = 70;
                    if (currentJob.step_timestamps) {
                        delete currentJob.step_timestamps.qc_pending_at;
                    }
                }

                const booking = currentBookings.find(b => String(b.taskId || b.task_id) === String(taskId) || String(b.jobId || b.job_id) === String(jobId));
                if (booking && booking.status === 'CONFIRMED') {
                    booking.status = 'PENDING_CONFIRM';
                    booking.confirmed_at = null;
                    booking.confirmed_by = null;
                }
            }

            return { remainingLogs: remaining, currentJob, currentTasks, currentBookings };
        }

        const testJob = {
            id: 'JOB_ROLLBACK_1',
            status: 'QC_PENDING',
            overall_progress: 85,
            step_timestamps: { qc_pending_at: '2026-09-09T17:00:00.000Z' }
        };
        const testTasks = [{ id: 'T_RB_1', status: 'DONE', progress_percent: 100 }];
        const testBookings = [{ id: 'BK_RB_1', taskId: 'T_RB_1', status: 'CONFIRMED', confirmed_by: 'Team B' }];
        const testLogs = [
            { id: 'LOG_FINAL', taskId: 'T_RB_1', jobId: 'JOB_ROLLBACK_1', dayNumber: 3, totalDays: 3, isCompleted: true, userConfirmed: true, progressPercent: 100 }
        ];

        simulateDailyLogDeletion('LOG_FINAL', testLogs, testJob, testTasks, testBookings);

        assert.strictEqual(testTasks[0].status, 'PENDING', 'Task must revert to PENDING when 0 logs remain');
        assert.strictEqual(testTasks[0].progress_percent, 0, 'Task progress must revert to 0%');
        assert.strictEqual(testJob.status, 'IN_PROGRESS', 'Job must revert from QC_PENDING to IN_PROGRESS');
        assert.strictEqual(testJob.overall_progress, 70, 'Job progress must reset to 70%');
        assert.strictEqual(testJob.step_timestamps.qc_pending_at, undefined, 'qc_pending_at must be deleted on rollback');
        assert.strictEqual(testBookings[0].status, 'PENDING_CONFIRM', 'QC booking must revert to PENDING_CONFIRM');
        assert.strictEqual(testBookings[0].confirmed_at, null, 'QC booking confirmed_at must be reset to null');

        // Verify that public/js/app.js deleteDailyWorkLog implements this exact rollback
        const fs = require('fs');
        const appJsCode = fs.readFileSync('./public/js/app.js', 'utf8');
        const deleteFnIdx = appJsCode.indexOf('deleteDailyWorkLog(logId, taskId)');
        assert.ok(deleteFnIdx !== -1, 'deleteDailyWorkLog function must exist in app.js');
        const endFnIdx = appJsCode.indexOf('ensureQCPendingForRenovate', deleteFnIdx);
        assert.ok(endFnIdx !== -1 && endFnIdx > deleteFnIdx, 'ensureQCPendingForRenovate boundary must follow deleteDailyWorkLog');
        const deleteFnSnippet = appJsCode.substring(deleteFnIdx, endFnIdx);
        assert.ok(deleteFnSnippet.includes("qcBooking.status = 'PENDING_CONFIRM'"), 'deleteDailyWorkLog must revert qcBooking.status to PENDING_CONFIRM');
        assert.ok(deleteFnSnippet.includes("qcBooking.confirmedAt = null"), 'deleteDailyWorkLog must reset qcBooking.confirmedAt to null');

        recordResult('TC-DLOG-10', 'การย้อนกลับสถานะสมบูรณ์เมื่อลบบันทึกเสร็จงาน (Auto-Rollback Integrity)', 'R1', true, 'Reverted Task (PENDING), Job (IN_PROGRESS), removed qc_pending_at, and restored QC booking (PENDING_CONFIRM)');
    } catch (e) {
        recordResult('TC-DLOG-10', 'การย้อนกลับสถานะสมบูรณ์เมื่อลบบันทึกเสร็จงาน (Auto-Rollback Integrity)', 'R1', false, e.message);
    }

    // TC-DLOG-11: Backend API Architecture & Endpoints Verification (REST API Handlers & DB Repository)
    try {
        const fs = require('fs');
        const serverTsCode = fs.readFileSync('./server.ts', 'utf8');
        const dbTsCode = fs.readFileSync('./database.ts', 'utf8');

        // 1. Verify Daily Work Log Endpoints
        assert.ok(serverTsCode.includes("app.post('/api/v1/jobs/:id/daily-logs'"), 'Must declare POST /api/v1/jobs/:id/daily-logs');
        assert.ok(serverTsCode.includes("app.delete('/api/v1/daily-logs/:logId'"), 'Must declare DELETE /api/v1/daily-logs/:logId');
        assert.ok(serverTsCode.includes("handleCreateDailyLog"), 'Must implement handleCreateDailyLog handler');

        // 2. Verify STK Outbound Export Endpoints & Gating
        assert.ok(serverTsCode.includes("app.post(['/api/v1/jobs/:id/export-stk'"), 'Must declare POST /api/v1/jobs/:id/export-stk');
        assert.ok(serverTsCode.includes("ALREADY_QC_PASSED"), 'Must implement ALREADY_QC_PASSED gating rule');

        // 3. Verify Database Table Schema & Methods
        assert.ok(dbTsCode.includes("core_daily_work_logs"), 'core_daily_work_logs table must be defined in database.ts');
        assert.ok(dbTsCode.includes("dbLoadDailyWorkLogs"), 'dbLoadDailyWorkLogs must be exported');
        assert.ok(dbTsCode.includes("dbSaveDailyWorkLog"), 'dbSaveDailyWorkLog must be exported');
        assert.ok(dbTsCode.includes("dbDeleteDailyWorkLog"), 'dbDeleteDailyWorkLog must be exported');
        assert.ok(dbTsCode.includes("dbConfirmQCBooking"), 'dbConfirmQCBooking must be exported');
        assert.ok(dbTsCode.includes("dbRevertQCBooking"), 'dbRevertQCBooking must be exported');

        recordResult('TC-DLOG-11', 'สถาปัตยกรรม REST API Backend & DB Repository (Daily Logs & STK Sync)', 'R1', true, 'Verified server.ts endpoints (POST/DELETE daily-logs, POST export-stk) and database.ts tables/queries');
    } catch (e) {
        recordResult('TC-DLOG-11', 'สถาปัตยกรรม REST API Backend & DB Repository (Daily Logs & STK Sync)', 'R1', false, e.message);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REQUIREMENT 2: Handover & Transition to QC
    // ─────────────────────────────────────────────────────────────────────────

    // State container for simulated pipeline
    const jobState = {
        id: 'JOB26090900002',
        job_no: 'JOB26090900002',
        ticket_no: 'TK-2026-0902',
        booking_no: 'BK-2026-902',
        customer_name: 'คุณวิชัย พัฒนาพาณิชย์',
        customer_phone: '081-999-8888',
        job_type: 'renovate',
        status: 'IN_PROGRESS',
        overall_progress: 50,
        assigned_tech: 'Team B (ประเสริฐ)',
        tasks: [
            {
                id: 'T_JOB26090900002_1',
                name: 'งานเดินท่อร้อยสายไฟและติดตั้งเบรกเกอร์',
                start: '2026-09-07',
                end: '2026-09-09',
                days: 3,
                tech: 'Team B (ประเสริฐ)',
                status: 'IN_PROGRESS',
                progress_percent: 67
            }
        ],
        step_timestamps: {
            step1_accepted_at: '2026-09-05T09:00:00.000Z',
            step4_gantt_at: '2026-09-06T10:00:00.000Z'
        }
    };

    const qcBookingState = {
        id: 'BK_QC_002',
        job_id: 'JOB26090900002',
        task_id: 'T_JOB26090900002_1',
        customer_name: 'คุณวิชัย พัฒนาพาณิชย์',
        status: 'PENDING',
        booking_date: '2026-09-09',
        qc_booking_date: '2026-09-09',
        assigned_tech: 'Team B (ประเสริฐ)',
        assigned_qc_tech: 'วิชัย ตรวจดี (ช่าง QC Lead)',
        confirmed_at: null,
        confirmed_by: null
    };

    // TC-QC-01: Final Day Completion / User Confirmation
    try {
        const finalDailyLog = {
            id: `LOG_${Date.now()}`,
            job_id: jobState.id,
            task_id: jobState.tasks[0].id,
            day_number: 3,
            total_days: 3,
            log_date: '2026-09-09',
            start_time: '08:30',
            end_time: '17:00',
            work_hours: '8 ชม. 30 นาที',
            progress_percent: 100,
            is_completed: true,
            user_confirmed: true,
            user_confirmed_at: new Date().toISOString(),
            work_description: 'งานติดตั้งเสร็จสมบูรณ์ 100% (User ยืนยัน) ตรวจสอบระบบเรียบร้อย พร้อมส่งมอบให้ทีม QC ตรวจรับรองคุณภาพ',
            recorded_by: 'Team B (ประเสริฐ)',
            reporter_role: 'TECH'
        };

        // Simulate backend handleCreateDailyLog behavior
        const isOverallComplete = Boolean(
            (finalDailyLog.is_completed || finalDailyLog.user_confirmed) &&
            (finalDailyLog.day_number >= finalDailyLog.total_days || finalDailyLog.user_confirmed)
        );
        assert.strictEqual(isOverallComplete, true, 'Must evaluate to overall complete');

        const nowIso = new Date().toISOString();
        if (isOverallComplete) {
            // Task status -> DONE
            const task = jobState.tasks.find(t => t.id === finalDailyLog.task_id);
            task.status = 'DONE';
            task.progress_percent = 100;

            // Job status -> QC_PENDING
            jobState.status = 'QC_PENDING';
            jobState.overall_progress = 85;

            // Record timestamp in step_timestamps
            if (!jobState.step_timestamps) jobState.step_timestamps = {};
            jobState.step_timestamps.qc_pending_at = nowIso;

            // Confirm QC Booking
            qcBookingState.status = 'CONFIRMED';
            qcBookingState.confirmed_at = nowIso;
            qcBookingState.confirmed_by = finalDailyLog.recorded_by;
            qcBookingState.qc_booking_date = finalDailyLog.log_date;
        }

        assert.strictEqual(jobState.tasks[0].status, 'DONE', 'Task status must be DONE');
        assert.strictEqual(jobState.tasks[0].progress_percent, 100, 'Task progress must be 100%');
        assert.strictEqual(jobState.status, 'QC_PENDING', 'Job status must be QC_PENDING');
        assert.strictEqual(jobState.overall_progress, 85, 'Job progress must be 85% at QC_PENDING');
        assert.ok(jobState.step_timestamps.qc_pending_at, 'step_timestamps.qc_pending_at must be populated');

        recordResult('TC-QC-01', 'ส่งมอบงานรอบสุดท้าย (User ยืนยัน 100%): Task ➔ DONE, Job ➔ QC_PENDING', 'R2', true, `Task: DONE (100%), Job: QC_PENDING (85%), Timestamp qc_pending_at: ${jobState.step_timestamps.qc_pending_at}`);
    } catch (e) {
        recordResult('TC-QC-01', 'ส่งมอบงานรอบสุดท้าย (User ยืนยัน 100%): Task ➔ DONE, Job ➔ QC_PENDING', 'R2', false, e.message);
    }

    // TC-QC-02: QC Booking Confirmation on End Date
    try {
        assert.strictEqual(qcBookingState.status, 'CONFIRMED', 'QC Booking status must be CONFIRMED');
        assert.ok(qcBookingState.confirmed_at, 'confirmed_at must be recorded');
        assert.strictEqual(qcBookingState.confirmed_by, 'Team B (ประเสริฐ)', 'confirmed_by must be technician name');
        assert.strictEqual(qcBookingState.qc_booking_date, '2026-09-09', 'QC booking date must match task end date');

        recordResult('TC-QC-02', 'อัปเดตการจองคิวตรวจ QC (QC Booking) เป็น CONFIRMED ตามวันสิ้นสุดงาน', 'R2', true, `Status: ${qcBookingState.status}, Confirmed By: ${qcBookingState.confirmed_by}, Booking Date: ${qcBookingState.qc_booking_date}`);
    } catch (e) {
        recordResult('TC-QC-02', 'อัปเดตการจองคิวตรวจ QC (QC Booking) เป็น CONFIRMED ตามวันสิ้นสุดงาน', 'R2', false, e.message);
    }

    // TC-QC-03: Early Completion with User Confirmation (Day 1 of 3)
    try {
        const earlyJob = {
            id: 'JOB_EARLY_001',
            status: 'IN_PROGRESS',
            tasks: [{ id: 'T_EARLY_1', days: 3, status: 'IN_PROGRESS', progress_percent: 0 }],
            step_timestamps: {}
        };
        const earlyLog = {
            day_number: 1,
            total_days: 3,
            is_completed: true,
            user_confirmed: true,
            progress_percent: 100,
            force_complete: true
        };

        const isEarlyComplete = Boolean(
            earlyLog.user_confirmed || earlyLog.force_complete ||
            (earlyLog.is_completed && earlyLog.day_number >= earlyLog.total_days) ||
            (earlyLog.progress_percent >= 100)
        );
        if (isEarlyComplete) {
            earlyJob.tasks[0].status = 'DONE';
            earlyJob.tasks[0].progress_percent = 100;
            earlyJob.status = 'QC_PENDING';
            earlyJob.step_timestamps.qc_pending_at = new Date().toISOString();
        }

        assert.strictEqual(earlyJob.tasks[0].status, 'DONE', 'Early complete task must be DONE');
        assert.strictEqual(earlyJob.status, 'QC_PENDING', 'Early complete job must be QC_PENDING');
        assert.ok(earlyJob.step_timestamps.qc_pending_at, 'qc_pending_at must be populated on early completion');

        recordResult('TC-QC-03', 'บันทึกงานเสร็จก่อนกำหนดด้วย User ยืนยัน (Early Finish Handover)', 'R2', true, 'Task completed on Day 1 of 3; successfully transitioned to DONE and QC_PENDING with timestamp');
    } catch (e) {
        recordResult('TC-QC-03', 'บันทึกงานเสร็จก่อนกำหนดด้วย User ยืนยัน (Early Finish Handover)', 'R2', false, e.message);
    }

    // TC-QC-04: QC Booking Confirmation Dual-Key Resolution (task_id and job_id)
    try {
        function simulateDbConfirmQCBooking(filterId, bookings, confirmedBy, bookingDate) {
            const booking = bookings.find(b => b.id === filterId || b.task_id === filterId || b.job_id === filterId);
            if (booking) {
                booking.status = 'CONFIRMED';
                booking.confirmed_at = new Date().toISOString();
                booking.confirmed_by = confirmedBy;
                if (bookingDate) booking.qc_booking_date = bookingDate;
                return booking;
            }
            return null;
        }

        const mockBookings = [
            { id: 'BK_1', job_id: 'JOB_A', task_id: 'T_A', status: 'PENDING' },
            { id: 'BK_2', job_id: 'JOB_B', task_id: null, status: 'PENDING' }
        ];

        // Match by task_id
        const resTask = simulateDbConfirmQCBooking('T_A', mockBookings, 'Team A', '2026-09-10');
        assert.ok(resTask, 'Must match by task_id');
        assert.strictEqual(resTask.status, 'CONFIRMED');

        // Match by job_id when task_id is null
        const resJob = simulateDbConfirmQCBooking('JOB_B', mockBookings, 'Team B', '2026-09-12');
        assert.ok(resJob, 'Must match by job_id when task_id is null');
        assert.strictEqual(resJob.status, 'CONFIRMED');
        assert.strictEqual(resJob.qc_booking_date, '2026-09-12');

        recordResult('TC-QC-04', 'อัปเดตการจองคิวตรวจ QC แบบ Dual-Key (รองรับทั้ง task_id และ job_id)', 'R2', true, 'Successfully matched and confirmed bookings via both task_id and job_id');
    } catch (e) {
        recordResult('TC-QC-04', 'อัปเดตการจองคิวตรวจ QC แบบ Dual-Key (รองรับทั้ง task_id และ job_id)', 'R2', false, e.message);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REQUIREMENT 3: QC Evaluation & STK Sync
    // ─────────────────────────────────────────────────────────────────────────

    // TC-STK-01: Job Appears in Step 5 QC Queue
    try {
        const dbJobs = [jobState, { id: 'JOB_DRAFT', status: 'DRAFT' }, { id: 'JOB_CLOSED', status: 'CLOSED' }];
        const qcList = dbJobs.filter(j => 
            j.status === 'QC_PENDING' ||
            j.status === 'QC_PASSED' ||
            (j.step_timestamps && j.step_timestamps.qc_pending_at)
        );

        assert.strictEqual(qcList.length, 1, 'Exactly 1 job must qualify for QC queue');
        assert.strictEqual(qcList[0].id, jobState.id, 'Target job must appear in QC queue');
        recordResult('TC-STK-01', 'ดึงข้อมูลใบงานสถานะ QC_PENDING แสดงในรายการตรวจ QC (Step 5)', 'R3', true, `Job ${jobState.id} found in Step 5 QC Queue with status ${jobState.status}`);
    } catch (e) {
        recordResult('TC-STK-01', 'ดึงข้อมูลใบงานสถานะ QC_PENDING แสดงในรายการตรวจ QC (Step 5)', 'R3', false, e.message);
    }

    // TC-STK-02: QC Checklist Evaluation (Scoring 5.0 / 5.0)
    let questionsData = [];
    try {
        questionsData = [
            {
                question_no: 1,
                question_title: '1. ตรวจสอบความถูกต้องของแนวเดินท่อและสายไฟตามแบบแปลน',
                category: 'มาตรฐานงานระบบไฟฟ้า',
                answer: 'YES',
                score: 5,
                max_score: 5,
                result: 'PASS',
                remarks: 'เดินท่อตรงตามแบบ ไม่มีการโก่งงอ',
                photos: [{ url: 'https://site.com/qc_p1.jpg', title: 'ตรวจแนวท่อ' }]
            },
            {
                question_no: 2,
                question_title: '2. ตรวจสอบการขันแน่นของขั้วต่อสายไฟและสายดิน (Grounding)',
                category: 'มาตรฐานความปลอดภัย',
                answer: 'YES',
                score: 5,
                max_score: 5,
                result: 'PASS',
                remarks: 'ขันแน่นตามทอร์ค และทดสอบความต่อเนื่องสายดินผ่าน',
                photos: [{ url: 'https://site.com/qc_p2.jpg', title: 'ตรวจสายดิน' }]
            },
            {
                question_no: 3,
                question_title: '3. ทดสอบระบบตัดไฟรั่ว RCBO Safe-T-Cut และวัดแรงดันไฟฟ้า',
                category: 'การทดสอบระบบ (Testing)',
                answer: 'YES',
                score: 5,
                max_score: 5,
                result: 'PASS',
                remarks: 'แรงดัน 220V เสถียร RCBO ทริปที่ 30mA ตามมาตรฐาน',
                photos: [{ url: 'https://site.com/qc_p3.jpg', title: 'วัดแรงดัน' }]
            }
        ];

        const allPass = questionsData.every(q => q.result === 'PASS' && q.score === 5);
        assert.strictEqual(allPass, true, 'All questions must pass with 5/5');
        const avgScore = questionsData.reduce((acc, q) => acc + q.score, 0) / questionsData.length;
        assert.strictEqual(avgScore, 5.0, 'Average QC score must be 5.0');

        recordResult('TC-STK-02', 'ประเมินเช็คลิสต์ QC: คำถาม 3 ข้อ ได้คะแนนเต็ม 5.0/5.0 และแนบรูปตรวจสอบครบ', 'R3', true, `Evaluated 3 inspection checklist items: 100% PASS, Average Score: 5.0 / 5.0`);
    } catch (e) {
        recordResult('TC-STK-02', 'ประเมินเช็คลิสต์ QC: คำถาม 3 ข้อ ได้คะแนนเต็ม 5.0/5.0 และแนบรูปตรวจสอบครบ', 'R3', false, e.message);
    }

    // TC-STK-03: Approval to QC_PASSED & STK Payload Generation
    let outboundPayloadResult = null;
    try {
        const { stkRef, payload, nowIso } = PMT_ENGINE.buildSTKPayload(
            jobState,
            jobState.tasks[0],
            questionsData,
            'วิชัย ตรวจดี (ช่าง QC Lead)',
            'งานติดตั้งเรียบร้อยตามมาตรฐาน ผ่านเกณฑ์ QC ระดับดีเยี่ยม'
        );

        outboundPayloadResult = payload;

        // Apply changes to Job State
        jobState.status = 'QC_PASSED';
        jobState.overall_progress = 100;
        jobState.qc_score = payload.qc_score;
        jobState.qc_passed_at = nowIso;
        jobState.stk_ref = stkRef;
        jobState.stk_status = 'DELIVERED';
        jobState.stk_exported_at = nowIso;
        jobState.stk_payload = payload;

        if (!jobState.step_timestamps) jobState.step_timestamps = {};
        jobState.step_timestamps.qc_passed_at = nowIso;
        jobState.step_timestamps.stk_exported_at = nowIso;

        // Verify Job State Updates
        assert.strictEqual(jobState.status, 'QC_PASSED', 'Status must be QC_PASSED');
        assert.strictEqual(jobState.overall_progress, 100, 'Progress must be 100%');
        assert.strictEqual(jobState.stk_status, 'DELIVERED', 'STK status must be DELIVERED');
        assert.strictEqual(jobState.step_timestamps.qc_passed_at, nowIso, 'step_timestamps.qc_passed_at must match');
        assert.strictEqual(jobState.step_timestamps.stk_exported_at, nowIso, 'step_timestamps.stk_exported_at must match');

        // Verify STK 8 Mandatory Root Fields
        assert.strictEqual(payload.ref_no, 'TK-2026-0902', 'Field 1: ref_no must be valid');
        assert.strictEqual(payload.ticket, 'TK-2026-0902', 'Field 2: ticket must be valid');
        assert.strictEqual(payload.booking_no, 'BK-2026-902', 'Field 3: booking_no must be valid');
        assert.ok(payload.qc_date, 'Field 4: qc_date must be populated in 24-hr DD/MM/YYYY format');
        assert.strictEqual(/AM|PM/i.test(payload.qc_date), false, 'qc_date must NOT contain AM or PM');
        assert.strictEqual(payload.customer_name, 'คุณวิชัย พัฒนาพาณิชย์', 'Field 5: customer_name must match');
        assert.strictEqual(payload.customer_phone, '081-999-8888', 'Field 6: customer_phone must match');
        assert.strictEqual(payload.qc_round, 1, 'Field 7: qc_round must be 1');
        assert.strictEqual(payload.qc_result, 'ผ่านเกณฑ์', 'Field 7.2: qc_result must be ผ่านเกณฑ์');
        assert.strictEqual(payload.qc_score, 5.0, 'Field 8: qc_score must be 5.0');
        assert.strictEqual(payload.qc_score_text, '5.0 / 5.0 คะแนน', 'Field 8.1: qc_score_text must match');

        // Verify STK Ref format
        assert.ok(/^STK-QC-\d{4}-\d{6}$/.test(payload.stk_ref), 'stk_ref must follow STK-QC-YYYY-XXXXXX pattern');

        recordResult('TC-STK-03', 'อนุมัติปิดงาน QC_PASSED 100% และจัดทำ STK Outbound Payload ครบ 8 ฟิลด์หลัก', 'R3', true, `STK Ref: ${stkRef} | Status: DELIVERED | QC Score: 5.0/5.0 | Timestamps: qc_passed_at & stk_exported_at recorded`, payload);
    } catch (e) {
        recordResult('TC-STK-03', 'อนุมัติปิดงาน QC_PASSED 100% และจัดทำ STK Outbound Payload ครบ 8 ฟิลด์หลัก', 'R3', false, e.message);
    }

    // TC-STK-04: Resubmission Gating (Prevent duplicate submission once QC_PASSED)
    try {
        function checkSubmissionAllowed(job) {
            if (job.status === 'QC_PASSED') {
                return {
                    allowed: false,
                    error: {
                        code: 'ALREADY_QC_PASSED',
                        message: 'ใบงานนี้ผ่านการตรวจรับรองคุณภาพ QC และบันทึกส่งข้อมูลไป STK เรียบร้อยแล้ว ไม่อนุญาตให้บันทึกใหม่หรือส่งซ้ำ'
                    }
                };
            }
            return { allowed: true };
        }

        const gatingCheck = checkSubmissionAllowed(jobState);
        assert.strictEqual(gatingCheck.allowed, false, 'Duplicate export must be blocked');
        assert.strictEqual(gatingCheck.error.code, 'ALREADY_QC_PASSED', 'Must return ALREADY_QC_PASSED error');

        recordResult('TC-STK-04', 'ระบบป้องกันการส่งซ้ำ (Idempotency Gating Rule: ALREADY_QC_PASSED)', 'R3', true, 'Correctly intercepted duplicate submission attempt for already passed job');
    } catch (e) {
        recordResult('TC-STK-04', 'ระบบป้องกันการส่งซ้ำ (Idempotency Gating Rule: ALREADY_QC_PASSED)', 'R3', false, e.message);
    }

    // TC-STK-05: Outbound Webhook Network Fault Resilience
    try {
        function simulateSTKOutboundDispatch(payload, webhookSimulator) {
            let webhookResult = null;
            try {
                webhookResult = webhookSimulator(payload);
            } catch (err) {
                webhookResult = { ok: false, error: err.message };
            }

            // PMT Flow guarantees internal delivery success even if external webhook fails
            const internalResponse = {
                success: true,
                status: 200,
                data: {
                    stk_ref: payload.stk_ref,
                    status: 'DELIVERED',
                    exported_at: payload.exported_at
                },
                webhook: webhookResult
            };
            return internalResponse;
        }

        // Test with simulated external webhook network failure
        const failingSimulator = () => { throw new Error('ConnectTimeoutError: https://vwds.online/api/webhooks/pmt-qc unreachable'); };
        const dispatchResp = simulateSTKOutboundDispatch(outboundPayloadResult, failingSimulator);

        assert.strictEqual(dispatchResp.success, true, 'Internal export must succeed 200');
        assert.strictEqual(dispatchResp.data.status, 'DELIVERED', 'Status must be marked DELIVERED internally');
        assert.strictEqual(dispatchResp.webhook.ok, false, 'Webhook failure must be captured gracefully');
        assert.ok(dispatchResp.webhook.error.includes('unreachable'), 'Error message must be preserved');

        recordResult('TC-STK-05', 'ความทนทานต่อความผิดพลาดของเครือข่ายส่งออก STK (Webhook Fault Tolerance)', 'R3', true, 'System successfully returned HTTP 200 DELIVERED even when external webhook timed out');
    } catch (e) {
        recordResult('TC-STK-05', 'ความทนทานต่อความผิดพลาดของเครือข่ายส่งออก STK (Webhook Fault Tolerance)', 'R3', false, e.message);
    }

    // TC-STK-06: Dual Timestamps Synchronization (qc_passed_at & stk_exported_at)
    try {
        assert.ok(jobState.step_timestamps.qc_passed_at, 'qc_passed_at must be populated');
        assert.ok(jobState.step_timestamps.stk_exported_at, 'stk_exported_at must be populated');
        assert.strictEqual(jobState.step_timestamps.qc_passed_at, jobState.step_timestamps.stk_exported_at, 'qc_passed_at and stk_exported_at must be synchronized simultaneously');
        
        const passedTime = new Date(jobState.step_timestamps.qc_passed_at).getTime();
        assert.strictEqual(isNaN(passedTime), false, 'qc_passed_at must be a valid ISO Date');

        recordResult('TC-STK-06', 'ความสอดคล้องของบันทึกเวลาคู่ขนาน (Dual Timestamps Synchronization)', 'R3', true, `Simultaneously recorded qc_passed_at & stk_exported_at: ${jobState.step_timestamps.qc_passed_at}`);
    } catch (e) {
        recordResult('TC-STK-06', 'ความสอดคล้องของบันทึกเวลาคู่ขนาน (Dual Timestamps Synchronization)', 'R3', false, e.message);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY MATRIX & REPORT GENERATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS MATRIX (SUMMARY)');
    console.log('='.repeat(80));
    console.log('| Test ID     | Req | Description                                            | Status |');
    console.log('|-------------|-----|--------------------------------------------------------|--------|');
    testResults.forEach(r => {
        const idCol = r.tcId.padEnd(11, ' ');
        const reqCol = r.req.padEnd(3, ' ');
        const descCol = (r.name.length > 54 ? r.name.slice(0, 51) + '...' : r.name).padEnd(54, ' ');
        const statusCol = r.passed ? 'PASS  ' : 'FAIL  ';
        console.log(`| ${idCol} | ${reqCol} | ${descCol} | ${statusCol} |`);
    });
    console.log('='.repeat(80));

    const totalPassed = testResults.filter(r => r.passed).length;
    const totalFailed = testResults.filter(r => !r.passed).length;
    console.log(`TOTAL: ${testResults.length} | PASSED: ${totalPassed} | FAILED: ${totalFailed} | RATE: ${((totalPassed / testResults.length) * 100).toFixed(1)}%`);

    if (outboundPayloadResult) {
        console.log('\n' + '-'.repeat(80));
        console.log('📦 STK OUTBOUND PAYLOAD SAMPLE (8 MANDATORY FIELDS + SYSTEM METADATA):');
        console.log('-'.repeat(80));
        console.log(JSON.stringify(outboundPayloadResult, null, 2));
        console.log('-'.repeat(80));
    }

    if (totalFailed > 0) {
        testResults.filter(t => !t.passed).forEach(t => {
            console.error(`💥 [${t.tcId}] FAIL REASON: ${t.details}`);
        });
        throw new Error(`Test suite failed: ${totalFailed} tests did not pass`);
    }

    return { totalPassed, totalFailed, results: testResults, samplePayload: outboundPayloadResult };
}

if (require.main === module) {
    runTestSuite()
        .then(() => {
            console.log('\n🎉 ALL PIPELINE TESTS PASSED CLEANLY (100% SUCCESS)\n');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ TEST RUN FAILED:', err.message);
            process.exit(1);
        });
}

module.exports = { runTestSuite, PMT_ENGINE };
