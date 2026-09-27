import { pool, initDatabase } from '../database';

export async function resetAllOrdersAndCleanData() {
  console.log('[RESET] Connecting to database...');
  await initDatabase();
  const client = await pool.connect();

  try {
    console.log('[RESET] Starting database transaction to reset all orders to "NEW" (รอรับงาน) and wipe all state data...');
    await client.query('BEGIN');

    // 1. Truncate transaction, log, and state tables
    console.log('[RESET] Truncating operational logs, blueprints, tickets, and temporary tables...');
    await client.query(`
      TRUNCATE TABLE 
        core_daily_work_logs, 
        core_qc_bookings, 
        core_tickets, 
        core_blueprints, 
        staging_survey_reports, 
        core_audit_logs, 
        stk_sync_logs, 
        ma_rounds, 
        ma_contracts 
      CASCADE;
    `);

    // 2. Reset all orders in core_jobs to "NEW" (รอรับงาน) and clear all state-specific data
    console.log('[RESET] Updating all core_jobs to status = "NEW" (รอรับงาน) and wiping state data...');
    const result = await client.query(`
      UPDATE core_jobs SET
        status = 'NEW',
        overall_progress = 0,
        pmt_accepted = false,
        pmt_accepted_at = NULL,
        ticket_no = NULL,
        step_timestamps = '{}'::jsonb,
        step3_confirmed = false,
        tasks = '[]'::jsonb,
        areas = '[]'::jsonb,
        boq_items = '[]'::jsonb,
        boq_discount = 0,
        boq_subtotal = 0,
        boq_grand_total = 0,
        boq_original_file = NULL,
        boq_version = 1,
        boq_revisions = '[]'::jsonb,
        checkin_data = '{}'::jsonb,
        checkout_data = '{}'::jsonb,
        approval_data = '{}'::jsonb,
        visit_results = '[]'::jsonb,
        qc_inspection_type = NULL,
        qc_passed_at = NULL,
        qc_score = NULL,
        qc_history = '[]'::jsonb,
        qc_subtasks = '[]'::jsonb,
        rework_count = 0,
        qc_rework_count = 0,
        has_rework = false,
        qc_remarks = NULL,
        qc_inspector = NULL,
        qc_manual_questions = '[]'::jsonb,
        csat_score = NULL,
        csat_remarks = NULL,
        csat_photos = '[]'::jsonb,
        csat_surveyor = NULL,
        csat_evaluated_at = NULL,
        stk_ref = NULL,
        stk_status = NULL,
        stk_payload = '{}'::jsonb,
        stk_exported_at = NULL,
        escalated_at = NULL,
        escalated_reason = NULL,
        updated_at = CURRENT_TIMESTAMP;
    `);

    await client.query('COMMIT');
    console.log(`[RESET SUCCESS] Successfully reset ${result.rowCount} orders back to "รอรับงาน (NEW)" and wiped all state data completely.`);
    return result.rowCount;

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[RESET ERROR] Failed to reset database:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Execute if run directly from CLI
if (require.main === module) {
  resetAllOrdersAndCleanData()
    .then((count) => {
      console.log(`[DONE] ${count} orders reset to "รอรับงาน (NEW)".`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
