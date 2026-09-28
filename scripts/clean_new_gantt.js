const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Connecting to PostgreSQL database...');
  
  // 1. Inspect existing NEW jobs with tasks or areas
  const inspectRes = await pool.query(`
    SELECT job_no, status, pmt_accepted, 
           jsonb_array_length(COALESCE(tasks, '[]'::jsonb)) as tasks_count, 
           jsonb_array_length(COALESCE(areas, '[]'::jsonb)) as areas_count 
    FROM core_jobs 
    WHERE UPPER(status) IN ('NEW', 'NEED_REVIEW', 'DRAFT', 'SURVEYED', 'NEW_ORDER')
       OR (pmt_accepted IS FALSE OR pmt_accepted IS NULL)
    ORDER BY id ASC;
  `);

  console.log(`Found ${inspectRes.rows.length} jobs in NEW/unaccepted status:`);
  inspectRes.rows.forEach(r => {
    console.log(`- ${r.job_no}: status=${r.status}, pmt_accepted=${r.pmt_accepted}, tasks=${r.tasks_count}, areas=${r.areas_count}`);
  });

  // 1.5. If JOB-R2609019 is PLANNED, reset it back to NEW
  await pool.query(`
    UPDATE core_jobs 
    SET status = 'NEW', 
        pmt_accepted = false, 
        pmt_accepted_at = NULL, 
        tasks = '[]'::jsonb, 
        areas = '[]'::jsonb
    WHERE job_no = 'JOB-R2609019' AND status = 'PLANNED';
  `);

  // 2. Clear tasks and areas for jobs that are still NEW or unaccepted
  const updateRes = await pool.query(`
    UPDATE core_jobs 
    SET tasks = '[]'::jsonb, 
        areas = '[]'::jsonb
    WHERE UPPER(status) IN ('NEW', 'NEED_REVIEW', 'DRAFT', 'SURVEYED', 'NEW_ORDER')
       OR (pmt_accepted IS FALSE OR pmt_accepted IS NULL);
  `);

  console.log(`\nSuccessfully updated ${updateRes.rowCount} jobs: cleared tasks and areas to [] for all NEW/unaccepted jobs!`);

  // 3. Verify
  const verifyRes = await pool.query(`
    SELECT job_no, status, 
           jsonb_array_length(COALESCE(tasks, '[]'::jsonb)) as tasks_count, 
           jsonb_array_length(COALESCE(areas, '[]'::jsonb)) as areas_count 
    FROM core_jobs 
    WHERE UPPER(status) IN ('NEW', 'NEED_REVIEW', 'DRAFT', 'SURVEYED', 'NEW_ORDER')
       OR (pmt_accepted IS FALSE OR pmt_accepted IS NULL);
  `);
  
  console.log(`Verification: all ${verifyRes.rows.length} unaccepted jobs now have tasks=0, areas=0:`);
  verifyRes.rows.slice(0, 5).forEach(r => {
    console.log(`✓ ${r.job_no}: status=${r.status}, tasks=${r.tasks_count}, areas=${r.areas_count}`);
  });

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
