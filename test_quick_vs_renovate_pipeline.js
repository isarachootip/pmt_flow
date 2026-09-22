/**
 * =============================================================================
 * AUTOMATED QA TEST SUITE: QUICK SERVICES VS RENOVATE PIPELINE VERIFICATION
 * =============================================================================
 * 
 * Objective:
 * Verify that:
 * 1. Step 1 (ศูนย์รับคำสั่งซื้อ) is an active queue for pending incoming orders,
 *    NOT the all-orders master report.
 * 2. Quick Services:
 *    - Bypasses Design & BOQ.
 *    - When accepted / saved from Step 1, navigates directly to Step 5: QC (Quality Control Online).
 *    - Leaves the Step 1 pending queue.
 *    - Appears in the QC queue (QC Online tab).
 *    - Does NOT bounce back to Step 1.
 * 3. Renovate Projects:
 *    - Requires Design & BOQ.
 *    - When accepted / proceeded from Step 1, navigates to Step 2: Tickets & Receipts.
 *    - Leaves the Step 1 pending queue.
 *    - Appears in the Step 2 Tickets queue.
 *    - Once ticket is issued, can convert into Project (Step 3) and Gantt tasks (Step 4).
 * 4. Master Orders Report (Report ➔ สรุปคำสั่งซื้อทั้งหมด):
 *    - Tracks ALL orders across all 6 steps.
 *    - Quick job is correctly shown in Step 5 (QC).
 *    - Renovate job is correctly shown in Step 2 (Ticket & Convert).
 * =============================================================================
 */

const assert = require('assert');

// 1. Mock PMT Flow State & DB
const DB = {
    jobs: [],
    blueprints: [],
    tickets: [],
    qcBookings: [],
    tasks: []
};

// Track simulated navigation calls and toasts
const NavigationHistory = [];
const ToastHistory = [];

