import { pool, initDatabase } from '../database';

export async function runPhase2Migration() {
  console.log('[MIGRATION-PHASE2] Starting Phase 2 Data Model Migration (3-Level Project & BOQ Revisions)...');
  await initDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure boq_version and boq_revisions columns exist on core_jobs
    console.log('[MIGRATION-PHASE2] Adding boq_version and boq_revisions columns to core_jobs...');
    await client.query(`
      ALTER TABLE core_jobs 
      ADD COLUMN IF NOT EXISTS boq_version INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS boq_revisions JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS areas JSONB DEFAULT '[]'::jsonb;
    `);

    // 2. Set default boq_version = 1 for any jobs where boq_version is null
    console.log('[MIGRATION-PHASE2] Setting default boq_version for existing jobs...');
    const resVersion = await client.query(`
      UPDATE core_jobs 
      SET boq_version = 1 
      WHERE boq_version IS NULL;
    `);
    console.log(`[MIGRATION-PHASE2] Initialized boq_version for ${resVersion.rowCount} jobs.`);

    // 3. Create index for searching tasks and booking_no
    console.log('[MIGRATION-PHASE2] Creating indexes for Phase 2...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_core_jobs_booking_no ON core_jobs(booking_no);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_project_type ON core_jobs(project_type);
    `);

    await client.query('COMMIT');
    console.log('[MIGRATION-PHASE2] Phase 2 DB Migration completed successfully!');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[MIGRATION-PHASE2] Migration failed, rolled back:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runPhase2Migration()
    .then(() => {
      console.log('[MIGRATION-PHASE2] Migration run finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[MIGRATION-PHASE2] Migration error:', err);
      process.exit(1);
    });
}
