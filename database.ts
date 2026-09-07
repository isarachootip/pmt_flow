import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL Connection Pool
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:EsQShpeaGvSr21I5ieQGJRmCELp78GSlQn6hQHAIjbTnY4c1aWw56JleGierEk2t@187.77.147.16:5432/spmt_db';

export const pool = new Pool({
  connectionString,
  ssl: false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB POOL ERROR] Unexpected client error:', err.message);
});

export let isDatabaseConnected = false;

// Check and Initialize Database Tables
export async function initDatabase(): Promise<boolean> {
  try {
    const client = await pool.connect();
    isDatabaseConnected = true;
    console.log('[DB] Connected to PostgreSQL successfully at spmt_db!');

    // 1. Ensure core tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS core_jobs (
        id SERIAL PRIMARY KEY,
        job_no VARCHAR(50) UNIQUE NOT NULL,
        external_ref_id VARCHAR(100),
        booking_no VARCHAR(100),
        ticket_no VARCHAR(100),
        customer_id INT,
        status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        job_type VARCHAR(50) DEFAULT 'quick',
        step_timestamps JSONB DEFAULT '{}'::jsonb,
        property_type VARCHAR(50),
        project_type VARCHAR(100),
        project_sub_type VARCHAR(100),
        store_code VARCHAR(50),
        agent_name VARCHAR(150),
        assigned_tech VARCHAR(150),
        plan_date VARCHAR(50),
        services JSONB DEFAULT '[]'::jsonb,
        overall_progress INT DEFAULT 0,
        special_instructions TEXT,
        additional_notes TEXT,
        customer_data JSONB DEFAULT '{}'::jsonb,
        tasks JSONB DEFAULT '[]'::jsonb,
        photos JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS core_daily_work_logs (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(64) NOT NULL,
        job_no VARCHAR(50),
        task_id VARCHAR(64) NOT NULL,
        task_name VARCHAR(255),
        log_date VARCHAR(20) NOT NULL,
        start_time VARCHAR(10),
        end_time VARCHAR(10),
        work_hours VARCHAR(20),
        day_number INT,
        total_days INT,
        technician VARCHAR(150),
        recorded_by VARCHAR(150),
        reporter_role VARCHAR(20),
        progress_percent INT DEFAULT 0,
        work_description TEXT,
        issues_encountered TEXT,
        solutions_applied TEXT,
        materials_used TEXT,
        photos JSONB DEFAULT '[]'::jsonb,
        is_final_day BOOLEAN DEFAULT FALSE,
        supervisor_approved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS core_qc_bookings (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(64) NOT NULL,
        job_no VARCHAR(50),
        customer_name VARCHAR(150),
        booking_date VARCHAR(20) NOT NULL,
        time_slot VARCHAR(50),
        technician_name VARCHAR(150),
        qc_inspector VARCHAR(150),
        status VARCHAR(30) DEFAULT 'PENDING',
        checklist JSONB DEFAULT '[]'::jsonb,
        notes TEXT,
        photos JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS inbound_api_logs (
        id VARCHAR(64) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        method VARCHAR(10),
        path TEXT,
        ip VARCHAR(45),
        status INT,
        duration_ms INT,
        headers JSONB,
        body JSONB,
        response_body JSONB
      );
    `);

    // 2. Ensure default users exist in sys_users
    await client.query(`
      INSERT INTO sys_users (user_code, username, email, full_name, role, password_hash, is_active)
      VALUES 
        ('USR-001B', 'isarachootip@gmail.com', 'isarachootip@gmail.com', 'Isara Chootip', 'ADMIN', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', true)
      ON CONFLICT (username) DO NOTHING;
    `);

    client.release();
    console.log('[DB] Core tables verified / created in spmt_db.');
    return true;
  } catch (err: any) {
    console.warn('[DB WARNING] Could not initialize PostgreSQL tables, running in-memory fallback:', err.message);
    isDatabaseConnected = false;
    return false;
  }
}

// =============================================================================
// USERS & AUTH DB REPOSITORY
// =============================================================================

export async function dbLoadUsers(): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query('SELECT * FROM sys_users ORDER BY id ASC');
    return res.rows;
  } catch (err: any) {
    console.error('[DB] Error loading users:', err.message);
    return [];
  }
}

export async function dbSaveUser(user: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO sys_users (user_code, username, email, full_name, role, password_hash, is_active, last_login_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (username) DO UPDATE SET
         user_code = EXCLUDED.user_code,
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash,
         is_active = EXCLUDED.is_active,
         last_login_at = EXCLUDED.last_login_at,
         updated_at = CURRENT_TIMESTAMP`,
      [
        user.user_code,
        user.username,
        user.email || null,
        user.full_name,
        user.role,
        user.password_hash,
        user.is_active ?? true,
        user.last_login_at ? new Date(user.last_login_at) : null,
        user.created_at ? new Date(user.created_at) : new Date(),
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving user:', err.message);
  }
}

export async function dbUpdateUser(id: number | string, fields: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(fields)) {
      if (['full_name', 'email', 'role', 'is_active', 'password_hash', 'last_login_at'].includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(key === 'last_login_at' && val ? new Date(val as string) : val);
      }
    }
    if (setClauses.length === 0) return;
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await pool.query(`UPDATE sys_users SET ${setClauses.join(', ')} WHERE id = $${idx} OR user_code = $${idx}`, values);
  } catch (err: any) {
    console.error('[DB] Error updating user:', err.message);
  }
}

export async function dbDeleteUser(id: number | string): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query('DELETE FROM sys_users WHERE id = $1', [id]);
  } catch (err: any) {
    console.error('[DB] Error deleting user:', err.message);
  }
}

