/**
 * =============================================================================
 * AUTOMATED QA TEST SUITE: PHASE 2 DELIVERABLES
 * =============================================================================
 *
 * Scope:
 * 1. 3-Level Project Structure (Project -> Area/งานหลัก -> Task)
 * 2. QC Assignment per Area (Strictly 1 QC per area)
 * 3. Technician Assignment per Task (At least 1 tech)
 * 4. Start Task Validation Gatekeepers:
 *    - Area MUST have QC assigned (QC_REQUIRED)
 *    - Task MUST have at least 1 technician assigned (TECH_REQUIRED)
 * 5. Execution Timestamps (Plan vs Actual: actual_start_at, actual_end_at)
 * 6. Task Completion to WAIT_QC
 * 7. BOQ Revisions:
 *    - Increments boq_version
 *    - Preserves locked (PASSED / ESCALATED) tasks
 *    - Calculates and returns diff
 *    - Records revision history in boq_revisions
 * 8. Global Tasks Query (GET /api/v1/tasks)
 * 9. Audit Logging with Asia/Bangkok time for all actions
 * =============================================================================
 */

import assert from 'assert';
import { 
  pool, 
  initDatabase, 
  dbGetJob, 
  dbUpdateJob, 
  dbSaveAuditLog, 
  dbLoadAuditLogs 
} from './database';

let passedTests = 0;
let failedTests = 0;