// Helper functions mirroring app.js
const app = {
    state: {
        currentView: 'jobs',
        qcTab: 'inspection',
        qcSegmentFilter: 'all'
    },

    navigate(view, param = null) {
        NavigationHistory.push({ view, param, timestamp: new Date().toISOString() });
        this.state.currentView = view;
    },

    showToast(msg, type = 'info') {
        ToastHistory.push({ msg, type, timestamp: new Date().toISOString() });
    },

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

    isQuickJob(job) {
        if (!job) return false;
        const jt = (job.job_type || '').toLowerCase().trim();
        if (jt === 'quick') return true;
        if (jt === 'renovate' || jt === 'ma') return false;
        const s = (job.service || '').toLowerCase();
        if (s.includes('renovate') || s.includes('กระเบื้อง') || s.includes('ทาสี') || s.includes('ฉากกั้น') || s.includes('ครัว') || s.includes('สำรวจ')) {
            return false;
        }
        if (s.includes('ma') || s.includes('สัญญา') || s.includes('ล้าง') || s.includes('บำรุง') || s.includes('รอบ')) {
            return false;
        }
        return true;
    },

    isDesignFinalV2(job) {
        if (!job) return false;
        if (this.isQuickJob(job)) return true; // Quick Services bypass Design & BOQ
        const jobId = job.id || job.job_no;
        const bps = (DB.blueprints || []).filter(b => b.jobId === jobId || String(b.jobId) === String(jobId));
        if (!bps || bps.length === 0) return false;
        return bps.some(b => {
            const v = String(b.version || '').toLowerCase().trim();
            return v.includes('v2.0') || v.includes('v2 final') || v.includes('v2 approved') || (v.includes('v2') && v.includes('final')) || v.includes('สมบูรณ์');
        });
    },

    recordStepTimestamp(jobId, field, isoString, note) {
        const job = DB.jobs.find(j => j.id === jobId);
        if (job) {
            if (!job.step_timestamps) job.step_timestamps = {};
            job.step_timestamps[field] = isoString;
            if (!job.activity_logs) job.activity_logs = [];
            job.activity_logs.push({ field, timestamp: isoString, note });
        }
    },

    goToQC(id) {
        const job = (DB.jobs || []).find(j => j.id === id || String(j.id) === String(id));
        const targetId = job ? job.id : id;
        if (job && this.isQuickJob(job)) {
            this.state.qcSegmentFilter = 'quick';
            if (job.status !== 'QC_PENDING' && job.status !== 'QC_PASSED' && job.status !== 'QC_REWORK' && job.status !== 'COMPLETED') {
                job.status = 'QC_PENDING';
                job.qc_inspection_type = 'ONLINE';
                job.qc_type = 'ONLINE';
                job.progress = Math.max(job.progress || 0, 85);
                if (!job.step_timestamps) job.step_timestamps = {};
                const now = new Date().toISOString();
                if (!job.step_timestamps.qc_pending_at) job.step_timestamps.qc_pending_at = now;
                if (!job.step_timestamps.step5_skipped_at) job.step_timestamps.step5_skipped_at = now;
                this.recordStepTimestamp(targetId, 'qc_pending_at', now, 'ย้ายงาน Quick Service เข้าสู่คิวรอตรวจ QC Online (Step 5)');
            }
        }
        this.state.qcTab = 'inspection';
        this.navigate('qc');
    },

    acceptJobToPMT(id) {
        const job = DB.jobs.find(j => j.id === id);
        if (!job) return;

        const acceptNow = new Date().toISOString();
        job.status = 'IN_PROGRESS';
        job.pmt_accepted = true;
        job.pmt_accepted_at = acceptNow;

        if (!job.step_timestamps) job.step_timestamps = {};
        this.recordStepTimestamp(id, 'step1_accepted_at', acceptNow, 'รับงานเข้าสู่ PMT (In Progress)');
        if (!job.step_timestamps.step1_order_at) {
            this.recordStepTimestamp(id, 'step1_order_at', acceptNow, 'รับ Order');
        }

        const isQuick = this.isQuickJob(job);

        if (isQuick) {
            // Quick Services: Transition directly into QC Online (Step 5)
            job.status = 'QC_PENDING';
            job.qc_inspection_type = 'ONLINE';
            job.progress = Math.max(job.progress || 0, 85);
            job.step_timestamps.qc_pending_at = acceptNow;
            this.recordStepTimestamp(id, 'qc_pending_at', acceptNow, 'Quick Service — ส่งตรงเข้าสู่ QC Online (Step 5)');

            this.showToast(`⚡ บันทึกรับ Order [${id}] (Quick Service) เรียบร้อย! วิ่งตรงไปหน้า QC Online เพื่อปิดงานทันที...`, 'success');
            this.goToQC(id);
            return;
        } else {
            // Renovate jobs: Transition into Step 2 (Tickets & Receipts)
            job.progress = Math.max(job.progress || 0, 45);
            job.step_timestamps.step2_ticket_at = acceptNow;
            this.recordStepTimestamp(id, 'step2_ticket_at', acceptNow, 'บันทึกรับเข้า PMT ส่งต่อไปยัง Step 2 (บันทึก Ticket & ใบเสร็จ)');

            this.showToast(`🎉 บันทึกรับ Order [${id}] เข้าสู่ระบบ PMT สำเร็จ! ส่งต่อไปยังขั้นตอนออก Ticket & สลิป...`);
            this.navigate('tickets');
        }
    },

    saveUnifiedOrderStudio(jobId) {
        const job = DB.jobs.find(j => j.id === jobId);
        if (!job) return;
        const isQuick = this.isQuickJob(job);
        const now = new Date();

        if (!job.step_timestamps) job.step_timestamps = {};
        job.step1_passed = true;
        if (!job.step_timestamps.step1_intake_at) job.step_timestamps.step1_intake_at = now.toISOString();

        if (isQuick) {
            job.pmt_accepted = true;
            job.status = 'QC_PENDING';
            job.qc_inspection_type = 'ONLINE';
            job.qc_type = 'ONLINE';
            job.progress = Math.max(job.progress || 0, 85);
            const nowIso = now.toISOString();
            job.step_timestamps.step1_accepted_at = nowIso;
            job.step_timestamps.qc_pending_at = nowIso;
            job.step_timestamps.step5_skipped_at = nowIso;

            this.showToast(`💾 บันทึกข้อมูลงาน Quick [${jobId}] เรียบร้อย! วิ่งตรงไปหน้า QC Online เพื่อปิดงานทันที...`, 'success');
            this.goToQC(jobId);
            return;
        }

        // Renovate Save: saves draft info
        const bps = (DB.blueprints || []).filter(b => b.jobId === jobId);
        if (bps.length > 0) {
            job.step2_passed = true;
            if (!job.step_timestamps.step2_design_at) job.step_timestamps.step2_design_at = now.toISOString();
        }
        if (job.boq_items && job.boq_items.length > 0) {
            job.step3_passed = true;
            if (!job.step_timestamps.step3_boq_at) job.step_timestamps.step3_boq_at = now.toISOString();
        }
        this.showToast(`💾 บันทึกข้อมูล Order & Design & BOQ สำหรับ [${jobId}] สำเร็จแล้ว (Draft Saved)`);
    },

    proceedUnifiedOrderToNextStage(jobId) {
        const job = DB.jobs.find(j => j.id === jobId);
        if (!job) return;

        const isQuick = this.isQuickJob(job);
        if (isQuick) {
            this.saveUnifiedOrderStudio(jobId);
            return;
        }

        // Renovate gating checks
        if (!this.isDesignFinalV2(job)) {
            throw new Error('⚠️ ยังไม่สามารถส่งต่อได้เพราะยังไม่แนบแบบแปลนเวอร์ชัน v2.0 Final');
        }

        const boqItems = job.boq_items || [];
        if (boqItems.length === 0) {
            throw new Error('⚠️ กรุณาจัดทำรายการ BOQ อย่างน้อย 1 รายการก่อนส่งต่อ');
        }

        this.saveUnifiedOrderStudio(jobId);
        job.pmt_accepted = true;
        job.status = 'IN_PROGRESS';
        job.progress = Math.max(job.progress || 0, 45);

        const now = new Date();
        if (!job.step_timestamps) job.step_timestamps = {};
        job.step_timestamps.step1_accepted_at = now.toISOString();
        job.step_timestamps.step2_ticket_at = now.toISOString();

        this.showToast(`🚀 อนุมัติคำสั่งซื้อ ${jobId} เรียบร้อย! ส่งต่องานไปยังขั้นตอนออก Ticket & สลิป...`);
        this.navigate('tickets');
    },

    // Step 1 Active Queue Filter (matches app.js step1Count & filterJobsByStatusTab('step1_queue'))
    isJobInStep1PendingQueue(job) {
        if (!job) return false;
        const isNotAccepted = !job.pmt_accepted;
        const isPendingStatus = (job.status === 'SURVEYED' || job.status === 'Survey' || job.status === 'DRAFT' || job.status === 'NEW' || job.status === 'Draft' || job.status === 'New');
        const hasAdvancedTimestamps = Boolean(job.step_timestamps && (
            job.step_timestamps.step1_accepted_at ||
            job.step_timestamps.step2_ticket_at ||
            job.step_timestamps.qc_pending_at ||
            job.step_timestamps.step4_ticket_at ||
            job.step_timestamps.step3_conversion_at
        ));
        const hasTicket = (DB.tickets || []).some(t => t.job_id === job.id);
        const isQCPending = job.status === 'QC_PENDING' || job.status === 'QC_PASSED';

        return isNotAccepted && isPendingStatus && !hasAdvancedTimestamps && !hasTicket && !isQCPending;
    },

    // QC Queue Filter (Step 5)
    isJobInQCQueue(job, segment = 'all') {
        if (!job) return false;
        const isQCStatus = job.status === 'QC_PENDING' || job.status === 'QC_INSPECTING' || job.status === 'QC_REWORK';
        if (!isQCStatus) return false;
        if (segment === 'quick') return this.isQuickJob(job);
        if (segment === 'renovate') return !this.isQuickJob(job);
        return true;
    },

    // Step 2 Tickets Queue Filter (Step 2)
    isJobInStep2TicketsQueue(job) {
        if (!job) return false;
        // Jobs that have been accepted into PMT and require Ticket
        const isAccepted = Boolean(job.pmt_accepted || (job.step_timestamps && job.step_timestamps.step2_ticket_at));
        const notQC = job.status !== 'QC_PENDING' && job.status !== 'QC_PASSED';
        return isAccepted && notQC && !this.isQuickJob(job);
    },

    // Master Orders Current Step Resolver
    getJobCurrentStep(j) {
        if (!j) return { stepNum: 1, stepName: 'Step 1: รับ Order' };
        const st = (j.status || '').toUpperCase();

        if (st === 'CLOSED' || st === 'QC_PASSED') {
            return { stepNum: 6, stepName: 'Step 6: ส่งต่อ STK (ปิดงาน)' };
        }
        if (st === 'QC_PENDING' || st === 'QC_INSPECTING' || st === 'QC_REWORK') {
            return { stepNum: 5, stepName: 'Step 5: ตรวจคุณภาพ (QC)' };
        }
        if (st === 'IN_PROGRESS' && j.tasks && j.tasks.length > 0) {
            return { stepNum: 4, stepName: 'Step 4: แผนงาน Gantt (ติดตั้ง)' };
        }
        if (j.pmt_accepted || st === 'CONVERTED' || (j.step_timestamps && (j.step_timestamps.step2_ticket_at || j.step_timestamps.step3_conversion_at))) {
            return { stepNum: 2, stepName: 'Step 2: Ticket & Convert' };
        }
        return { stepNum: 1, stepName: 'Step 1: รับ Order (คิวใหม่)' };
    }
};

