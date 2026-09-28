const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:EsQShpeaGvSr21I5ieQGJRmCELp78GSlQn6hQHAIjbTnY4c1aWw56JleGierEk2t@187.77.147.16:5432/spmt_db',
  connectionTimeoutMillis: 5000
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('[UPDATE] Fetching all Renovate jobs...');
    const res = await client.query(`
      SELECT id, job_no, project_type, job_type, plan_date, tasks
      FROM core_jobs
      WHERE LOWER(project_type) LIKE '%renovate%' 
         OR LOWER(project_type) = 'r' 
         OR LOWER(job_type) LIKE '%renovate%' 
         OR LOWER(job_type) = 'r'
         OR job_no LIKE 'JOB-R%'
      ORDER BY id ASC;
    `);

    console.log(`Found ${res.rows.length} Renovate jobs.`);
    const todayStr = '2026-09-29';

    await client.query('BEGIN');

    for (const job of res.rows) {
      let updatedTasks = job.tasks;
      if (Array.isArray(job.tasks) && job.tasks.length > 0) {
        let currentDayOffset = 0;
        updatedTasks = job.tasks.map((task) => {
          const duration = Math.max(1, Number(task.duration_days || 1));
          const s = new Date(`${todayStr}T08:00:00.000Z`);
          s.setUTCDate(s.getUTCDate() + currentDayOffset);
          const e = new Date(s);
          e.setUTCDate(e.getUTCDate() + (duration - 1));
          currentDayOffset += duration;

          return {
            ...task,
            plan_start_date: s.toISOString().slice(0, 10),
            plan_end_date: e.toISOString().slice(0, 10)
          };
        });
      }

      await client.query(`
        UPDATE core_jobs
        SET plan_date = $1,
            tasks = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [todayStr, JSON.stringify(updatedTasks || []), job.id]);

      console.log(`Updated job ${job.job_no} (ID: ${job.id}) -> plan_date: ${todayStr}, tasks: ${(updatedTasks || []).length}`);
    }

    await client.query('COMMIT');
    console.log('[SUCCESS] All Renovate jobs updated successfully to start today (2026-09-29)!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating Renovate jobs:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
