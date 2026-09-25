import { pool, initDatabase } from '../database';

async function resetAllOrdersAndCleanData() {
  console.log('[RESET] Connecting to database...');
  await initDatabase();
  const client = await pool.connect();

  try {
    console.log('[RESET] Starting database transaction to reset orders and wipe transaction data...');
    await client.query('BEGIN');

    // 1. Truncate transaction and log tables
    console.log('[RESET] Truncating operational logs and temporary tables...');
    await client.query(`
      TRUNCATE TABLE 
        core_daily_work_logs, 
        core_qc_bookings, 
        core_tickets, 
        core_blueprints, 
        staging_survey_reports, 
        core_audit_logs, 
        stk_sync_logs, 
        inbound_api_logs, 
        ma_rounds, 
        ma_contracts 
      CASCADE;
    `);

    // 2. Fetch all existing jobs in core_jobs
    const { rows: jobs } = await client.query('SELECT id, job_no, tasks, areas FROM core_jobs');
    console.log(`[RESET] Found ${jobs.length} jobs in core_jobs. Resetting to initial state...`);

    for (const job of jobs) {
      let tasks = Array.isArray(job.tasks) ? job.tasks : [];
      let areas = Array.isArray(job.areas) ? job.areas : [];

      // Reset tasks inside job
      const resetTasks = tasks.map((t: any, idx: number) => ({
        ...t,
        id: t.id || `task-${job.id}-${idx + 1}`,
        status: 'PLANNED',
        progress_percent: 0,
        actual_start_date: null,
        actual_end_date: null,
        actual_start_time: null,
        actual_end_time: null,
        qc_score: null,
        rework_count: 0
      }));

      // Reset areas inside job
      const resetAreas = areas.map((a: any) => ({
        ...a,
        status: 'OPEN'
      }));

      await client.query(`
        UPDATE core_jobs SET
          status = 'DRAFT',
          overall_progress = 0,
          ticket_no = NULL,
          step_timestamps = '{}'::jsonb,
          escalated_at = NULL,
          escalated_reason = NULL,
          tasks = $1::jsonb,
          areas = $2::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [JSON.stringify(resetTasks), JSON.stringify(resetAreas), job.id]);
    }

    await client.query('COMMIT');
    console.log(`[RESET SUCCESS] Successfully reset ${jobs.length} orders back to DRAFT / Initial state, and cleared all daily logs, QC logs, STK logs, tickets, blueprints, and audit logs.`);

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[RESET ERROR] Failed to reset database:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

resetAllOrdersAndCleanData().catch(err => {
  console.error(err);
  process.exit(1);
});