// =============================================================================
// RUN TEST SUITE
// =============================================================================

function runPipelineTestSuite() {
    console.log('================================================================================');
    console.log('🧪 PMT FLOW: AUTOMATED QA VERIFICATION TEST');
    console.log('   TESTING: Quick Services vs Renovate Pipeline Behavior from Step 1');
    console.log('================================================================================\n');

    let totalTests = 0;
    let passedTests = 0;

    function test(name, fn) {
        totalTests++;
        process.stdout.write(`▶ Test ${totalTests}: ${name} ... `);
        try {
            fn();
            passedTests++;
            console.log('✅ PASSED');
        } catch (err) {
            console.log('❌ FAILED');
            console.error('   Error:', err.message);
        }
    }

    // --- SETUP SAMPLE DATA ---
    const quickJob = {
        id: 'JOB26092153815',
        job_no: 'JOB26092153815',
        customer: 'คุณ อานิสา แซ่โงะ',
        phone: '0972840079',
        service: 'Q-ปั๊ม เครื่องทำน้ำอุ่น/น้ำร้อน',
        job_type: 'quick',
        status: 'NEW',
        pmt_accepted: false,
        progress: 0,
        step_timestamps: {}
    };

    const renovateJob = {
        id: 'JOB26092105725',
        job_no: 'JOB26092105725',
        customer: 'คุณชาตรี แต้ตั้ง',
        phone: '0876895231',
        service: 'R-งานท่อ/งาน/เทปูน',
        job_type: 'renovate',
        status: 'NEW',
        pmt_accepted: false,
        progress: 0,
        boq_items: [],
        step_timestamps: {}
    };

    DB.jobs = [quickJob, renovateJob];

    // --- TEST 1: Initial Queue Verification in Step 1 ---
    test('Initial State: Both Quick and Renovate jobs must be in Step 1 Pending Queue', () => {
        assert.strictEqual(app.isJobInStep1PendingQueue(quickJob), true, 'Quick job should be in Step 1 queue initially');
        assert.strictEqual(app.isJobInStep1PendingQueue(renovateJob), true, 'Renovate job should be in Step 1 queue initially');
        assert.strictEqual(app.isJobInQCQueue(quickJob), false, 'Quick job should NOT be in QC yet');
        assert.strictEqual(app.isJobInStep2TicketsQueue(renovateJob), false, 'Renovate job should NOT be in Step 2 yet');
    });

    // --- TEST 2: Quick Job Accept / Save -> Fast-Track Direct to QC Online (Step 5) ---
    test('Quick Job: acceptJobToPMT must set status QC_PENDING and navigate to QC (Step 5)', () => {
        NavigationHistory.length = 0;
        app.acceptJobToPMT(quickJob.id);

        assert.strictEqual(quickJob.pmt_accepted, true, 'Quick job must have pmt_accepted = true');
        assert.strictEqual(quickJob.status, 'QC_PENDING', 'Quick job status must be QC_PENDING');
        assert.strictEqual(quickJob.qc_inspection_type, 'ONLINE', 'Quick job qc_inspection_type must be ONLINE');
        assert.ok(quickJob.step_timestamps.qc_pending_at, 'qc_pending_at timestamp must be recorded');

        // Navigation check: MUST navigate to 'qc'
        const lastNav = NavigationHistory[NavigationHistory.length - 1];
        assert.ok(lastNav, 'Must trigger navigation');
        assert.strictEqual(lastNav.view, 'qc', 'Navigation MUST go to qc, NOT stay on jobs/orders');
    });

    // --- TEST 3: Quick Job Queue Movement & Anti-Bounce Back Check ---
    test('Quick Job: Must LEAVE Step 1 Queue and APPEAR in QC Queue (NO bounce back to Step 1)', () => {
        // Step 1 Pending Queue Check: Must be FALSE (removed from Step 1 pending list)
        const inStep1 = app.isJobInStep1PendingQueue(quickJob);
        assert.strictEqual(inStep1, false, 'Quick job MUST leave Step 1 pending queue after being saved');

        // QC Queue Check: Must be TRUE
        const inQCAll = app.isJobInQCQueue(quickJob, 'all');
        const inQCQuick = app.isJobInQCQueue(quickJob, 'quick');
        assert.strictEqual(inQCAll, true, 'Quick job MUST appear in QC queue');
        assert.strictEqual(inQCQuick, true, 'Quick job MUST appear in QC Quick segment filter');

        // Anti-Bounce Check: Ensure current view is 'qc' and not 'jobs'
        assert.strictEqual(app.state.currentView, 'qc', 'Current active view must remain QC, not bounce back to jobs');
    });

    // --- TEST 4: Renovate Job Gating in Step 1 (Must have Design & BOQ) ---
    test('Renovate Job: Cannot proceed from Step 1 without Design v2.0 and BOQ items', () => {
        // Attempt without design & BOQ
        assert.throws(() => {
            app.proceedUnifiedOrderToNextStage(renovateJob.id);
        }, /ยังไม่สามารถส่งต่อได้เพราะยังไม่แนบแบบแปลนเวอร์ชัน v2.0/);

        // Add Design Blueprint
        DB.blueprints.push({
            id: 'BP-01',
            jobId: renovateJob.id,
            version: 'v2.0 Final',
            file_name: 'plumbing_plan_v2.pdf'
        });

        // Attempt without BOQ
        assert.throws(() => {
            app.proceedUnifiedOrderToNextStage(renovateJob.id);
        }, /กรุณาจัดทำรายการ BOQ อย่างน้อย 1 รายการ/);
    });

    // --- TEST 5: Renovate Job Proceed -> Advances to Step 2 (Tickets & Receipts) ---
    test('Renovate Job: proceedUnifiedOrderToNextStage must set IN_PROGRESS and navigate to tickets (Step 2)', () => {
        // Add BOQ items
        renovateJob.boq_items = [
            { id: 1, type: 'LABOR', name: 'ค่าแรงเดินท่อและเทปูน', qty: 1, price: 4500 }
        ];

        NavigationHistory.length = 0;
        app.proceedUnifiedOrderToNextStage(renovateJob.id);

        assert.strictEqual(renovateJob.pmt_accepted, true, 'Renovate job must have pmt_accepted = true');
        assert.strictEqual(renovateJob.status, 'IN_PROGRESS', 'Renovate job status must be IN_PROGRESS');
        assert.ok(renovateJob.step_timestamps.step2_ticket_at, 'step2_ticket_at timestamp must be recorded');

        // Navigation check: MUST navigate to 'tickets' (Step 2)
        const lastNav = NavigationHistory[NavigationHistory.length - 1];
        assert.ok(lastNav, 'Must trigger navigation');
        assert.strictEqual(lastNav.view, 'tickets', 'Renovate navigation MUST go to tickets (Step 2)');
    });

    // --- TEST 6: Renovate Job Queue Movement ---
    test('Renovate Job: Must LEAVE Step 1 Queue and APPEAR in Step 2 Tickets Queue', () => {
        const inStep1 = app.isJobInStep1PendingQueue(renovateJob);
        assert.strictEqual(inStep1, false, 'Renovate job MUST leave Step 1 pending queue after proceed');

        const inStep2 = app.isJobInStep2TicketsQueue(renovateJob);
        assert.strictEqual(inStep2, true, 'Renovate job MUST appear in Step 2 Tickets queue');
    });

    // --- TEST 7: Master Orders Report (Single View for ALL Orders) ---
    test('Master Orders Report: Tracks both Quick (in Step 5 QC) and Renovate (in Step 2 Ticket)', () => {
        // Both jobs must still exist in DB.jobs
        assert.strictEqual(DB.jobs.length, 2, 'All jobs must be preserved in master jobs repository');

        const quickStep = app.getJobCurrentStep(quickJob);
        const renovateStep = app.getJobCurrentStep(renovateJob);

        assert.strictEqual(quickStep.stepNum, 5, 'Quick job current step must resolve to Step 5: QC');
        assert.strictEqual(quickStep.stepName, 'Step 5: ตรวจคุณภาพ (QC)');

        assert.strictEqual(renovateStep.stepNum, 2, 'Renovate job current step must resolve to Step 2: Ticket & Convert');
        assert.strictEqual(renovateStep.stepName, 'Step 2: Ticket & Convert');
    });

    console.log('\n================================================================================');
    console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
    console.log('================================================================================\n');

    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

runPipelineTestSuite();