export async function dbSaveLoginLog(log: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO sys_login_log (username, user_id, success, ip_address, fail_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        log.username,
        log.user_id ? Number(log.user_id) : null,
        log.success,
        log.ip_address || null,
        log.fail_reason || null,
        log.created_at ? new Date(log.created_at) : new Date(),
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving login log:', err.message);
  }
}

// =============================================================================
// JOBS & PROJECTS DB REPOSITORY
// =============================================================================

export async function dbLoadJobs(): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query('SELECT * FROM core_jobs ORDER BY created_at DESC, id DESC');
    return res.rows.map(row => ({
      ...row,
      step_timestamps: row.step_timestamps || {},
      services: row.services || [],
      customer: row.customer_data || {},
      tasks: row.tasks || [],
      photos: row.photos || []
    }));
  } catch (err: any) {
    console.error('[DB] Error loading jobs:', err.message);
    return [];
  }
}

export async function dbSaveJob(job: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO core_jobs (
        job_no, external_ref_id, booking_no, ticket_no, customer_id, status, job_type,
        step_timestamps, property_type, project_type, project_sub_type, store_code,
        agent_name, assigned_tech, plan_date, services, overall_progress,
        special_instructions, additional_notes, customer_data, tasks, photos
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      ) ON CONFLICT (job_no) DO UPDATE SET
        external_ref_id = EXCLUDED.external_ref_id,
        booking_no = EXCLUDED.booking_no,
        ticket_no = EXCLUDED.ticket_no,
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        job_type = EXCLUDED.job_type,
        step_timestamps = EXCLUDED.step_timestamps,
        property_type = EXCLUDED.property_type,
        project_type = EXCLUDED.project_type,
        project_sub_type = EXCLUDED.project_sub_type,
        store_code = EXCLUDED.store_code,
        agent_name = EXCLUDED.agent_name,
        assigned_tech = EXCLUDED.assigned_tech,
        plan_date = EXCLUDED.plan_date,
        services = EXCLUDED.services,
        overall_progress = EXCLUDED.overall_progress,
        special_instructions = EXCLUDED.special_instructions,
        additional_notes = EXCLUDED.additional_notes,
        customer_data = EXCLUDED.customer_data,
        tasks = EXCLUDED.tasks,
        photos = EXCLUDED.photos,
        updated_at = CURRENT_TIMESTAMP`,
      [
        job.job_no,
        job.external_ref_id || null,
        job.booking_no || null,
        job.ticket_no || null,
        job.customer_id ? Number(job.customer_id) : 1,
        job.status || 'DRAFT',
        job.job_type || 'quick',
        JSON.stringify(job.step_timestamps || {}),
        job.property_type || null,
        job.project_type || null,
        job.project_sub_type || null,
        job.store_code || null,
        job.agent_name || null,
        job.assigned_tech || null,
        job.plan_date || null,
        JSON.stringify(job.services || []),
        job.overall_progress || 0,
        job.special_instructions || null,
        job.additional_notes || null,
        JSON.stringify(job.customer || {}),
        JSON.stringify(job.tasks || []),
        JSON.stringify(job.photos || [])
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving job:', err.message);
  }
}

export async function dbUpdateJob(jobNoOrId: string | number, updates: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    const target = String(jobNoOrId);
    
    if (updates.status !== undefined) {
      await pool.query(`UPDATE core_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE job_no = $2 OR (id::text = $2)`, [updates.status, target]);
    }
    if (updates.overall_progress !== undefined) {
      await pool.query(`UPDATE core_jobs SET overall_progress = $1, updated_at = CURRENT_TIMESTAMP WHERE job_no = $2 OR (id::text = $2)`, [updates.overall_progress, target]);
    }
    if (updates.photos !== undefined) {
      await pool.query(`UPDATE core_jobs SET photos = $1, updated_at = CURRENT_TIMESTAMP WHERE job_no = $2 OR (id::text = $2)`, [JSON.stringify(updates.photos), target]);
    }
    if (updates.tasks !== undefined) {
      await pool.query(`UPDATE core_jobs SET tasks = $1, updated_at = CURRENT_TIMESTAMP WHERE job_no = $2 OR (id::text = $2)`, [JSON.stringify(updates.tasks), target]);
    }
    if (updates.step_timestamps !== undefined) {
      await pool.query(`UPDATE core_jobs SET step_timestamps = $1, updated_at = CURRENT_TIMESTAMP WHERE job_no = $2 OR (id::text = $2)`, [JSON.stringify(updates.step_timestamps), target]);
    }
    if (updates.ticket_no !== undefined) {
      await pool.query(`UPDATE core_jobs SET ticket_no = $1, updated_at = CURRENT_TIMESTAMP WHERE job_no = $2 OR (id::text = $2)`, [updates.ticket_no, target]);
    }
    if (updates.booking_no !== undefined) {
      await pool.query(`UPDATE core_jobs SET booking_no = $1, updated_at = CURRENT_TIMESTAMP WHERE job_no = $2 OR (id::text = $2)`, [updates.booking_no, target]);
    }
    if (updates.assigned_tech !== undefined) {
      await pool.query(`UPDATE core_jobs SET assigned_tech = $1, updated_at = CURRENT_TIMESTAMP WHERE job_no = $2 OR (id::text = $2)`, [updates.assigned_tech, target]);
    }
    if (updates.job_type !== undefined) {
      await pool.query(`UPDATE core_jobs SET job_type = $1, updated_at = CURRENT_TIMESTAMP WHERE job_no = $2 OR (id::text = $2)`, [updates.job_type, target]);
    }
  } catch (err: any) {
    console.error('[DB] Error updating job:', err.message);
  }
}

export async function dbDeleteJob(jobNoOrId: string | number): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    const isId = typeof jobNoOrId === 'number' || !isNaN(Number(jobNoOrId));
    const whereCol = isId ? 'id' : 'job_no';
    await pool.query(`DELETE FROM core_jobs WHERE ${whereCol} = $1`, [jobNoOrId]);
  } catch (err: any) {
    console.error('[DB] Error deleting job:', err.message);
  }
}

// =============================================================================
// DAILY WORK LOGS & TECHNICIAN PHOTOS DB REPOSITORY
// =============================================================================

export async function dbLoadDailyWorkLogs(): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query('SELECT * FROM core_daily_work_logs ORDER BY log_date DESC, id DESC');
    return res.rows.map(row => ({
      ...row,
      photos: row.photos || []
    }));
  } catch (err: any) {
    console.error('[DB] Error loading daily work logs:', err.message);
    return [];
  }
}

export async function dbSaveDailyWorkLog(log: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO core_daily_work_logs (
        id, job_id, job_no, task_id, task_name, log_date, start_time, end_time,
        work_hours, day_number, total_days, technician, recorded_by, reporter_role,
        progress_percent, work_description, issues_encountered, solutions_applied,
        materials_used, photos, is_final_day, supervisor_approved
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      ) ON CONFLICT (id) DO UPDATE SET
        job_id = EXCLUDED.job_id,
        job_no = EXCLUDED.job_no,
        task_id = EXCLUDED.task_id,
        task_name = EXCLUDED.task_name,
        log_date = EXCLUDED.log_date,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        work_hours = EXCLUDED.work_hours,
        day_number = EXCLUDED.day_number,
        total_days = EXCLUDED.total_days,
        technician = EXCLUDED.technician,
        recorded_by = EXCLUDED.recorded_by,
        reporter_role = EXCLUDED.reporter_role,
        progress_percent = EXCLUDED.progress_percent,
        work_description = EXCLUDED.work_description,
        issues_encountered = EXCLUDED.issues_encountered,
        solutions_applied = EXCLUDED.solutions_applied,
        materials_used = EXCLUDED.materials_used,
        photos = EXCLUDED.photos,
        is_final_day = EXCLUDED.is_final_day,
        supervisor_approved = EXCLUDED.supervisor_approved,
        updated_at = CURRENT_TIMESTAMP`,
      [
        log.id,
        String(log.job_id),
        log.job_no || null,
        String(log.task_id),
        log.task_name || '',
        log.log_date,
        log.start_time || '08:30',
        log.end_time || '17:00',
        log.work_hours || '8.5 ชม.',
        log.day_number || 1,
        log.total_days || 1,
        log.technician || '',
        log.recorded_by || '',
        log.reporter_role || 'TECH',
        log.progress_percent || 0,
        log.work_description || null,
        log.issues_encountered || null,
        log.solutions_applied || null,
        log.materials_used || null,
        JSON.stringify(log.photos || []),
        log.is_final_day ?? false,
        log.supervisor_approved ?? false
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving daily work log:', err.message);
  }
}