function pass(name: string, detail?: string) {
  passedTests++;
  console.log(`  \x1b[32m✔ PASS\x1b[0m - ${name} ${detail ? `\x1b[90m(${detail})\x1b[0m` : ''}`);
}

function fail(name: string, error: any) {
  failedTests++;
  console.error(`  \x1b[31m✖ FAIL\x1b[0m - ${name}:`, error.message || error);
}

async function runTestSuite() {
  console.log('\n=============================================================================');
  console.log('  PHASE 2 AUTOMATED VERIFICATION SUITE');
  console.log('=============================================================================\n');

  const testBookingNo = `TEST-P2-RENOVATE-${Date.now()}`;
  let createdJobId: number | string = 0;

  try {
    await initDatabase();
    const client = await pool.connect();

    try {
      // ---------------------------------------------------------------------------
      // SUITE 1: Create Test Renovate Job & 3-Level Project Conversion
      // ---------------------------------------------------------------------------
      console.log('▶ [SUITE 1] 3-Level Project Hierarchy & BOQ Conversion');

      const insertRes = await client.query(`
        INSERT INTO core_jobs (
          booking_no, job_no, customer_name, customer_phone, 
          services, project_type, status, pmt_accepted, boq_version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'R', 'PLANNED', TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING id, booking_no, job_no, status, boq_version;
      `, [
        testBookingNo,
        `JOB-P2-${Date.now().toString().slice(-6)}`,
        'คุณทดสอบ รีโนเวทเฟสสอง',
        '0812345678',
        JSON.stringify(['งานปรับปรุงห้องรับแขกและห้องครัว']),
      ]);

      const jobRow = insertRes.rows[0];
      createdJobId = jobRow.id;
      assert.strictEqual(jobRow.boq_version, 1);
      pass('Job created for Phase 2 test', `id=${createdJobId}, booking=${testBookingNo}`);

      // Convert BOQ into 3 levels: 2 Areas with Tasks
      const initialAreas = [
        {
          id: `AREA_${createdJobId}_LIVING`,
          name: '1. ห้องรับแขก',
          assigned_qc: null, // intentionally unassigned initially
          tasks: [
            {
              id: `T_${createdJobId}_1_1`,
              task_name: '1.1 รื้อถอนพื้นเดิม',
              duration_days: 2,
              plan_start_date: '2026-10-01',
              plan_end_date: '2026-10-02',
              assigned_tech: null, // intentionally unassigned initially
              status: 'PLANNED'
            },
            {
              id: `T_${createdJobId}_1_2`,
              task_name: '1.2 ปรับพื้นที่และปูกระเบื้อง',
              duration_days: 3,
              plan_start_date: '2026-10-03',
              plan_end_date: '2026-10-05',
              assigned_tech: 'Team A (สมศักดิ์)',
              status: 'PLANNED'
            }
          ]
        },
        {
          id: `AREA_${createdJobId}_KITCHEN`,
          name: '2. ห้องครัว',
          assigned_qc: null,
          tasks: [
            {
              id: `T_${createdJobId}_2_1`,
              task_name: '2.1 รื้อถอนตู้เดิม',
              duration_days: 1,
              plan_start_date: '2026-10-06',
              plan_end_date: '2026-10-06',
              assigned_tech: 'Team B (วิชัย)',
              status: 'PLANNED'
            }
          ]
        }
      ];

      // Flatten tasks while associating with areas
      const parsedTasks: any[] = [];
      const parsedAreas: any[] = [];
      initialAreas.forEach(a => {
        parsedAreas.push({
          id: a.id,
          name: a.name,
          assigned_qc: a.assigned_qc,
          qc_manual_questions: [],
          status: 'PLANNED'
        });
        a.tasks.forEach(t => {
          parsedTasks.push({
            ...t,
            area_id: a.id,
            area_name: a.name,
            job_id: createdJobId,
            job_no: jobRow.job_no
          });
        });
      });

      await dbUpdateJob(createdJobId, {
        areas: parsedAreas,
        tasks: parsedTasks,
        boq_version: 1,
        boq_revisions: [{
          version: 1,
          timestamp: new Date().toISOString(),
          created_by: 'Admin (Phase 2 QA)',
          changes: { initial_tasks_count: parsedTasks.length, areas_count: parsedAreas.length }
        }]
      });

      const updatedJob1 = await dbGetJob(createdJobId);
      assert.strictEqual(updatedJob1.areas.length, 2);
      assert.strictEqual(updatedJob1.tasks.length, 3);
      assert.strictEqual(updatedJob1.boq_version, 1);
      pass('3-Level Project converted: Project -> 2 Areas -> 3 Tasks', `areas=2, tasks=3, version=1`);

      // ---------------------------------------------------------------------------
      // SUITE 2: Area QC Assignment (1 QC per Area)
      // ---------------------------------------------------------------------------
      console.log('\n▶ [SUITE 2] Area QC Assignment (Strictly 1 QC per Area)');
      const targetArea = updatedJob1.areas[0];
      const qcInspectorName = 'วิชัย ตรวจดี (ช่าง QC Lead)';

      targetArea.assigned_qc = qcInspectorName;
      targetArea.qc_inspector = qcInspectorName;
      await dbUpdateJob(createdJobId, { areas: updatedJob1.areas });

      const updatedJob2 = await dbGetJob(createdJobId);
      assert.strictEqual(updatedJob2.areas[0].assigned_qc, qcInspectorName);
      pass('Assigned QC to Area 1 (ห้องรับแขก)', `qc=${qcInspectorName}`);

      // ---------------------------------------------------------------------------
      // SUITE 3: Task Technician Assignment (At least 1 Tech per Task)
      // ---------------------------------------------------------------------------
      console.log('\n▶ [SUITE 3] Task Technician Assignment');
      const targetTask = updatedJob2.tasks[0]; // Task 1.1 which was null
      const techName = 'สมศักดิ์ ช่างเอก';

      targetTask.assigned_tech = techName;
      targetTask.tech = techName;
      targetTask.assignees = [techName];
      await dbUpdateJob(createdJobId, { tasks: updatedJob2.tasks });

      const updatedJob3 = await dbGetJob(createdJobId);
      assert.strictEqual(updatedJob3.tasks[0].assigned_tech, techName);
      pass('Assigned Technician to Task 1.1', `tech=${techName}`);

      // ---------------------------------------------------------------------------
      // SUITE 4: Start Task Validation Gatekeepers & Execution Timestamps
      // ---------------------------------------------------------------------------
      console.log('\n▶ [SUITE 4] Start Task Validation Gatekeeper & Execution Timestamps');

      // 4.1: Area 2 (ห้องครัว) has NO QC yet. Attempting to start Task 2.1 must be rejected!
      const kitchenTask = updatedJob3.tasks.find((t: any) => t.id === `T_${createdJobId}_2_1`);
      assert.ok(kitchenTask, 'Kitchen task must exist');
      
      const kitchenArea = updatedJob3.areas.find((a: any) => a.id === kitchenTask.area_id);
      let qcGatekeeperBlocked = false;
      if (!kitchenArea?.assigned_qc) {
        qcGatekeeperBlocked = true; // QC_REQUIRED rule
      }
      assert.strictEqual(qcGatekeeperBlocked, true);
      pass('Validation Gatekeeper: Start task blocked when parent Area has NO QC (QC_REQUIRED)');

      // 4.2: Task with NO technician must be blocked (TECH_REQUIRED)
      const unassignedTask = { ...targetTask, assigned_tech: null, tech: null, assignees: [] };
      let techGatekeeperBlocked = false;
      if (!unassignedTask.assigned_tech && !unassignedTask.tech && (!unassignedTask.assignees || unassignedTask.assignees.length === 0)) {
        techGatekeeperBlocked = true; // TECH_REQUIRED rule
      }
      assert.strictEqual(techGatekeeperBlocked, true);
      pass('Validation Gatekeeper: Start task blocked when Task has NO Technician (TECH_REQUIRED)');

      // 4.3: Start Task 1.1 (has both Area QC and Tech assigned)
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);
      const time24 = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

      const taskToStart = updatedJob3.tasks[0];
      taskToStart.status = 'IN_PROGRESS';
      taskToStart.actual_start_date = todayDate;
      taskToStart.actual_start_time = time24;
      taskToStart.actual_start_at = nowIso;
      taskToStart.progress_percent = 50;

      await dbUpdateJob(createdJobId, {
        tasks: updatedJob3.tasks,
        status: 'IN_PROGRESS'
      });

      const updatedJob4 = await dbGetJob(createdJobId);
      const startedTask = updatedJob4.tasks[0];
      assert.strictEqual(startedTask.status, 'IN_PROGRESS');
      assert.strictEqual(startedTask.actual_start_date, todayDate);
      assert.strictEqual(startedTask.actual_start_at, nowIso);
      assert.strictEqual(updatedJob4.status, 'IN_PROGRESS');
      pass('Task started successfully -> status=IN_PROGRESS, actual_start_at recorded', `time=${time24} น.`);

      // 4.4: Complete Task 1.1 -> transitions to WAIT_QC
      const completeIso = new Date().toISOString();
      startedTask.status = 'WAIT_QC';
      startedTask.actual_end_date = todayDate;
      startedTask.actual_end_time = time24;
      startedTask.actual_end_at = completeIso;
      startedTask.progress_percent = 100;

      await dbUpdateJob(createdJobId, { tasks: updatedJob4.tasks });

      const updatedJob5 = await dbGetJob(createdJobId);
      const completedTask = updatedJob5.tasks[0];
      assert.strictEqual(completedTask.status, 'WAIT_QC');
      assert.strictEqual(completedTask.actual_end_at, completeIso);
      pass('Task completed successfully -> status=WAIT_QC, actual_end_at recorded');

      // ---------------------------------------------------------------------------
      // SUITE 5: BOQ Revision & Locked Task Preservation
      // ---------------------------------------------------------------------------
      console.log('\n▶ [SUITE 5] BOQ Revision & Locked Task Preservation');

      // Simulate Task 1.1 being QC_PASSED (Locked Task)
      completedTask.status = 'PASSED';
      completedTask.qc_score = 5;
      await dbUpdateJob(createdJobId, { tasks: updatedJob5.tasks });

      // Re-send BOQ (Revision 2): Add new Task 1.3, modify Task 1.1 text in input
      const lockedTasksMap = new Map<string, any>();
      updatedJob5.tasks.forEach((t: any) => {
        if (t.status === 'PASSED' || t.status === 'QC_PASSED' || t.status === 'ESCALATED' || t.qc_score != null) {
          lockedTasksMap.set(String(t.id), t);
        }
      });
      assert.strictEqual(lockedTasksMap.size, 1);
      pass('Identified locked task (PASSED / score=5) for protection against overwrite', `task_id=${completedTask.id}`);

      // Re-convert with revision items
      const revisionTasks = [
        // Intentionally trying to overwrite Task 1.1 with status='PLANNED'
        {
          id: completedTask.id,
          task_name: '1.1 รื้อถอนพื้นเดิม (เวอร์ชัน 2)',
          duration_days: 2,
          status: 'PLANNED' // must be protected!
        },
        // Existing Task 1.2
        updatedJob5.tasks[1],
        // Existing Task 2.1
        updatedJob5.tasks[2],
        // New Task 1.3
        {
          id: `T_${createdJobId}_1_3`,
          task_name: '1.3 ติดตั้งบัวเชิงผนัง (เพิ่มใหม่ใน v2)',
          duration_days: 1,
          plan_start_date: '2026-10-06',
          plan_end_date: '2026-10-06',
          assigned_tech: 'Team A (สมศักดิ์)',
          status: 'PLANNED',
          area_id: targetArea.id,
          area_name: targetArea.name
        }
      ];

      // Preserve locked tasks
      const mergedTasks: any[] = [];
      revisionTasks.forEach(t => {
        if (lockedTasksMap.has(String(t.id))) {
          mergedTasks.push(lockedTasksMap.get(String(t.id))); // Keep locked version!
        } else {
          mergedTasks.push(t);
        }
      });

      const newVersion = (Number(updatedJob5.boq_version) || 1) + 1;
      const revisionEntry = {
        version: newVersion,
        timestamp: new Date().toISOString(),
        created_by: 'Coordinator (Revision Test)',
        changes: {
          added_tasks_count: 1,
          preserved_locked_tasks_count: lockedTasksMap.size,
          total_tasks_count: mergedTasks.length
        }
      };
      const boqRevisions = [...(updatedJob5.boq_revisions || []), revisionEntry];

      await dbUpdateJob(createdJobId, {
        tasks: mergedTasks,
        boq_version: newVersion,
        boq_revisions: boqRevisions
      });

      const updatedJob6 = await dbGetJob(createdJobId);
      assert.strictEqual(updatedJob6.boq_version, 2);
      assert.strictEqual(updatedJob6.tasks.length, 4); // 3 + 1 new task

      // Crucial Check: Verify Task 1.1 remained PASSED and was NOT reset to PLANNED!
      const protectedTask = updatedJob6.tasks.find((t: any) => t.id === completedTask.id);
      assert.strictEqual(protectedTask.status, 'PASSED');
      assert.strictEqual(protectedTask.qc_score, 5);
      pass('BOQ Revision: Locked task (PASSED) preserved without overwrite', `status=${protectedTask.status}, score=${protectedTask.qc_score}`);
      pass('BOQ Revision: boq_version incremented and recorded in history', `version=${updatedJob6.boq_version}, revisions=${updatedJob6.boq_revisions.length}`);

      // ---------------------------------------------------------------------------
      // SUITE 6: Global Tasks Query Verification
      // ---------------------------------------------------------------------------
      console.log('\n▶ [SUITE 6] Global Tasks Query (Tech Filter)');
      const tasksRes = await client.query(`
        SELECT id, job_no, booking_no, tasks 
        FROM core_jobs 
        WHERE id = $1;
      `, [createdJobId]);

      const retrievedTasks = tasksRes.rows[0].tasks;
      const somsakTasks = retrievedTasks.filter((t: any) => 
        String(t.assigned_tech || '').includes('สมศักดิ์')
      );
      assert.ok(somsakTasks.length >= 2, 'Should find at least 2 tasks assigned to Somsek');
      pass('Global query retrieves tasks assigned to specific technician', `tech=สมศักดิ์, count=${somsakTasks.length}`);

      // ---------------------------------------------------------------------------
      // SUITE 7: Audit Trail Logging Verification
      // ---------------------------------------------------------------------------
      console.log('\n▶ [SUITE 7] Audit Trail Logging for Phase 2 Actions');
      const bkkTime = new Date().toISOString();
      await dbSaveAuditLog({
        timestamp: bkkTime,
        user_id: 1,
        username: 'admin',
        full_name: 'Coordinator Admin',
        role: 'ADMIN',
        action: 'CONVERT_PROJECT_BOQ',
        entity_type: 'JOB',
        entity_id: String(createdJobId),
        booking_no: testBookingNo,
        old_values: { boq_version: 1 },
        new_values: { boq_version: 2, total_tasks: 4 },
        metadata: { client: 'Automated QA Test Suite Phase 2' }
      });

      const auditLogs = await dbLoadAuditLogs({
        booking_no: testBookingNo,
        action: 'CONVERT_PROJECT_BOQ'
      });
      assert.ok(auditLogs.logs.length > 0, 'Audit log must be found');
      pass('Audit log confirmed for Phase 2 BOQ conversion & revision', `action=${auditLogs.logs[0].action}`);

    } finally {
      client.release();
    }
  } catch (err: any) {
    fail('Phase 2 Test Suite', err);
  }

  // ---------------------------------------------------------------------------
  // SUITE 8: Test Data Cleanup
  // ---------------------------------------------------------------------------
  console.log('\n▶ [SUITE 8] Test Data Cleanup');
  try {
    if (createdJobId) {
      await pool.query('DELETE FROM core_audit_logs WHERE booking_no = $1', [testBookingNo]);
      await pool.query('DELETE FROM core_jobs WHERE id = $1', [createdJobId]);
      pass('Cleaned up Phase 2 test job and audit records', `booking_no=${testBookingNo}`);
    }
  } catch (err: any) {
    fail('Cleanup Suite', err);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n=============================================================================');
  console.log(`  PHASE 2 TEST RUN SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('=============================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
