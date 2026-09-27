import { pool, initDatabase } from '../database';

export async function runPhase1Migration() {
  console.log('[MIGRATION-PHASE1] Starting Phase 1 Data Model & Status Migration...');
  await initDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure core_jobs table default status is 'NEW'
    console.log('[MIGRATION-PHASE1] Setting core_jobs default status to NEW...');
    await client.query(`
      ALTER TABLE core_jobs 
      ALTER COLUMN status SET DEFAULT 'NEW';
    `);

    // 2. Ensure core_audit_logs table exists and has proper indexes
    console.log('[MIGRATION-PHASE1] Verifying core_audit_logs indexes...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS core_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id BIGINT,
        username VARCHAR(50),
        full_name VARCHAR(150),
        role VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        booking_no VARCHAR(100),
        old_values JSONB DEFAULT '{}'::jsonb,
        new_values JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb
      );
      CREATE INDEX IF NOT EXISTS idx_audit_booking ON core_audit_logs(booking_no);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON core_audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_time ON core_audit_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON core_audit_logs(action);
    `);

    // 3. Migrate jobs that were already QC passed and/or delivered to STK
    console.log('[MIGRATION-PHASE1] Migrating completed / STK delivered jobs...');
    const resCompleted = await client.query(`
      UPDATE core_jobs
      SET 
        status = 'COMPLETED',
        overall_progress = 100,
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        (qc_score IS NOT NULL AND qc_score > 0)
        OR stk_status = 'DELIVERED'
      RETURNING id, job_no, status;
    `);
    console.log(`[MIGRATION-PHASE1] Updated ${resCompleted.rowCount} completed/delivered jobs to COMPLETED.`);

    // 4. Migrate accepted jobs to their appropriate queue status (WAIT_QC for Q, PLANNED for R)
    console.log('[MIGRATION-PHASE1] Migrating accepted jobs...');
    const resAcceptedQ = await client.query(`
      UPDATE core_jobs
      SET 
        status = 'WAIT_QC',
        job_type = 'Q',
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        pmt_accepted IS TRUE 
        AND status NOT IN ('COMPLETED', 'PASSED')
        AND (LOWER(job_type) = 'quick' OR LOWER(job_type) = 'q' OR LOWER(project_type) LIKE '%quick%' OR LOWER(project_type) LIKE '%install%')
      RETURNING id;
    `);
    console.log(`[MIGRATION-PHASE1] Updated ${resAcceptedQ.rowCount} accepted Quick jobs to WAIT_QC.`);

    const resAcceptedR = await client.query(`
      UPDATE core_jobs
      SET 
        status = 'PLANNED',
        job_type = 'R',
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        pmt_accepted IS TRUE 
        AND status NOT IN ('COMPLETED', 'PASSED', 'WAIT_QC')
      RETURNING id;
    `);
    console.log(`[MIGRATION-PHASE1] Updated ${resAcceptedR.rowCount} accepted Renovate jobs to PLANNED.`);

    // 5. Migrate remaining DRAFT jobs to NEW
    console.log('[MIGRATION-PHASE1] Migrating remaining DRAFT jobs to NEW...');
    const resDraftToNew = await client.query(`
      UPDATE core_jobs
      SET 
        status = 'NEW',
        updated_at = CURRENT_TIMESTAMP
      WHERE status = 'DRAFT'
      RETURNING id;
    `);
    console.log(`[MIGRATION-PHASE1] Updated ${resDraftToNew.rowCount} DRAFT jobs to NEW.`);

    // 6. Normalize job_type for all jobs
    console.log('[MIGRATION-PHASE1] Normalizing job_type (Q / R / NEED_REVIEW)...');
    await client.query(`
      UPDATE core_jobs
      SET job_type = 'Q'
      WHERE LOWER(job_type) = 'quick';

      UPDATE core_jobs
      SET job_type = 'R'
      WHERE LOWER(job_type) = 'renovate';

      UPDATE core_jobs
      SET job_type = 'NEED_REVIEW', status = 'NEED_REVIEW'
      WHERE (job_type IS NULL OR job_type = '') AND status = 'NEW';
    `);

    // 7. Record migration audit log
    await client.query(`
      INSERT INTO core_audit_logs (
        timestamp,
        username,
        full_name,
        role,
        action,
        entity_type,
        entity_id,
        booking_no,
        metadata
      ) VALUES (
        CURRENT_TIMESTAMP,
        'system',
        'System Migration',
        'SYSTEM',
        'PHASE1_MIGRATION',
        'SYSTEM',
        'MIGRATION-PHASE1',
        NULL,
        json_build_object(
          'completed_count', ${resCompleted.rowCount || 0},
          'accepted_q_count', ${resAcceptedQ.rowCount || 0},
          'accepted_r_count', ${resAcceptedR.rowCount || 0},
          'draft_to_new_count', ${resDraftToNew.rowCount || 0}
        )
      );
    `);

    await client.query('COMMIT');
    console.log('[MIGRATION-PHASE1] Migration committed successfully!');

    // Check final status counts
    const statusCounts = await client.query(`
      SELECT status, count(*) FROM core_jobs GROUP BY status ORDER BY count DESC;
    `);
    console.log('[MIGRATION-PHASE1] Current status distribution in DB:');
    console.table(statusCounts.rows);

    const typeCounts = await client.query(`
      SELECT job_type, count(*) FROM core_jobs GROUP BY job_type ORDER BY count DESC;
    `);
    console.log('[MIGRATION-PHASE1] Current job_type distribution in DB:');
    console.table(typeCounts.rows);

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[MIGRATION-PHASE1 ERROR] Failed to run migration:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runPhase1Migration()
    .then(() => {
      console.log('[MIGRATION-PHASE1] Completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