export async function dbDeleteDailyWorkLog(id: string): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query('DELETE FROM core_daily_work_logs WHERE id = $1', [id]);
  } catch (err: any) {
    console.error('[DB] Error deleting daily work log:', err.message);
  }
}

// =============================================================================
// QC BOOKINGS DB REPOSITORY
// =============================================================================

export async function dbLoadQCBookings(): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query('SELECT * FROM core_qc_bookings ORDER BY booking_date DESC, id DESC');
    return res.rows.map(row => ({
      ...row,
      checklist: row.checklist || [],
      photos: row.photos || []
    }));
  } catch (err: any) {
    console.error('[DB] Error loading QC bookings:', err.message);
    return [];
  }
}

export async function dbSaveQCBooking(booking: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO core_qc_bookings (
        id, job_id, job_no, customer_name, booking_date, time_slot, technician_name,
        qc_inspector, status, checklist, notes, photos
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) ON CONFLICT (id) DO UPDATE SET
        job_id = EXCLUDED.job_id,
        job_no = EXCLUDED.job_no,
        customer_name = EXCLUDED.customer_name,
        booking_date = EXCLUDED.booking_date,
        time_slot = EXCLUDED.time_slot,
        technician_name = EXCLUDED.technician_name,
        qc_inspector = EXCLUDED.qc_inspector,
        status = EXCLUDED.status,
        checklist = EXCLUDED.checklist,
        notes = EXCLUDED.notes,
        photos = EXCLUDED.photos,
        updated_at = CURRENT_TIMESTAMP`,
      [
        booking.id,
        String(booking.job_id),
        booking.job_no || null,
        booking.customer_name || '',
        booking.booking_date,
        booking.time_slot || 'เช้า (09:00 - 12:00)',
        booking.technician_name || '',
        booking.qc_inspector || '',
        booking.status || 'PENDING',
        JSON.stringify(booking.checklist || []),
        booking.notes || null,
        JSON.stringify(booking.photos || [])
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving QC booking:', err.message);
  }
}

// =============================================================================
// MA CONTRACTS & ROUNDS DB REPOSITORY
// =============================================================================

export async function dbLoadMAContracts(): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query('SELECT * FROM ma_contracts ORDER BY contract_start_date DESC');
    return res.rows.map(row => ({
      ...row,
      service_items: row.service_items || []
    }));
  } catch (err: any) {
    console.error('[DB] Error loading MA contracts:', err.message);
    return [];
  }
}

export async function dbSaveMAContract(contract: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO ma_contracts (
        id, contract_no, customer_id, customer_site_id, customer_name, customer_phone,
        site_name, site_address, service_type, service_items, frequency_months,
        total_rounds, contract_start_date, contract_end_date, contract_value,
        status, notes, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) ON CONFLICT (id) DO UPDATE SET
        contract_no = EXCLUDED.contract_no,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        site_name = EXCLUDED.site_name,
        site_address = EXCLUDED.site_address,
        service_type = EXCLUDED.service_type,
        service_items = EXCLUDED.service_items,
        frequency_months = EXCLUDED.frequency_months,
        total_rounds = EXCLUDED.total_rounds,
        contract_start_date = EXCLUDED.contract_start_date,
        contract_end_date = EXCLUDED.contract_end_date,
        contract_value = EXCLUDED.contract_value,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP`,
      [
        contract.id,
        contract.contract_no,
        contract.customer_id ? Number(contract.customer_id) : null,
        contract.customer_site_id ? Number(contract.customer_site_id) : null,
        contract.customer_name || '',
        contract.customer_phone || '',
        contract.site_name || '',
        contract.site_address || '',
        contract.service_type || '',
        JSON.stringify(contract.service_items || []),
        contract.frequency_months || 3,
        contract.total_rounds || 4,
        contract.contract_start_date,
        contract.contract_end_date || null,
        contract.contract_value || 0,
        contract.status || 'Active',
        contract.notes || null,
        contract.created_by || 'system'
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving MA contract:', err.message);
  }
}

export async function dbLoadMARounds(): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query('SELECT * FROM ma_rounds ORDER BY scheduled_date ASC');
    return res.rows;
  } catch (err: any) {
    console.error('[DB] Error loading MA rounds:', err.message);
    return [];
  }
}

export async function dbSaveMARound(round: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO ma_rounds (
        id, contract_id, project_id, round_number, scheduled_date, actual_date, status, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) ON CONFLICT (id) DO UPDATE SET
        contract_id = EXCLUDED.contract_id,
        round_number = EXCLUDED.round_number,
        scheduled_date = EXCLUDED.scheduled_date,
        actual_date = EXCLUDED.actual_date,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP`,
      [
        round.id,
        round.contract_id,
        round.project_id ? Number(round.project_id) : null,
        round.round_number || 1,
        round.scheduled_date,
        round.actual_date || null,
        round.status || 'Scheduled',
        round.notes || null
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving MA round:', err.message);
  }
}
